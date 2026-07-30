use std::borrow::Cow;
use diesel::sqlite::SqliteConnection;
use diesel::connection::SimpleConnection;
use diesel::r2d2::{self, ConnectionManager, Pool};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

pub mod admin;
pub mod chunk;
pub mod conversation;
pub mod document;
pub mod knowledge_base;
pub mod migrations;
pub mod models;
pub mod schema;
pub mod settings;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

static DB_POOL: OnceLock<DbPool> = OnceLock::new();

pub fn init_database(app_handle: &AppHandle) -> Result<DbPool, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let db_path = app_dir.join("knowledge_base.db");
    let path_str = Cow::from(db_path.to_string_lossy().replace('\\', "/"));
    let db_url = format!("sqlite://{}", path_str);

    let manager = ConnectionManager::<SqliteConnection>::new(db_url.as_str());
    let pool = r2d2::Pool::builder()
        .max_size(10)
        .build(manager)
        .map_err(|e| format!("Failed to create connection pool: {}", e))?;

    {
        let mut conn = pool
            .get()
            .map_err(|e| format!("Failed to get connection: {}", e))?;
        conn.batch_execute(migrations::MIGRATIONS)
            .map_err(|e| format!("Failed to run migrations: {}", e))?;
    }

    DB_POOL
        .set(pool.clone())
        .map_err(|_| "Database already initialized".to_string())?;

    Ok(pool)
}

pub fn get_pool() -> Result<&'static DbPool, String> {
    DB_POOL.get().ok_or_else(|| "Database not initialized".to_string())
}
