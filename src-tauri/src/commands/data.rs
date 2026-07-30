use crate::db::admin;
use crate::db::{chunk, document, get_pool, knowledge_base};
use crate::errors::AppError;
use crate::services::chromadb::ChromaDbState;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStatistics {
    pub knowledge_base_count: i64,
    pub document_count: i64,
    pub chunk_count: i64,
    pub chroma_data_bytes: u64,
}

/// Export KB metadata, documents, and chunk text (no vectors).
#[tauri::command]
pub fn export_knowledge_base(id: String) -> Result<String, AppError> {
    let kb = knowledge_base::get_by_id(&id)?;
    let docs = document::list_by_knowledge_base(&id)?;
    let chunks = chunk::list_by_knowledge_base(&id)?;
    let exported = serde_json::json!({
        "format_version": 1,
        "knowledge_base": kb,
        "documents": docs,
        "chunks": chunks,
    });
    serde_json::to_string_pretty(&exported).map_err(|e| AppError::internal(e.to_string()))
}

#[tauri::command]
pub async fn get_storage_statistics(state: State<'_, ChromaDbState>) -> Result<StorageStatistics, AppError> {
    let pool = get_pool().map_err(AppError::db)?;
    let mut conn = pool.get()?;
    let (kb_c, doc_c, ch_c) = admin::aggregate_counts(&mut conn)?;
    let chroma_data_bytes = state.chroma_data_dir_bytes().await;
    Ok(StorageStatistics {
        knowledge_base_count: kb_c,
        document_count: doc_c,
        chunk_count: ch_c,
        chroma_data_bytes,
    })
}

/// Wipe all user data tables; **settings** preserved. Chroma collections cleared by KB id.
#[tauri::command]
pub async fn clear_all_application_data(state: State<'_, ChromaDbState>) -> Result<(), AppError> {
    let ids: Vec<String> = knowledge_base::list()?.into_iter().map(|k| k.id).collect();
    state.delete_collections_for_kb_ids(&ids).await;
    let pool = get_pool().map_err(AppError::db)?;
    let mut conn = pool.get()?;
    admin::purge_all_user_tables(&mut conn)?;
    Ok(())
}
