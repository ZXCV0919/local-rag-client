use crate::db::settings;
use crate::errors::AppError;
use std::collections::HashMap;

const SECRET_KEYS: &[&str] = &["siliconflow_api_key"];

fn parse_stored_string(raw: &str) -> String {
  match serde_json::from_str::<String>(raw) {
    Ok(s) => s,
    Err(_) => raw.trim().trim_matches('"').to_string(),
  }
}

fn mask_api_key(key: &str) -> String {
  let t = key.trim();
  if t.is_empty() {
    return String::new();
  }
  if t.len() <= 8 {
    return "••••••••".to_string();
  }
  let dots = "•".repeat(std::cmp::min(12, t.len() - 8));
  format!("{}{}{}", &t[..4], dots, &t[t.len() - 4..])
}

fn mask_setting_value_if_needed(key: &str, value: String) -> String {
  if !SECRET_KEYS.contains(&key) {
    return value;
  }
  let plain = parse_stored_string(&value);
  let masked = mask_api_key(&plain);
  serde_json::to_string(&masked).unwrap_or_else(|_| "\"\"".to_string())
}

#[tauri::command]
pub fn get_setting(key: String) -> Result<Option<String>, AppError> {
  let v = settings::get(&key)?;
  Ok(v.map(|raw| mask_setting_value_if_needed(&key, raw)))
}

#[tauri::command]
pub fn get_all_settings() -> Result<HashMap<String, String>, AppError> {
  let all = settings::get_all()?;
  Ok(
    all
      .into_iter()
      .map(|(k, v)| {
        let masked = mask_setting_value_if_needed(&k, v);
        (k, masked)
      })
      .collect(),
  )
}

#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<(), AppError> {
  settings::set(&key, &value)
}
