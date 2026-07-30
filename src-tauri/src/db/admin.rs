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
