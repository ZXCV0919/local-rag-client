//! Chunk storage and FTS. Phase 2 only uses `list_by_document`; the rest is for ingestion/RAG.
#![allow(dead_code)]

use crate::db::models::{Chunk, NewChunk};
use crate::db::{get_pool, schema::chunks};
use crate::errors::AppError;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{Double, Integer, Text};
use diesel::QueryableByName;
use serde::Serialize;

#[derive(QueryableByName)]
struct ChunkIdRow {
    #[diesel(sql_type = Text)]
    id: String,
}

pub fn create_bulk(new_chunks: Vec<NewChunk>) -> Result<Vec<Chunk>, AppError> {
    if new_chunks.is_empty() {
        return Ok(vec![]);
    }
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    conn.transaction(|conn| {
        let ids: Vec<String> = new_chunks.iter().map(|c| c.id.clone()).collect();
        for row in &new_chunks {
            diesel::insert_into(chunks::table)
                .values(row)
                .execute(conn)?;
        }
        let mut loaded: Vec<Chunk> = chunks::table
            .filter(chunks::id.eq_any(&ids))
            .load::<Chunk>(conn)
            .map_err(AppError::from)?;
        let pos: std::collections::HashMap<String, usize> = ids
            .iter()
            .enumerate()
            .map(|(i, id)| (id.clone(), i))
            .collect();
        loaded.sort_by_key(|c| pos.get(&c.id).copied().unwrap_or(usize::MAX));
        Ok(loaded)
    })
}

pub fn list_by_document(doc_id: &str) -> Result<Vec<Chunk>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    chunks::table
        .filter(chunks::document_id.eq(doc_id))
        .order(chunks::chunk_index.asc())
        .load::<Chunk>(&mut conn)
        .map_err(AppError::from)
}

pub fn list_by_knowledge_base(kb_id: &str) -> Result<Vec<Chunk>, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    chunks::table
        .filter(chunks::knowledge_base_id.eq(kb_id))
        .order((chunks::document_id.asc(), chunks::chunk_index.asc()))
        .load::<Chunk>(&mut conn)
        .map_err(AppError::from)
}

pub fn get_by_id(id: &str) -> Result<Chunk, AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    chunks::table
        .find(id)
        .first::<Chunk>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::not_found(format!("Chunk {id} not found")),
            _ => AppError::db(e.to_string()),
        })
}

pub fn update_embedding_id(id: &str, embedding_id: &str) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    diesel::update(chunks::table.find(id))
        .set(chunks::embedding_id.eq(embedding_id))
        .execute(&mut conn)?;
    Ok(())
}

pub fn delete_by_document(doc_id: &str) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    diesel::delete(chunks::table.filter(chunks::document_id.eq(doc_id))).execute(&mut conn)?;
    Ok(())
}

pub fn delete_by_knowledge_base(kb_id: &str) -> Result<(), AppError> {
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;
    diesel::delete(chunks::table.filter(chunks::knowledge_base_id.eq(kb_id))).execute(&mut conn)?;
    Ok(())
}

/// BM25-based FTS hit for retrieval UI (higher `score` = better match).
#[derive(Debug, Clone, Serialize, QueryableByName)]
pub struct KeywordSearchHit {
    #[diesel(sql_type = Text)]
    pub chunk_id: String,
    #[diesel(sql_type = Text)]
    pub document_id: String,
    #[diesel(sql_type = Text)]
    pub knowledge_base_id: String,
    #[diesel(sql_type = Text)]
    pub content: String,
    #[diesel(sql_type = Text)]
    pub heading_path: String,
    #[diesel(sql_type = Text)]
    pub chunk_type: String,
    #[diesel(sql_type = Text)]
    pub file_name: String,
    #[diesel(sql_type = Double)]
    pub score: f64,
}

#[inline]
fn is_cjk_char(c: char) -> bool {
    matches!(
        c,
        '\u{3400}'..='\u{9fff}' | '\u{f900}'..='\u{faff}' | '\u{3007}'
    )
}

fn push_latin_run(buf: &mut String, out: &mut Vec<String>) {
    if !buf.is_empty() {
        out.push(buf.clone());
    }
    buf.clear();
}

/// Tokenize user query for FTS5: ASCII runs + individual CJK ideographs (SQLite unicode61 aligns with this for most CJK text).
fn fts_query_tokens(raw: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for segment in raw.split_whitespace() {
        let mut latin = String::new();
        for c in segment.chars() {
            if c.is_ascii_alphanumeric() || c == '_' {
                latin.push(c);
            } else if is_cjk_char(c) {
                push_latin_run(&mut latin, &mut out);
                out.push(c.to_string());
            } else {
                push_latin_run(&mut latin, &mut out);
            }
        }
        push_latin_run(&mut latin, &mut out);
    }
    if out.is_empty() && !raw.trim().is_empty() {
        let mut latin = String::new();
        for c in raw.trim().chars() {
            if c.is_ascii_alphanumeric() || c == '_' {
                latin.push(c);
            } else if is_cjk_char(c) {
                push_latin_run(&mut latin, &mut out);
                out.push(c.to_string());
            } else {
                push_latin_run(&mut latin, &mut out);
            }
        }
        push_latin_run(&mut latin, &mut out);
    }
    out.truncate(out.len().min(24));
    out
}

fn quote_fts_term(t: &str) -> String {
    let esc = t.replace('"', "\"\"");
    format!("\"{esc}\"")
}

/// OR-joined quoted terms for **recall** (AND is often too strict for Chinese and multi-keyword queries).
fn fts_match_pattern(raw: &str) -> Option<String> {
    let tokens = fts_query_tokens(raw);
    if tokens.is_empty() {
        return None;
    }
    Some(tokens.into_iter().map(|t| quote_fts_term(&t)).collect::<Vec<_>>().join(" OR "))
}

pub fn search_keyword_fts(kb_id: &str, query: &str, limit: i32) -> Result<Vec<KeywordSearchHit>, AppError> {
    let Some(match_expr) = fts_match_pattern(query) else {
        return Ok(vec![]);
    };
    let lim = limit.max(1).min(500);
    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;

    let rows: Vec<KeywordSearchHit> = sql_query(
        r#"
        SELECT
            c.id AS chunk_id,
            c.document_id AS document_id,
            c.knowledge_base_id AS knowledge_base_id,
            c.content AS content,
            c.heading_path AS heading_path,
            c.chunk_type AS chunk_type,
            d.file_name AS file_name,
            (-bm25(chunks_fts)) AS score
        FROM chunks_fts
        JOIN chunks c ON c.rowid = chunks_fts.rowid
        JOIN documents d ON c.document_id = d.id
        WHERE c.knowledge_base_id = ? AND chunks_fts MATCH ?
        ORDER BY bm25(chunks_fts)
        LIMIT ?
        "#,
    )
    .bind::<Text, _>(kb_id)
    .bind::<Text, _>(&match_expr)
    .bind::<Integer, _>(lim)
    .load(&mut conn)
    .map_err(AppError::from)?;

    if !rows.is_empty() {
        return Ok(rows);
    }

    keyword_substring_fallback(kb_id, query, lim, &mut *conn)
}

/// When FTS returns nothing (tokenization mismatch, rare symbols), cheap substring search on chunk body.
fn keyword_substring_fallback(
    kb_id: &str,
    query: &str,
    lim: i32,
    conn: &mut diesel::sqlite::SqliteConnection,
) -> Result<Vec<KeywordSearchHit>, AppError> {
    let needle = query.trim();
    if needle.len() < 2 || needle.len() > 256 {
        return Ok(vec![]);
    }
    let needle_lower = needle.to_lowercase();
    let pat = format!("%{}%", needle.replace('%', "\\%").replace('_', "\\_").replace('\\', "\\\\"));

    let rows: Vec<KeywordSearchHit> = sql_query(
        r#"
        SELECT
            c.id AS chunk_id,
            c.document_id AS document_id,
            c.knowledge_base_id AS knowledge_base_id,
            c.content AS content,
            c.heading_path AS heading_path,
            c.chunk_type AS chunk_type,
            d.file_name AS file_name,
            0.5 AS score
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE c.knowledge_base_id = ? AND c.content LIKE ? ESCAPE '\'
        ORDER BY instr(lower(c.content), ?) ASC, length(c.content) ASC
        LIMIT ?
        "#,
    )
    .bind::<Text, _>(kb_id)
    .bind::<Text, _>(&pat)
    .bind::<Text, _>(&needle_lower)
    .bind::<Integer, _>(lim)
    .load(conn)
    .map_err(AppError::from)?;

    Ok(rows)
}

pub fn search_fulltext(kb_id: &str, query: &str, limit: i32) -> Result<Vec<Chunk>, AppError> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let safe = q.replace('"', "");
    if safe.is_empty() {
        return Ok(vec![]);
    }

    let pool = get_pool().map_err(|e| AppError::db(e))?;
    let mut conn = pool.get()?;

    let id_rows: Vec<ChunkIdRow> = sql_query(
        r"
        SELECT chunks.id AS id
        FROM chunks_fts
        JOIN chunks ON chunks.rowid = chunks_fts.rowid
        WHERE chunks.knowledge_base_id = ? AND chunks_fts MATCH ?
        LIMIT ?
        ",
    )
    .bind::<Text, _>(kb_id)
    .bind::<Text, _>(&safe)
    .bind::<Integer, _>(limit)
    .load(&mut conn)
    .map_err(AppError::from)?;

    let ids: Vec<String> = id_rows.into_iter().map(|r| r.id).collect();
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let mut loaded: Vec<Chunk> = chunks::table
        .filter(chunks::id.eq_any(&ids))
        .load::<Chunk>(&mut conn)
        .map_err(AppError::from)?;

    let pos: std::collections::HashMap<String, usize> = ids
        .iter()
        .enumerate()
        .map(|(i, id)| (id.clone(), i))
        .collect();
    loaded.sort_by_key(|c| pos.get(&c.id).copied().unwrap_or(usize::MAX));

    Ok(loaded)
}
