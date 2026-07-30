use crate::db::chunk::{self, KeywordSearchHit};
use crate::errors::AppError;

#[tauri::command]
pub fn search_keyword(kb_id: String, query: String, limit: i32) -> Result<Vec<KeywordSearchHit>, AppError> {
    chunk::search_keyword_fts(&kb_id, &query, limit)
}
