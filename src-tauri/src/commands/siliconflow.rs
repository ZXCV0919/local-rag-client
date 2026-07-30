use crate::db::settings;
use crate::errors::AppError;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

const KEY_SETTING: &str = "siliconflow_api_key";
const DEFAULT_BASE: &str = "https://api.siliconflow.cn/v1";

#[derive(Default)]
pub struct SiliconflowStreamState {
  aborts: Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageDto {
  pub role: String,
  pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiliconflowChatEvent {
  pub stream_id: String,
  pub kind: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub content: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<String>,
}

fn parse_stored_string(raw: &str) -> String {
  match serde_json::from_str::<String>(raw) {
    Ok(s) => s,
    Err(_) => raw.trim().trim_matches('"').to_string(),
  }
}

pub fn read_api_key_plain() -> Result<String, AppError> {
  match settings::get(KEY_SETTING)? {
    Some(raw) => Ok(parse_stored_string(&raw).trim().to_string()),
    None => Ok(String::new()),
  }
}

fn map_http_error(status: u16, body: &str) -> String {
  let snippet: String = body.trim().chars().take(200).collect();
  match status {
    401 => "API Key 无效或已过期，请在设置中更新".into(),
    402 => "账户余额不足，请充值后重试".into(),
    429 => "请求过于频繁或触发限流，请稍后再试".into(),
    s if s >= 500 => format!("硅基流动服务暂时不可用（{s}）"),
    s if !snippet.is_empty() => format!("请求失败（{s}）: {snippet}"),
    s => format!("请求失败（{s}）"),
  }
}

fn resolve_base_url(base_url: Option<String>) -> String {
  let from_arg = base_url
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty());
  if let Some(u) = from_arg {
    return u.trim_end_matches('/').to_string();
  }
  if let Ok(Some(raw)) = settings::get("siliconflow_base_url") {
    let u = parse_stored_string(&raw);
    if !u.trim().is_empty() {
      return u.trim().trim_end_matches('/').to_string();
    }
  }
  DEFAULT_BASE.to_string()
}

fn resolve_api_key(api_key_override: Option<String>) -> Result<String, AppError> {
  if let Some(k) = api_key_override {
    let t = k.trim().to_string();
    if !t.is_empty() {
      return Ok(t);
    }
  }
  let stored = read_api_key_plain()?;
  if stored.is_empty() {
    return Err(AppError::validation(
      "未配置硅基流动 API Key，请在设置中填写后重试。",
    ));
  }
  Ok(stored)
}

#[tauri::command]
pub fn siliconflow_api_key_configured() -> Result<bool, AppError> {
  Ok(!read_api_key_plain()?.is_empty())
}

#[tauri::command]
pub async fn siliconflow_chat_complete(
  messages: Vec<ChatMessageDto>,
  model: String,
  base_url: Option<String>,
  api_key_override: Option<String>,
  temperature: Option<f32>,
  max_tokens: Option<u32>,
) -> Result<String, AppError> {
  let api_key = resolve_api_key(api_key_override)?;
  let base = resolve_base_url(base_url);
  let client = reqwest::Client::new();
  let body = serde_json::json!({
    "model": model,
    "messages": messages,
    "stream": false,
    "temperature": temperature.unwrap_or(0.0),
    "max_tokens": max_tokens.unwrap_or(256),
  });

  let resp = client
    .post(format!("{base}/chat/completions"))
    .header("Authorization", format!("Bearer {api_key}"))
    .header("Content-Type", "application/json")
    .json(&body)
    .send()
    .await
    .map_err(|_| AppError::external("无法连接硅基流动，请检查网络"))?;

  let status = resp.status();
  if !status.is_success() {
    let text = resp.text().await.unwrap_or_default();
    return Err(AppError::external(map_http_error(status.as_u16(), &text)));
  }

  let data: serde_json::Value = resp
    .json()
    .await
    .map_err(|e| AppError::external(format!("解析响应失败: {e}")))?;
  let content = data["choices"][0]["message"]["content"]
    .as_str()
    .unwrap_or("")
    .trim()
    .to_string();
  Ok(content)
}

#[tauri::command]
pub async fn siliconflow_chat_stream(
  app: AppHandle,
  state: State<'_, Arc<SiliconflowStreamState>>,
  stream_id: String,
  messages: Vec<ChatMessageDto>,
  model: String,
  base_url: Option<String>,
) -> Result<(), AppError> {
  let api_key = resolve_api_key(None)?;
  let base = resolve_base_url(base_url);
  let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();
  {
    let mut map = state.aborts.lock().await;
    map.insert(stream_id.clone(), cancel_tx);
  }

  let emit = |kind: &str, content: Option<String>, error: Option<String>| {
    let _ = app.emit(
      "siliconflow:chat",
      SiliconflowChatEvent {
        stream_id: stream_id.clone(),
        kind: kind.to_string(),
        content,
        error,
      },
    );
  };

  let client = reqwest::Client::new();
  let body = serde_json::json!({
    "model": model,
    "messages": messages,
    "stream": true,
    "temperature": 0.6,
  });

  let resp = match client
    .post(format!("{base}/chat/completions"))
    .header("Authorization", format!("Bearer {api_key}"))
    .header("Content-Type", "application/json")
    .json(&body)
    .send()
    .await
  {
    Ok(r) => r,
    Err(_) => {
      emit("error", None, Some("无法连接硅基流动，请检查网络".into()));
      let mut map = state.aborts.lock().await;
      map.remove(&stream_id);
      return Ok(());
    }
  };

  if !resp.status().is_success() {
    let status = resp.status().as_u16();
    let text = resp.text().await.unwrap_or_default();
    emit("error", None, Some(map_http_error(status, &text)));
    let mut map = state.aborts.lock().await;
    map.remove(&stream_id);
    return Ok(());
  }

  let mut stream = resp.bytes_stream();
  let mut buf = String::new();

  loop {
    tokio::select! {
      _ = &mut cancel_rx => {
        emit("done", None, None);
        break;
      }
      next = stream.next() => {
        match next {
          None => {
            if !buf.trim().is_empty() {
              emit_sse_line(&buf, &emit);
            }
            emit("done", None, None);
            break;
          }
          Some(Err(e)) => {
            emit("error", None, Some(format!("流式读取失败: {e}")));
            break;
          }
          Some(Ok(bytes)) => {
            buf.push_str(&String::from_utf8_lossy(&bytes));
            while let Some(pos) = buf.find('\n') {
              let line = buf[..pos].trim_end_matches('\r').to_string();
              buf = buf[pos + 1..].to_string();
              emit_sse_line(&line, &emit);
            }
          }
        }
      }
    }
  }

  {
    let mut map = state.aborts.lock().await;
    map.remove(&stream_id);
  }
  Ok(())
}

fn emit_sse_line(line: &str, emit: &dyn Fn(&str, Option<String>, Option<String>)) {
  let trimmed = line.trim();
  if !trimmed.starts_with("data:") {
    return;
  }
  let payload = trimmed[5..].trim();
  if payload.is_empty() || payload == "[DONE]" {
    return;
  }
  if let Ok(data) = serde_json::from_str::<serde_json::Value>(payload) {
    if let Some(content) = data["choices"][0]["delta"]["content"].as_str() {
      if !content.is_empty() {
        emit("content", Some(content.to_string()), None);
      }
    }
  }
}

#[tauri::command]
pub async fn siliconflow_chat_abort(
  state: State<'_, Arc<SiliconflowStreamState>>,
  stream_id: String,
) -> Result<(), AppError> {
  let mut map = state.aborts.lock().await;
  if let Some(tx) = map.remove(&stream_id) {
    let _ = tx.send(());
  }
  Ok(())
}
