use crate::db::{conversation, models::{Conversation, Message}};
use crate::errors::AppError;
use serde::Serialize;

#[derive(Serialize)]
pub struct MessageResponse {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub referenced_chunks: Vec<String>,
    pub token_count: i32,
    pub created_at: String,
}

impl MessageResponse {
    fn from_row(m: Message) -> Self {
        let refs = parse_ref_chunks(&m.referenced_chunks);
        Self {
            id: m.id,
            conversation_id: m.conversation_id,
            role: m.role,
            content: m.content,
            referenced_chunks: refs,
            token_count: m.token_count,
            created_at: m.created_at,
        }
    }
}

fn parse_ref_chunks(raw: &str) -> Vec<String> {
    match serde_json::from_str::<serde_json::Value>(raw) {
        Ok(serde_json::Value::Array(items)) => items
            .into_iter()
            .map(|v| {
                v.as_str()
                    .map(String::from)
                    .unwrap_or_else(|| v.to_string())
            })
            .collect(),
        Ok(serde_json::Value::String(s)) => vec![s],
        _ => Vec::new(),
    }
}

#[derive(Serialize)]
pub struct ConversationWithMessages {
    pub conversation: Conversation,
    pub messages: Vec<MessageResponse>,
}

#[tauri::command]
pub fn create_conversation(
    kb_id: String,
    title: String,
    llm_model: String,
) -> Result<Conversation, AppError> {
    conversation::create(&kb_id, &title, &llm_model)
}

#[tauri::command]
pub fn list_conversations(kb_id: String) -> Result<Vec<Conversation>, AppError> {
    conversation::list_by_knowledge_base(&kb_id)
}

#[tauri::command]
pub fn get_conversation(id: String) -> Result<ConversationWithMessages, AppError> {
    let c = conversation::get_by_id(&id)?;
    let msgs = conversation::list_by_conversation(&id)?;
    Ok(ConversationWithMessages {
        conversation: c,
        messages: msgs.into_iter().map(MessageResponse::from_row).collect(),
    })
}

#[tauri::command]
pub fn add_message(
    conversation_id: String,
    role: String,
    content: String,
    referenced_chunks: String,
    token_count: i32,
) -> Result<MessageResponse, AppError> {
    conversation::add_message(
        &conversation_id,
        &role,
        &content,
        &referenced_chunks,
        token_count,
    )
    .map(MessageResponse::from_row)
}

#[tauri::command]
pub fn list_messages(conversation_id: String) -> Result<Vec<MessageResponse>, AppError> {
    conversation::list_by_conversation(&conversation_id)
        .map(|v| v.into_iter().map(MessageResponse::from_row).collect())
}

#[tauri::command]
pub fn delete_conversation(id: String) -> Result<(), AppError> {
    conversation::delete(&id)
}

#[tauri::command]
pub fn update_conversation_title(id: String, title: String) -> Result<Conversation, AppError> {
    conversation::update_title(&id, &title)
}
