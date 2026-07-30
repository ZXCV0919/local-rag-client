use crate::db::models::{Document, NewDocument};
use crate::db::{get_pool, schema::documents};
use crate::errors::AppError;
use diesel::prelude::*;
use uuid::Uuid;

pub fn create(
    kb_id: &str,
    title: &str,
    file_name: &str,
    file_path: &str,
    file_type: &str,
    file_size: i32,
    content_hash: &str,
) -> Result<Document, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let id = Uuid::new_v4().to_string();
    let id_sel = id.clone();
    let ts = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let row = NewDocument {
        id,
        knowledge_base_id: kb_id.to_string(),
        title: title.to_string(),
        file_name: file_name.to_string(),
        file_path: file_path.to_string(),
        file_type: file_type.to_string(),
        file_size,
        content_hash: content_hash.to_string(),
        chunk_count: 0,
        status: "pending".to_string(),
        error_message: String::new(),
        imported_at: ts.clone(),
        updated_at: ts,
    };
    diesel::insert_into(documents::table)
        .values(&row)
        .execute(&mut conn)?;
    documents::table
        .find(id_sel)
        .first::<Document>(&mut conn)
        .map_err(AppError::from)
}

pub fn get_by_id(id: &str) -> Result<Document, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    documents::table
        .find(id)
        .first::<Document>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                AppError::not_found(format!("Document {id} not found"))
            }
            _ => AppError::db(e.to_string()),
        })
}

pub fn list_by_knowledge_base(kb_id: &str) -> Result<Vec<Document>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    documents::table
        .filter(documents::knowledge_base_id.eq(kb_id))
        .order(documents::imported_at.desc())
        .load::<Document>(&mut conn)
        .map_err(AppError::from)
}

pub fn update_status(
    id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<Document, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let msg = error_message.unwrap_or("");
    diesel::update(documents::table.find(id))
        .set((
            documents::status.eq(status),
            documents::error_message.eq(msg),
        ))
        .execute(&mut conn)?;
    get_by_id(id)
}

#[allow(dead_code)]
pub fn update_chunk_count(id: &str, count: i32) -> Result<Document, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    diesel::update(documents::table.find(id))
        .set(documents::chunk_count.eq(count))
        .execute(&mut conn)?;
    get_by_id(id)
}

pub fn delete(id: &str) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    diesel::delete(documents::table.find(id)).execute(&mut conn)?;
    Ok(())
}

pub fn find_by_hash(kb_id: &str, content_hash: &str) -> Result<Option<Document>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    documents::table
        .filter(documents::knowledge_base_id.eq(kb_id))
        .filter(documents::content_hash.eq(content_hash))
        .first::<Document>(&mut conn)
        .optional()
        .map_err(AppError::from)
}
