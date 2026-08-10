use crate::db::models::{KnowledgeBase, NewKnowledgeBase};
use crate::db::{get_pool, schema::knowledge_bases};
use crate::errors::AppError;
use diesel::prelude::*;
use uuid::Uuid;

pub fn list() -> Result<Vec<KnowledgeBase>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    knowledge_bases::table
        .order(knowledge_bases::created_at.desc())
        .load::<KnowledgeBase>(&mut conn)
        .map_err(AppError::from)
}

pub fn get_by_id(id: &str) -> Result<KnowledgeBase, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    knowledge_bases::table
        .find(id)
        .first::<KnowledgeBase>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                AppError::not_found(format!("Knowledge base {id} not found"))
            }
            _ => AppError::db(e.to_string()),
        })
}

pub fn create(
    name: &str,
    description: &str,
    embedding_model: &str,
    chunking_strategy: &str,
) -> Result<KnowledgeBase, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let id = Uuid::new_v4().to_string();
    let id_for_select = id.clone();
    let new_kb = NewKnowledgeBase {
        id,
        name: name.to_string(),
        description: description.to_string(),
        embedding_model: embedding_model.to_string(),
        chunking_strategy: chunking_strategy.to_string(),
    };
    diesel::insert_into(knowledge_bases::table)
        .values(&new_kb)
        .execute(&mut conn)?;
    knowledge_bases::table
        .find(id_for_select)
        .first::<KnowledgeBase>(&mut conn)
        .map_err(AppError::from)
}

#[allow(dead_code)]
pub fn delete(id: &str) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    diesel::delete(knowledge_bases::table.find(id)).execute(&mut conn)?;
    Ok(())
}

pub fn adjust_total_tokens(kb_id: &str, delta: i32) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let kb = knowledge_bases::table
        .find(kb_id)
        .first::<KnowledgeBase>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                AppError::not_found(format!("Knowledge base {kb_id} not found"))
            }
            _ => AppError::db(e.to_string()),
        })?;
    let next = (kb.total_tokens + delta).max(0);
    diesel::update(knowledge_bases::table.find(kb_id))
        .set(knowledge_bases::total_tokens.eq(next))
        .execute(&mut conn)?;
    Ok(())
}

pub fn adjust_document_count(kb_id: &str, delta: i32) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    let kb = knowledge_bases::table
        .find(kb_id)
        .first::<KnowledgeBase>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                AppError::not_found(format!("Knowledge base {kb_id} not found"))
            }
            _ => AppError::db(e.to_string()),
        })?;
    let next = (kb.document_count + delta).max(0);
    diesel::update(knowledge_bases::table.find(kb_id))
        .set(knowledge_bases::document_count.eq(next))
        .execute(&mut conn)?;
    Ok(())
}

pub fn update(
    id: &str,
    name: Option<&str>,
    description: Option<&str>,
) -> Result<KnowledgeBase, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    if let Some(n) = name {
        diesel::update(knowledge_bases::table.find(id))
            .set(knowledge_bases::name.eq(n))
            .execute(&mut conn)?;
    }
    if let Some(d) = description {
        diesel::update(knowledge_bases::table.find(id))
            .set(knowledge_bases::description.eq(d))
            .execute(&mut conn)?;
    }
    knowledge_bases::table
        .find(id)
        .first::<KnowledgeBase>(&mut conn)
        .map_err(AppError::from)
}
