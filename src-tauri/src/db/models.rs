use crate::db::schema::{chunks, conversations, documents, knowledge_bases, messages, settings};
use diesel::prelude::*;
use serde::Serialize;

#[derive(Debug, Queryable, Selectable, Serialize)]
#[diesel(table_name = knowledge_bases)]
pub struct KnowledgeBase {
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

#[derive(Debug, Insertable)]
#[diesel(table_name = knowledge_bases)]
pub struct NewKnowledgeBase {
    pub id: String,
    pub name: String,
    pub description: String,
    pub embedding_model: String,
    pub chunking_strategy: String,
}

#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = documents)]
pub struct Document {
    pub id: String,
    pub knowledge_base_id: String,
    pub title: String,
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: i32,
    pub content_hash: String,
    pub chunk_count: i32,
    pub status: String,
    pub error_message: String,
    pub imported_at: String,
    pub updated_at: String,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = documents)]
pub struct NewDocument {
    pub id: String,
    pub knowledge_base_id: String,
    pub title: String,
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: i32,
    pub content_hash: String,
    pub chunk_count: i32,
    pub status: String,
    pub error_message: String,
    pub imported_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = chunks)]
pub struct Chunk {
    pub id: String,
    pub document_id: String,
    pub knowledge_base_id: String,
    pub chunk_index: i32,
    pub content: String,
    pub token_count: i32,
    pub char_start: i32,
    pub char_end: i32,
    pub heading_path: String,
    pub chunk_type: String,
    pub embedding_id: String,
    pub metadata: String,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = chunks)]
pub struct NewChunk {
    pub id: String,
    pub document_id: String,
    pub knowledge_base_id: String,
    pub chunk_index: i32,
    pub content: String,
    pub token_count: i32,
    pub char_start: i32,
    pub char_end: i32,
    pub heading_path: String,
    pub chunk_type: String,
    pub metadata: String,
}

#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = conversations)]
pub struct Conversation {
    pub id: String,
    pub knowledge_base_id: String,
    pub title: String,
    pub llm_model: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = conversations)]
pub struct NewConversation {
    pub id: String,
    pub knowledge_base_id: String,
    pub title: String,
    pub llm_model: String,
}

#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = messages)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub referenced_chunks: String,
    pub token_count: i32,
    pub created_at: String,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = messages)]
pub struct NewMessage {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub referenced_chunks: String,
    pub token_count: i32,
}

#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = settings)]
pub struct SettingRow {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = settings)]
pub struct NewSetting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = settings)]
pub struct SettingUpdate {
    pub value: String,
}
