use crate::errors::AppError;
use crate::services::source_preview_cache::{self, SourcePreviewCacheFile};
use serde::Deserialize;
use tauri::AppHandle;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteSourcePreviewPayload {
    pub version: u32,
    pub document_id: String,
    pub content_hash: String,
    pub content: source_preview_cache::DocContentPreview,
}

#[tauri::command]
pub fn write_source_preview_cache(
    app: AppHandle,
    payload: WriteSourcePreviewPayload,
) -> Result<(), AppError> {
    let file = SourcePreviewCacheFile {
        version: payload.version,
        document_id: payload.document_id,
        content_hash: payload.content_hash,
        content: payload.content,
    };
    source_preview_cache::write_cache(&app, &file)
}

#[tauri::command]
pub fn read_source_preview_cache(
    app: AppHandle,
    document_id: String,
) -> Result<Option<SourcePreviewCacheFile>, AppError> {
    source_preview_cache::read_cache(&app, &document_id)
}

#[tauri::command]
pub fn delete_source_preview_cache(app: AppHandle, document_id: String) -> Result<(), AppError> {
    source_preview_cache::delete_cache(&app, &document_id)
}
