//! Maintenance: aggregates and purge (settings preserved).

use crate::db::schema::{chunks, conversations, documents, knowledge_bases, messages, ollama_models};
use crate::errors::AppError;
use diesel::dsl::count_star;
use diesel::prelude::*;
pub fn aggregate_counts(conn: &mut SqliteConnection) -> Result<(i64, i64, i64), AppError> {
    let kb: i64 = knowledge_bases::table
        .select(count_star())
        .first(conn)
        .map_err(AppError::from)?;
    let doc: i64 = documents::table
        .select(count_star())
        .first(conn)
        .map_err(AppError::from)?;
    let ch: i64 = chunks::table
        .select(count_star())
        .first(conn)
        .map_err(AppError::from)?;
    Ok((kb, doc, ch))
}

/// Deletes all KB-related rows; leaves `settings` intact. Order respects FKs without relying on CASCADE.
pub fn purge_all_user_tables(conn: &mut SqliteConnection) -> Result<(), AppError> {
    conn
        .transaction(|conn| -> Result<(), diesel::result::Error> {
            diesel::delete(messages::table).execute(conn)?;
            diesel::delete(conversations::table).execute(conn)?;
            diesel::delete(chunks::table).execute(conn)?;
            diesel::delete(documents::table).execute(conn)?;
            diesel::delete(knowledge_bases::table).execute(conn)?;
            diesel::delete(ollama_models::table).execute(conn)?;
            Ok(())
        })
        .map_err(AppError::from)?;
    Ok(())
}

/// Delete one knowledge base and all nested rows (messages → conversations → chunks → documents → kb).
pub fn purge_knowledge_base(conn: &mut SqliteConnection, kb_id: &str) -> Result<(), AppError> {
    let kb_id = kb_id.to_string();
    conn
        .transaction(|conn| -> Result<(), diesel::result::Error> {
            let conv_ids: Vec<String> = conversations::table
                .filter(conversations::knowledge_base_id.eq(&kb_id))
                .select(conversations::id)
                .load(conn)?;
            if !conv_ids.is_empty() {
                diesel::delete(messages::table.filter(messages::conversation_id.eq_any(&conv_ids)))
                    .execute(conn)?;
            }
            diesel::delete(conversations::table.filter(conversations::knowledge_base_id.eq(&kb_id)))
                .execute(conn)?;
            diesel::delete(chunks::table.filter(chunks::knowledge_base_id.eq(&kb_id))).execute(conn)?;
            diesel::delete(documents::table.filter(documents::knowledge_base_id.eq(&kb_id)))
                .execute(conn)?;
            let n = diesel::delete(knowledge_bases::table.find(&kb_id)).execute(conn)?;
            if n == 0 {
                return Err(diesel::result::Error::NotFound);
            }
            Ok(())
        })
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                AppError::not_found(format!("Knowledge base {kb_id} not found"))
            }
            other => AppError::from(other),
        })?;
    Ok(())
}
