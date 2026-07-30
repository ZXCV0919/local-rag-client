use crate::db::settings;
use crate::errors::AppError;
use crate::services::ollama::OllamaService;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

#[derive(Serialize)]
pub struct OllamaStatusResponse {
    pub connected: bool,
    pub url: String,
    pub model_count: usize,
    pub models: Vec<OllamaModelResponse>,
}

#[derive(Serialize)]
pub struct OllamaModelResponse {
    pub name: String,
    pub model_type: String,
    pub size: i64,
    pub parameter_size: String,
}

pub type OllamaHandle = Arc<Mutex<OllamaService>>;

#[tauri::command]
pub async fn check_ollama_status(
    service: State<'_, OllamaHandle>,
) -> Result<OllamaStatusResponse, AppError> {
    let s = service.lock().await;
    let status = s.check_status().await;
    Ok(OllamaStatusResponse {
        connected: status.connected,
        url: status.url,
        model_count: status.models.len(),
        models: status
            .models
            .into_iter()
            .map(|m| OllamaModelResponse {
                name: m.name,
                model_type: m.model_type,
                size: m.size,
                parameter_size: m.parameter_size,
            })
            .collect(),
    })
}

#[tauri::command]
pub async fn list_ollama_models(
    service: State<'_, OllamaHandle>,
) -> Result<Vec<OllamaModelResponse>, AppError> {
    let s = service.lock().await;
    let models = s
        .list_models()
        .await
        .map_err(|e| AppError::internal(e))?;
    Ok(models
        .into_iter()
        .map(|m| OllamaModelResponse {
            name: m.name,
            model_type: m.model_type,
            size: m.size,
            parameter_size: m.parameter_size,
        })
        .collect())
}

#[tauri::command]
pub async fn get_ollama_model_info(
    service: State<'_, OllamaHandle>,
    name: String,
) -> Result<Value, AppError> {
    let s = service.lock().await;
    s.get_model_info(&name)
        .await
        .map_err(|e| AppError::internal(e))
}

#[tauri::command]
pub async fn ollama_embed_batch(
    service: State<'_, OllamaHandle>,
    model: String,
    texts: Vec<String>,
    ollama_url: Option<String>,
) -> Result<Vec<Vec<f32>>, AppError> {
    let mut s = service.lock().await;
    if let Some(u) = ollama_url.filter(|x| !x.is_empty()) {
        s.set_base_url(&u);
    }
    s.embed_batch(&model, &texts)
        .await
        .map_err(AppError::internal)
}

#[tauri::command]
pub async fn pull_ollama_model(
    app: AppHandle,
    service: State<'_, OllamaHandle>,
    name: String,
    ollama_url: Option<String>,
) -> Result<(), AppError> {
    {
        let mut s = service.lock().await;
        if let Some(u) = ollama_url.filter(|x| !x.is_empty()) {
            s.set_base_url(&u);
        }
    }
    let s = service.lock().await;
    s.pull_model_stream(&name, &app)
        .await
        .map_err(AppError::internal)
}

#[tauri::command]
pub async fn delete_ollama_model(
    service: State<'_, OllamaHandle>,
    name: String,
    ollama_url: Option<String>,
) -> Result<(), AppError> {
    let mut s = service.lock().await;
    if let Some(u) = ollama_url.filter(|x| !x.is_empty()) {
        s.set_base_url(&u);
    }
    s.delete_model(&name).await.map_err(AppError::internal)
}

/// Persist Ollama base URL in settings and update the in-process client for subsequent commands.
#[tauri::command]
pub async fn set_ollama_url(service: State<'_, OllamaHandle>, url: String) -> Result<(), AppError> {
    let trimmed = url.trim().to_string();
    if trimmed.is_empty() {
        return Err(AppError::validation("Ollama URL is empty"));
    }
    settings::set("ollama_url", &serde_json::to_string(&trimmed).map_err(|e| AppError::internal(e.to_string()))?)?;
    let mut s = service.lock().await;
    s.set_base_url(&trimmed);
    Ok(())
}
