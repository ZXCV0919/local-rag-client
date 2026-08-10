use crate::db::chunk;
use crate::db::models::{Chunk, Document, NewChunk};
use crate::db::{document, knowledge_base};
use crate::errors::AppError;
use crate::services::chromadb::ChromaDbState;
use serde::Deserialize;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[tauri::command]
pub async fn import_document(
    kb_id: String,
    file_path: String,
    file_name: String,
    file_type: String,
    file_size: i32,
    content_hash: String,
) -> Result<Document, AppError> {
    knowledge_base::get_by_id(&kb_id)?;
    let title = file_name
        .rsplit_once('.')
        .map(|(n, _)| n)
        .unwrap_or(&file_name)
        .to_string();
    let doc = document::create(
        &kb_id,
        &title,
        &file_name,
        &file_path,
        &file_type,
        file_size,
        &content_hash,
    )?;
    knowledge_base::adjust_document_count(&kb_id, 1)?;
    Ok(doc)
}

#[tauri::command]
pub fn list_documents(kb_id: String) -> Result<Vec<Document>, AppError> {
    document::list_by_knowledge_base(&kb_id)
}

#[tauri::command]
pub fn get_document(id: String) -> Result<Document, AppError> {
    document::get_by_id(&id)
}

#[tauri::command]
pub fn update_document_status(
    id: String,
    status: String,
    error_message: Option<String>,
) -> Result<Document, AppError> {
    document::update_status(&id, &status, error_message.as_deref())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkInput {
    pub chunk_index: i32,
    pub content: String,
    pub token_count: i32,
    pub char_start: i32,
    pub char_end: i32,
    pub heading_path: String,
    pub chunk_type: String,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChunksPayload {
    pub document_id: String,
    pub knowledge_base_id: String,
    pub chunks: Vec<ChunkInput>,
}

#[tauri::command]
pub fn find_document_by_hash(kb_id: String, content_hash: String) -> Result<Option<Document>, AppError> {
    document::find_by_hash(&kb_id, &content_hash)
}

#[tauri::command]
pub fn list_document_chunks(document_id: String) -> Result<Vec<Chunk>, AppError> {
    chunk::list_by_document(&document_id)
}

#[tauri::command]
pub fn get_chunk(id: String) -> Result<Chunk, AppError> {
    chunk::get_by_id(&id)
}

#[tauri::command]
pub fn create_document_chunks(payload: CreateChunksPayload) -> Result<Vec<Chunk>, AppError> {
    let doc = document::get_by_id(&payload.document_id)?;
    if doc.knowledge_base_id != payload.knowledge_base_id {
        return Err(AppError::validation("Knowledge base mismatch"));
    }
    let old_chunks = chunk::list_by_document(&payload.document_id)?;
    let old_sum: i32 = old_chunks.iter().map(|x| x.token_count).sum();
    chunk::delete_by_document(&payload.document_id)?;

    let mut new_rows: Vec<NewChunk> = Vec::new();
    let mut total_tokens: i32 = 0;
    for c in &payload.chunks {
        total_tokens += c.token_count;
        let metadata =
            serde_json::to_string(&c.metadata).unwrap_or_else(|_| "{}".to_string());
        new_rows.push(NewChunk {
            id: Uuid::new_v4().to_string(),
            document_id: payload.document_id.clone(),
            knowledge_base_id: payload.knowledge_base_id.clone(),
            chunk_index: c.chunk_index,
            content: c.content.clone(),
            token_count: c.token_count,
            char_start: c.char_start,
            char_end: c.char_end,
            heading_path: c.heading_path.clone(),
            chunk_type: c.chunk_type.clone(),
            metadata,
        });
    }
    let created = chunk::create_bulk(new_rows)?;
    document::update_chunk_count(&payload.document_id, created.len() as i32)?;
    let delta = total_tokens - old_sum;
    knowledge_base::adjust_total_tokens(&payload.knowledge_base_id, delta)?;
    document::update_status(&payload.document_id, "processing", None)?;
    Ok(created)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkEmbeddingId {
    pub chunk_id: String,
    pub embedding_id: String,
}

#[tauri::command]
pub fn set_chunk_embedding_ids(ids: Vec<ChunkEmbeddingId>) -> Result<(), AppError> {
    for row in &ids {
        chunk::update_embedding_id(&row.chunk_id, &row.embedding_id)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_document(
    app: AppHandle,
    id: String,
    chroma: State<'_, ChromaDbState>,
) -> Result<(), AppError> {
    let doc = document::get_by_id(&id)?;
    let chunks = chunk::list_by_document(&id)?;
    let token_sum: i32 = chunks.iter().map(|c| c.token_count).sum();
    let emb_ids: Vec<String> = chunks
        .iter()
        .map(|c| c.embedding_id.clone())
        .filter(|e| !e.is_empty())
        .collect();
    if !emb_ids.is_empty() {
        let _ = chroma.delete_documents(&doc.knowledge_base_id, emb_ids).await;
    }
    let _ = crate::services::source_preview_cache::delete_cache(&app, &id);
    document::delete(&id)?;
    knowledge_base::adjust_document_count(&doc.knowledge_base_id, -1)?;
    knowledge_base::adjust_total_tokens(&doc.knowledge_base_id, -token_sum)?;
    Ok(())
}