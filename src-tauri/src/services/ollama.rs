use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub connected: bool,
    pub url: String,
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub model_type: String,
    pub size: i64,
    pub parameter_size: String,
}

pub struct OllamaService {
    url: String,
    client: Client,
}

/// `base_url` / `set_base_url` kept for settings-driven URL updates (later phase).
#[allow(dead_code)]
impl OllamaService {
    pub fn new(url: &str) -> Self {
        Self {
            url: url.trim_end_matches('/').to_string(),
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    pub fn base_url(&self) -> &str {
        &self.url
    }

    pub fn set_base_url(&mut self, url: &str) {
        self.url = url.trim_end_matches('/').to_string();
    }

    pub async fn embed_batch(&self, model: &str, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        if texts.is_empty() {
            return Ok(vec![]);
        }
        let resp = self
            .client
            .post(format!("{}/api/embed", self.url))
            .json(&json!({ "model": model, "input": texts }))
            .timeout(std::time::Duration::from_secs(300))
            .send()
            .await
            .map_err(|e| format!("embed request failed: {}", e))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let t = resp.text().await.unwrap_or_default();
            return Err(format!("embed failed: {} {}", status, t));
        }
        let v: Value = resp
            .json()
            .await
            .map_err(|e| format!("embed parse failed: {}", e))?;
        let Some(arr) = v.get("embeddings").and_then(|e| e.as_array()) else {
            return Err("embed response missing embeddings".into());
        };
        let mut out = Vec::with_capacity(arr.len());
        for item in arr {
            let inner = item
                .as_array()
                .ok_or_else(|| "embedding row not array".to_string())?;
            let mut row = Vec::with_capacity(inner.len());
            for x in inner {
                let f = x.as_f64().ok_or_else(|| "embedding not number".to_string())? as f32;
                row.push(f);
            }
            out.push(row);
        }
        Ok(out)
    }

    pub async fn delete_model(&self, name: &str) -> Result<(), String> {
        let resp = self
            .client
            .post(format!("{}/api/delete", self.url))
            .json(&json!({ "name": name }))
            .timeout(std::time::Duration::from_secs(60))
            .send()
            .await
            .map_err(|e| format!("delete model request failed: {}", e))?;
        if resp.status().is_success() {
            Ok(())
        } else {
            let status = resp.status();
            let t = resp.text().await.unwrap_or_default();
            Err(format!("delete model: {} {}", status, t))
        }
    }

    /// Streams `/api/pull` JSON lines to the frontend as `ollama:model-downloading`.
    pub async fn pull_model_stream(&self, name: &str, app: &AppHandle) -> Result<(), String> {
        let resp = self
            .client
            .post(format!("{}/api/pull", self.url))
            .json(&json!({ "name": name, "stream": true }))
            .timeout(std::time::Duration::from_secs(7200))
            .send()
            .await
            .map_err(|e| format!("pull request failed: {}", e))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let t = resp.text().await.unwrap_or_default();
            return Err(format!("pull failed: {} {}", status, t));
        }

        let mut stream = resp.bytes_stream();
        let mut buf = Vec::new();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("pull stream: {}", e))?;
            buf.extend_from_slice(&chunk);
            while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                let line: Vec<u8> = buf.drain(..=pos).collect();
                let line = String::from_utf8_lossy(&line[..line.len().saturating_sub(1)]);
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                if let Ok(v) = serde_json::from_str::<Value>(line) {
                    let _ = app.emit("ollama:model-downloading", &v);
                }
            }
        }
        if !buf.is_empty() {
            let line = String::from_utf8_lossy(&buf);
            let line = line.trim();
            if !line.is_empty() {
                if let Ok(v) = serde_json::from_str::<Value>(line) {
                    let _ = app.emit("ollama:model-downloading", &v);
                }
            }
        }
        Ok(())
    }

    pub async fn check_status(&self) -> OllamaStatus {
        match self
            .client
            .get(format!("{}/api/tags", self.url))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                let tags: Value = resp.json().await.unwrap_or_default();
                let models = self.parse_models(&tags);
                OllamaStatus {
                    connected: true,
                    url: self.url.clone(),
                    models,
                }
            }
            _ => OllamaStatus {
                connected: false,
                url: self.url.clone(),
                models: vec![],
            },
        }
    }

    pub async fn list_models(&self) -> Result<Vec<OllamaModel>, String> {
        let resp = self
            .client
            .get(format!("{}/api/tags", self.url))
            .send()
            .await
            .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Ollama returned status: {}", resp.status()));
        }

        let tags: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        Ok(self.parse_models(&tags))
    }

    pub async fn get_model_info(&self, name: &str) -> Result<Value, String> {
        let resp = self
            .client
            .post(format!("{}/api/show", self.url))
            .json(&serde_json::json!({ "name": name }))
            .send()
            .await
            .map_err(|e| format!("Failed to get model info: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Ollama returned status: {}", resp.status()));
        }

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    fn parse_models(&self, tags: &Value) -> Vec<OllamaModel> {
        tags.get("models")
            .and_then(|m| m.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| {
                        let name = m.get("name")?.as_str()?.to_string();
                        let size = m.get("size")?.as_i64().unwrap_or(0);
                        let model_type = if name.contains("embed") {
                            "embedding".to_string()
                        } else {
                            "chat".to_string()
                        };
                        let details = m.get("details");
                        let parameter_size = details
                            .and_then(|d| d.get("parameter_size"))
                            .and_then(|p| p.as_str())
                            .unwrap_or("unknown")
                            .to_string();
                        Some(OllamaModel {
                            name,
                            model_type,
                            size,
                            parameter_size,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
}
