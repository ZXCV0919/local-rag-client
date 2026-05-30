INSERT OR IGNORE INTO settings (key, value) VALUES (
    'default_chunking_strategy',
    '{"max_chunk_size":800,"min_chunk_size":100,"overlap":50,"heading_as_context":true}'
);
