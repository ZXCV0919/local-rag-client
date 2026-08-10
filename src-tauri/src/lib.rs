mod commands;
mod db;
mod errors;
mod services;

use commands::ollama::OllamaHandle;
use commands::siliconflow::SiliconflowStreamState;
use services::chromadb::ChromaDbState;
use services::ollama::OllamaService;
use std::error::Error;
use std::io;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ollama: OllamaHandle = Arc::new(tokio::sync::Mutex::new(OllamaService::new(
        "http://localhost:11434",
    )));
    let ollama_url_bootstrap = Arc::clone(&ollama);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(ollama)
        .manage(Arc::new(SiliconflowStreamState::default()))
        .setup(move |app| {
            db::init_database(app.handle()).map_err(|msg| -> Box<dyn Error> {
                Box::new(io::Error::new(io::ErrorKind::Other, msg))
            })?;

            if let Ok(Some(raw)) = db::settings::get("ollama_url") {
                if let Ok(u) = serde_json::from_str::<String>(&raw) {
                    if !u.trim().is_empty() {
                        let g = Arc::clone(&ollama_url_bootstrap);
                        tauri::async_runtime::block_on(async move {
                            let mut s = g.lock().await;
                            s.set_base_url(&u);
                        });
                    }
                }
            }

            let chroma_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| -> Box<dyn Error> { Box::new(e) })?
                .join("chroma_db");
            let chroma = ChromaDbState::new(chroma_dir);
            app.manage(chroma.clone());
            tauri::async_runtime::spawn(async move {
                chroma.auto_start().await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::knowledge_base::list_knowledge_bases,
            commands::knowledge_base::get_knowledge_base,
            commands::knowledge_base::create_knowledge_base,
            commands::knowledge_base::delete_knowledge_base,
            commands::knowledge_base::update_knowledge_base,
            commands::document::import_document,
            commands::document::list_documents,
            commands::document::get_document,
            commands::document::update_document_status,
            commands::document::find_document_by_hash,
            commands::document::list_document_chunks,
            commands::document::get_chunk,
            commands::document::create_document_chunks,
            commands::document::set_chunk_embedding_ids,
            commands::document::delete_document,
            commands::file::read_file_bytes,
            commands::file::compute_file_hash,
            commands::file::get_file_info,
            commands::chat::create_conversation,
            commands::chat::list_conversations,
            commands::chat::get_conversation,
            commands::chat::add_message,
            commands::chat::list_messages,
            commands::chat::delete_conversation,
            commands::chat::update_conversation_title,
            commands::settings::get_setting,
            commands::settings::get_all_settings,
            commands::settings::set_setting,
            commands::siliconflow::siliconflow_api_key_configured,
            commands::siliconflow::siliconflow_chat_complete,
            commands::siliconflow::siliconflow_chat_stream,
            commands::siliconflow::siliconflow_chat_abort,
            commands::ollama::check_ollama_status,
            commands::ollama::list_ollama_models,
            commands::ollama::get_ollama_model_info,
            commands::ollama::ollama_embed_batch,
            commands::ollama::pull_ollama_model,
            commands::ollama::delete_ollama_model,
            commands::ollama::set_ollama_url,
            commands::data::export_knowledge_base,
            commands::data::get_storage_statistics,
            commands::data::clear_all_application_data,
            commands::chromadb::start_chromadb,
            commands::chromadb::stop_chromadb,
            commands::chromadb::get_chromadb_status,
            commands::chromadb::chromadb_health,
            commands::chromadb::chromadb_add_documents,
            commands::chromadb::chromadb_query,
            commands::chromadb::chromadb_delete_documents,
            commands::chromadb::chromadb_collection_count,
            commands::search::search_keyword,
            commands::source_preview::write_source_preview_cache,
            commands::source_preview::read_source_preview_cache,
            commands::source_preview::delete_source_preview_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
