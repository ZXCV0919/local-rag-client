use crate::db::models::{Conversation, Message, NewConversation, NewMessage};
use crate::db::{get_pool, schema::{conversations, messages}};
use crate::errors::AppError;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::Text;
use uuid::Uuid;

fn touch_conversation_timestamp(conn: &mut diesel::sqlite::SqliteConnection, conv_id: &str) -> Result<(), diesel::result::Error> {
    sql_query("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?")
        .bind::<Text, _>(conv_id)
        .execute(conn)?;
    Ok(())
}

pub fn create(kb_id: &str, title: &str, llm_model: &str) -> Result<Conversation, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let id = Uuid::new_v4().to_string();
    let id_sel = id.clone();
    let row = NewConversation {
        id,
        knowledge_base_id: kb_id.to_string(),
        title: title.to_string(),
        llm_model: llm_model.to_string(),
    };
    diesel::insert_into(conversations::table)
        .values(&row)
        .execute(&mut conn)?;
    conversations::table
        .find(id_sel)
        .first::<Conversation>(&mut conn)
        .map_err(AppError::from)
}

pub fn get_by_id(id: &str) -> Result<Conversation, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    conversations::table
        .find(id)
        .first::<Conversation>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                AppError::not_found(format!("Conversation {id} not found"))
            }
            _ => AppError::db(e.to_string()),
        })
}

pub fn list_by_knowledge_base(kb_id: &str) -> Result<Vec<Conversation>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    conversations::table
        .filter(conversations::knowledge_base_id.eq(kb_id))
        .order(conversations::updated_at.desc())
        .load::<Conversation>(&mut conn)
        .map_err(AppError::from)
}

#[allow(dead_code)]
pub fn update_title(id: &str, title: &str) -> Result<Conversation, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    diesel::update(conversations::table.find(id))
        .set(conversations::title.eq(title))
        .execute(&mut conn)?;
    get_by_id(id)
}

pub fn delete(id: &str) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    diesel::delete(conversations::table.find(id)).execute(&mut conn)?;
    Ok(())
}

pub fn add_message(
    conv_id: &str,
    role: &str,
    content: &str,
    referenced_chunks: &str,
    token_count: i32,
) -> Result<Message, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let id = Uuid::new_v4().to_string();
    let id_sel = id.clone();
    let row = NewMessage {
        id,
        conversation_id: conv_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        referenced_chunks: referenced_chunks.to_string(),
        token_count,
    };
    diesel::insert_into(messages::table)
        .values(&row)
        .execute(&mut conn)?;
    touch_conversation_timestamp(&mut conn, conv_id).map_err(AppError::from)?;
    messages::table
        .find(id_sel)
        .first::<Message>(&mut conn)
        .map_err(AppError::from)
}

pub fn list_by_conversation(conv_id: &str) -> Result<Vec<Message>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    messages::table
        .filter(messages::conversation_id.eq(conv_id))
        .order(messages::created_at.asc())
        .load::<Message>(&mut conn)
        .map_err(AppError::from)
}

#[allow(dead_code)]
pub fn get_recent_messages(conv_id: &str, limit: i32) -> Result<Vec<Message>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let mut rows: Vec<Message> = messages::table
        .filter(messages::conversation_id.eq(conv_id))
        .order(messages::created_at.desc())
        .limit(limit as i64)
        .load::<Message>(&mut conn)
        .map_err(AppError::from)?;
    rows.reverse();
    Ok(rows)
}
