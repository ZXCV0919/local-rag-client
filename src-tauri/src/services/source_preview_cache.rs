use crate::errors::AppError;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocSectionPreview {
    pub heading: String,
    pub heading_path: String,
    pub heading_level: i32,
    pub content: String,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocContentPreview {
    pub title: String,
    pub file_type: String,
    pub sections: Vec<DocSectionPreview>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourcePreviewCacheFile {
    pub version: u32,
    pub document_id: String,
    pub content_hash: String,
    pub content: DocContentPreview,
}

fn sanitize_document_id(document_id: &str) -> Result<String, AppError> {
    if document_id.is_empty()
        || document_id.contains('/')
        || document_id.contains('\\')
        || document_id.contains("..")
    {
        return Err(AppError::validation("Invalid document id for source preview cache"));
    }
    Ok(document_id.to_string())
}

pub fn cache_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(e.to_string()))?
        .join("source_preview");
    std::fs::create_dir_all(&dir).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(dir)
}

pub fn cache_path(app: &AppHandle, document_id: &str) -> Result<PathBuf, AppError> {
    let id = sanitize_document_id(document_id)?;
    Ok(cache_dir(app)?.join(format!("{id}.json")))
}

pub fn write_cache(app: &AppHandle, file: &SourcePreviewCacheFile) -> Result<(), AppError> {
    if file.version != 1 {
        return Err(AppError::validation("Unsupported source preview cache version"));
    }
    let path = cache_path(app, &file.document_id)?;
    let json = serde_json::to_string(file).map_err(|e| AppError::internal(e.to_string()))?;
    std::fs::write(&path, json).map_err(|e| AppError::internal(e.to_string()))
}

pub fn read_cache(app: &AppHandle, document_id: &str) -> Result<Option<SourcePreviewCacheFile>, AppError> {
    let path = cache_path(app, document_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| AppError::internal(e.to_string()))?;
    match serde_json::from_str::<SourcePreviewCacheFile>(&raw) {
        Ok(parsed) if parsed.version == 1 => Ok(Some(parsed)),
        _ => {
            let _ = std::fs::remove_file(&path);
            Ok(None)
        }
    }
}

pub fn delete_cache(app: &AppHandle, document_id: &str) -> Result<(), AppError> {
    let path = cache_path(app, document_id)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| AppError::internal(e.to_string()))?;
    }
    Ok(())
}

pub fn delete_caches_for_document_ids(app: &AppHandle, ids: &[String]) {
    for id in ids {
        let _ = delete_cache(app, id);
    }
}

/// Remove the entire `source_preview/` cache directory and recreate it empty.
pub fn clear_all_caches(app: &AppHandle) -> Result<(), AppError> {
    let dir = cache_dir(app)?;
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| AppError::internal(e.to_string()))?;
    }
    cache_dir(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::sanitize_document_id;

    #[test]
    fn rejects_path_traversal() {
        assert!(sanitize_document_id("../x").is_err());
        assert!(sanitize_document_id("a/b").is_err());
        assert!(sanitize_document_id("ok-id").is_ok());
    }
}
