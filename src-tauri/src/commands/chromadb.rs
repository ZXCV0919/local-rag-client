use crate::errors::AppError;
use crate::services::chromadb::{ChromaDbState, ChromaQueryResult};
use serde::Serialize;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn start_chromadb(state: State<'_, ChromaDbState>) -> Result<crate::services::chromadb::ChromaDbStatus, AppError> {
    state
        .start_server()
        .await
        .map_err(|e| AppError::internal(e))?;
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn stop_chromadb(state: State<'_, ChromaDbState>) -> Result<(), AppError> {
    state.stop_server().await.map_err(|e| AppError::internal(e))
}

#[tauri::command]
pub async fn get_chromadb_status(state: State<'_, ChromaDbState>) -> Result<crate::services::chromadb::ChromaDbStatus, AppError> {
    Ok(state.get_status().await)
}

#[derive(Serialize)]
pub struct ChromaDbHealthResponse {
    pub responding: bool,
    pub status: crate::services::chromadb::ChromaDbStatus,
}

#[tauri::command]
pub async fn chromadb_health(state: State<'_, ChromaDbState>) -> Result<ChromaDbHealthResponse, AppError> {
    let responding = state.health_check().await;
    let status = state.get_status().await;
    Ok(ChromaDbHealthResponse {
        responding,
        status,
    })
}

#[tauri::command]
pub async fn chromadb_add_documents(
    state: State<'_, ChromaDbState>,
    knowledge_base_id: String,
    ids: Vec<String>,
    documents: Vec<String>,
    embeddings: Vec<Vec<f32>>,
    metadatas: Vec<Value>,
) -> Result<(), AppError> {
    let cid = match state.collection_id_for_name(&knowledge_base_id).await {
        Ok(id) => id,
        Err(_) => state
            .create_collection(&knowledge_base_id)
            .await
            .map_err(AppError::internal)?,
    };
    state
        .add_documents(&cid, ids, documents, embeddings, metadatas)
        .await
        .map_err(AppError::internal)
}

#[tauri::command]
pub async fn chromadb_query(
    state: State<'_, ChromaDbState>,
    knowledge_base_id: String,
    query_embedding: Vec<f32>,
    n_results: u32,
) -> Result<ChromaQueryResult, AppError> {
    state
        .query_collection(&knowledge_base_id, query_embedding, n_results)
        .await
        .map_err(AppError::internal)
}

#[tauri::command]
pub async fn chromadb_delete_documents(
    state: State<'_, ChromaDbState>,
    knowledge_base_id: String,
    ids: Vec<String>,
) -> Result<(), AppError> {
    state
        .delete_documents(&knowledge_base_id, ids)
        .await
        .map_err(AppError::internal)
}

#[tauri::command]
pub async fn chromadb_collection_count(
    state: State<'_, ChromaDbState>,
    knowledge_base_id: String,
) -> Result<u32, AppError> {
    state
        .get_collection_count(&knowledge_base_id)
        .await
        .map_err(AppError::internal)
}
