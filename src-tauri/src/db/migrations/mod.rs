pub const MIGRATIONS: &str = concat!(
    include_str!("001_init.sql"),
    "\n\n",
    include_str!("002_default_chunking.sql"),
    "\n\n",
    include_str!("003_siliconflow_settings.sql"),
);