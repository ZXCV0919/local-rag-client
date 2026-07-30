use crate::errors::AppError;
use serde::Serialize;
use sha2::Digest;
use sha2::Sha256;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct FileInfo {
    pub file_name: String,
    pub file_size: i64,
    pub file_path: String,
}

#[tauri::command]
pub async fn read_file_bytes(file_path: String) -> Result<Vec<u8>, AppError> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(AppError::not_found(format!("File not found: {}", file_path)));
    }
    tokio::fs::read(&file_path)
        .await
        .map_err(|e| AppError::internal(format!("Failed to read file: {}", e)))
}

#[tauri::command]
pub async fn compute_file_hash(file_path: String) -> Result<String, AppError> {
    let bytes = read_file_bytes(file_path.clone()).await?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let result = hasher.finalize();
    Ok(hex::encode(result))
}

#[tauri::command]
pub async fn get_file_info(file_path: String) -> Result<FileInfo, AppError> {
    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|e| AppError::internal(format!("Failed to get file info: {}", e)))?;
    let file_name = Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    Ok(FileInfo {
        file_name,
        file_size: metadata.len() as i64,
        file_path: file_path.clone(),
    })
}
