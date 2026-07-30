diesel::table! {
    knowledge_bases (id) {
        id -> Text,
        name -> Text,
        description -> Text,
        embedding_model -> Text,
        chunking_strategy -> Text,
        document_count -> Integer,
        total_tokens -> Integer,
        created_at -> Text,
        updated_at -> Text,
    }
}

diesel::table! {
    documents (id) {
        id -> Text,
        knowledge_base_id -> Text,
        title -> Text,
        file_name -> Text,
        file_path -> Text,
        file_type -> Text,
        file_size -> Integer,
        content_hash -> Text,
        chunk_count -> Integer,
        status -> Text,
        error_message -> Text,
        imported_at -> Text,
        updated_at -> Text,
    }
}

diesel::table! {
    chunks (id) {
        id -> Text,
        document_id -> Text,
        knowledge_base_id -> Text,
        chunk_index -> Integer,
        content -> Text,
        token_count -> Integer,
        char_start -> Integer,
        char_end -> Integer,
        heading_path -> Text,
        chunk_type -> Text,
        embedding_id -> Text,
        metadata -> Text,
    }
}

diesel::table! {
    conversations (id) {
        id -> Text,
        knowledge_base_id -> Text,
        title -> Text,
        llm_model -> Text,
        created_at -> Text,
        updated_at -> Text,
    }
}

diesel::table! {
    messages (id) {
        id -> Text,
        conversation_id -> Text,
        role -> Text,
        content -> Text,
        referenced_chunks -> Text,
        token_count -> Integer,
        created_at -> Text,
    }
}

diesel::table! {
    ollama_models (id) {
        id -> Text,
        model_type -> Text,
        size -> Integer,
        status -> Text,
        last_checked -> Text,
    }
}

diesel::table! {
    settings (key) {
        key -> Text,
        value -> Text,
        updated_at -> Text,
    }
}
