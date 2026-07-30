use crate::db::{knowledge_base, settings};
use crate::errors::AppError;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct KnowledgeBaseResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub embedding_model: String,
    pub chunking_strategy: String,
    pub document_count: i32,
    pub total_tokens: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::db::models::KnowledgeBase> for KnowledgeBaseResponse {
    fn from(kb: crate::db::models::KnowledgeBase) -> Self {
        Self {
            id: kb.id,
            name: kb.name,
            description: kb.description,
            embedding_model: kb.embedding_model,
            chunking_strategy: kb.chunking_strategy,
            document_count: kb.document_count,
            total_tokens: kb.total_tokens,
            created_at: kb.created_at,
            updated_at: kb.updated_at,
        }
    }
}

#[derive(Deserialize)]
pub struct CreateKnowledgeBaseRequest {
    pub name: String,
    pub description: Option<String>,
    pub embedding_model: Option<String>,
    pub chunking_strategy: Option<String>,
}

#[tauri::command]
pub fn list_knowledge_bases() -> Result<Vec<KnowledgeBaseResponse>, AppError> {
    knowledge_base::list().map(|kbs| kbs.into_iter().map(KnowledgeBaseResponse::from).collect())
}

#[tauri::command]
pub fn get_knowledge_base(id: String) -> Result<KnowledgeBaseResponse, AppError> {
    knowledge_base::get_by_id(&id).map(KnowledgeBaseResponse::from)
}

#[tauri::command]
pub fn create_knowledge_base(
    request: CreateKnowledgeBaseRequest,
) -> Result<KnowledgeBaseResponse, AppError> {
    let description = request.description.unwrap_or_default();
    let embedding_model = request
        .embedding_model
        .unwrap_or_else(|| "nomic-embed-text".to_string());
    let default_chunking = r#"{"max_chunk_size":800,"min_chunk_size":100,"overlap":50,"heading_as_context":true}"#.to_string();
    let chunking_strategy = match request.chunking_strategy {
        Some(ref s) if !s.trim().is_empty() => s.clone(),
        _ => settings::get("default_chunking_strategy")?
            .filter(|s| !s.trim().is_empty())
            .unwrap_or(default_chunking),
    };
    knowledge_base::create(&request.name, &description, &embedding_model, &chunking_strategy)
        .map(KnowledgeBaseResponse::from)
}

#[tauri::command]
pub fn delete_knowledge_base(id: String) -> Result<(), AppError> {
    knowledge_base::delete(&id)
}

#[tauri::command]
pub fn update_knowledge_base(
    id: String,
    name: Option<String>,
    description: Option<String>,
) -> Result<KnowledgeBaseResponse, AppError> {
    knowledge_base::update(&id, name.as_deref(), description.as_deref())
        .map(KnowledgeBaseResponse::from)
}
