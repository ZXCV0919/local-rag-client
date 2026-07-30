use serde::Serialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

/// Chroma 0.4–0.6 常用 `/api/v1/*`；Chroma 1.x 服务多为 `/api/v2/tenants/.../collections`。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ChromaHttpApi {
    Auto,
    V1,
    V2,
}

const V2_TENANT: &str = "default_tenant";
const V2_DATABASE: &str = "default_database";
#[derive(Debug, Clone, Serialize)]
pub struct ChromaDbStatus {
    pub running: bool,
    pub url: String,
    pub port: u16,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChromaQueryResult {
    pub ids: Vec<String>,
    pub documents: Vec<String>,
    pub metadatas: Vec<Value>,
    pub distances: Vec<f32>,
}

fn parse_chroma_query_response(v: &Value) -> ChromaQueryResult {
    ChromaQueryResult {
        ids: first_nested_str_array(v, "ids"),
        documents: first_nested_str_array(v, "documents"),
        metadatas: first_nested_value_array(v, "metadatas"),
        distances: first_nested_f32_array(v, "distances"),
    }
}

fn first_nested_str_array(v: &Value, key: &str) -> Vec<String> {
    v.get(key)
        .and_then(|x| x.as_array())
        .and_then(|a| a.first())
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| match x {
                    Value::String(s) => Some(s.clone()),
                    Value::Null => None,
                    _ => x.as_str().map(|s| s.to_string()),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn first_nested_f32_array(v: &Value, key: &str) -> Vec<f32> {
    v.get(key)
        .and_then(|x| x.as_array())
        .and_then(|a| a.first())
        .and_then(|x| x.as_array())
        .map(|arr| arr.iter().filter_map(|x| x.as_f64().map(|f| f as f32)).collect())
        .unwrap_or_default()
}

fn first_nested_value_array(v: &Value, key: &str) -> Vec<Value> {
    v.get(key)
        .and_then(|x| x.as_array())
        .and_then(|a| a.first())
        .and_then(|x| x.as_array())
        .map(|arr| arr.to_vec())
        .unwrap_or_default()
}

pub struct ChromaDbInner {
    pub status: ChromaDbStatus,
    child: Option<Child>,
    client: reqwest::Client,
    data_dir: PathBuf,
    http_api: ChromaHttpApi,
}

#[derive(Clone)]
pub struct ChromaDbState(pub Arc<Mutex<ChromaDbInner>>);

/// Chroma HTTP helpers beyond delete/start are used from later embedding phases.
#[allow(dead_code)]
impl ChromaDbState {
    pub fn new(data_dir: PathBuf) -> Self {
        Self(Arc::new(Mutex::new(ChromaDbInner {
            status: ChromaDbStatus {
                running: false,
                url: String::new(),
                port: 0,
                last_error: None,
            },
            child: None,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("reqwest client"),
            data_dir,
            http_api: ChromaHttpApi::Auto,
        })))
    }

    pub async fn get_status(&self) -> ChromaDbStatus {
        self.0.lock().await.status.clone()
    }

    pub async fn auto_start(&self) {
        let default_url = "http://127.0.0.1:8000";
        let client = self.0.lock().await.client.clone();
        if heartbeat(&client, default_url).await {
            let mut g = self.0.lock().await;
            g.status = ChromaDbStatus {
                running: true,
                url: default_url.to_string(),
                port: 8000,
                last_error: None,
            };
            return;
        }

        let mut attempts = 0u32;
        while attempts < 3 {
            attempts += 1;
            match self.start_server().await {
                Ok(()) => return,
                Err(e) => {
                    let mut g = self.0.lock().await;
                    g.status.last_error = Some(e.clone());
                    drop(g);
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                }
            }
        }
    }

    pub async fn start_server(&self) -> Result<(), String> {
        let port = find_available_port(8100..8200)?;
        let data_dir = self.0.lock().await.data_dir.clone();
        std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

        let data_str = data_dir.to_string_lossy().to_string();

        let mut child = try_spawn_chroma(port, &data_str).await?;

        let url = format!("http://127.0.0.1:{}", port);
        let client = self.0.lock().await.client.clone();
        for _ in 0..90 {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            if heartbeat(&client, &url).await {
                let mut g = self.0.lock().await;
                g.child = Some(child);
                g.status = ChromaDbStatus {
                    running: true,
                    url: url.clone(),
                    port,
                    last_error: None,
                };
                return Ok(());
            }
        }

        let _ = child.kill().await;
        Err("ChromaDB did not become healthy in time".into())
    }

    pub async fn stop_server(&self) -> Result<(), String> {
        let mut g = self.0.lock().await;
        if let Some(mut c) = g.child.take() {
            let _ = c.kill().await;
        }
        g.status.running = false;
        g.status.url.clear();
        g.status.port = 0;
        Ok(())
    }

    pub async fn health_check(&self) -> bool {
        let url = self.0.lock().await.status.url.clone();
        if url.is_empty() {
            return false;
        }
        let client = self.0.lock().await.client.clone();
        heartbeat(&client, &url).await
    }

    /// Recursive on-disk usage of Chroma persistence directory (embedding store).
    pub async fn chroma_data_dir_bytes(&self) -> u64 {
        let dir = self.0.lock().await.data_dir.clone();
        tokio::task::spawn_blocking(move || {
            if !dir.exists() {
                return 0u64;
            }
            dir_disk_usage(&dir)
        })
        .await
        .unwrap_or(0)
    }

    /// Delete vector collections for each knowledge base UUID (collection name convention).
    pub async fn delete_collections_for_kb_ids(&self, ids: &[String]) {
        for id in ids {
            let _ = self.delete_collection(id).await;
        }
    }

    async fn base_url(&self) -> Result<String, String> {
        let g = self.0.lock().await;
        if !g.status.running || g.status.url.is_empty() {
            return Err("ChromaDB is not running".into());
        }
        Ok(g.status.url.trim_end_matches('/').to_string())
    }

    /// Detect v1 vs v2 HTTP API once per process (Chroma 1.x returns 405 on many `/api/v1/*` routes).
    async fn resolve_http_api(&self) -> Result<ChromaHttpApi, String> {
        let inner = self.0.lock().await;
        if inner.http_api != ChromaHttpApi::Auto {
            return Ok(inner.http_api);
        }
        let base = inner.status.url.trim_end_matches('/').to_string();
        if base.is_empty() {
            return Err("ChromaDB is not running".into());
        }
        let client = inner.client.clone();
        drop(inner);

        // Prefer v2 when available: some Chroma 1.x builds still answer v1 GET but reject v1 POST (405).
        let v2 = client
            .get(v2_list_collections_url(&base))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let mode = if v2.status().is_success() {
            ChromaHttpApi::V2
        } else {
            let v1 = client
                .get(format!("{}/api/v1/collections", base))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if v1.status().is_success() {
                ChromaHttpApi::V1
            } else {
                return Err(format!(
                    "Chroma HTTP API not recognized (list v2: {}, list v1: {}). Expected ChromaDB on {}",
                    v2.status(),
                    v1.status(),
                    base
                ));
            }
        };
        self.0.lock().await.http_api = mode;
        Ok(mode)
    }

    pub async fn create_collection(&self, kb_id: &str) -> Result<String, String> {
        let mode = self.resolve_http_api().await?;
        let base = self.base_url().await?;
        let client = self.0.lock().await.client.clone();
        match mode {
            ChromaHttpApi::V1 => {
                let body = json!({ "name": kb_id, "metadata": {} });
                let resp = client
                    .post(format!("{}/api/v1/collections", base))
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if resp.status().as_u16() == 409 {
                    return self.collection_id_for_name(kb_id).await;
                }
                if !resp.status().is_success() {
                    let status = resp.status();
                    let t = resp.text().await.unwrap_or_default();
                    return Err(format!("create_collection: {} {}", status, t));
                }
                let v: Value = resp.json().await.map_err(|e| e.to_string())?;
                collection_id_from_json(&v)
            }
            ChromaHttpApi::V2 => {
                let root = v2_list_collections_url(&base);
                let get_url = format!("{}/{}", root, kb_id);
                let get_resp = client
                    .get(&get_url)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if get_resp.status().is_success() {
                    let v: Value = get_resp.json().await.map_err(|e| e.to_string())?;
                    return collection_id_from_json(&v);
                }
                if get_resp.status().as_u16() != 404 {
                    let status = get_resp.status();
                    let t = get_resp.text().await.unwrap_or_default();
                    return Err(format!("create_collection (get): {} {}", status, t));
                }

                let body = json!({
                    "name": kb_id,
                    "metadata": Value::Null,
                    "configuration": Value::Null,
                    "schema": Value::Null,
                    "get_or_create": true,
                });
                let resp = client
                    .post(&root)
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    let t = resp.text().await.unwrap_or_default();
                    return Err(format!("create_collection: {} {}", status, t));
                }
                let v: Value = resp.json().await.map_err(|e| e.to_string())?;
                collection_id_from_json(&v)
            }
            ChromaHttpApi::Auto => Err("Chroma API mode not resolved".into()),
        }
    }

    pub async fn delete_collection(&self, kb_id: &str) -> Result<(), String> {
        let cid = match self.collection_id_for_name(kb_id).await {
            Ok(id) => id,
            Err(_) => return Ok(()),
        };
        let mode = self.resolve_http_api().await?;
        let base = self.base_url().await?;
        let client = self.0.lock().await.client.clone();
        let resp = match mode {
            ChromaHttpApi::V1 => {
                client
                    .delete(format!("{}/api/v1/collections/{}", base, cid))
                    .send()
                    .await
                    .map_err(|e| e.to_string())?
            }
            ChromaHttpApi::V2 => client
                .delete(v2_collection_by_id_url(&base, &cid))
                .send()
                .await
                .map_err(|e| e.to_string())?,
            ChromaHttpApi::Auto => return Err("Chroma API mode not resolved".into()),
        };
        if resp.status().is_success() || resp.status().as_u16() == 404 {
            Ok(())
        } else {
            let status = resp.status();
            let t = resp.text().await.unwrap_or_default();
            Err(format!("delete_collection: {} {}", status, t))
        }
    }

    pub async fn add_documents(
        &self,
        collection_id: &str,
        ids: Vec<String>,
        documents: Vec<String>,
        embeddings: Vec<Vec<f32>>,
        metadatas: Vec<Value>,
    ) -> Result<(), String> {
        let mode = self.resolve_http_api().await?;
        let base = self.base_url().await?;
        let body = json!({
            "ids": ids,
            "documents": documents,
            "embeddings": embeddings,
            "metadatas": metadatas,
        });
        let client = self.0.lock().await.client.clone();
        let url = match mode {
            ChromaHttpApi::V1 => {
                format!(
                    "{}/api/v1/collections/{}/upsert",
                    base, collection_id
                )
            }
            ChromaHttpApi::V2 => format!("{}/upsert", v2_collection_by_id_url(&base, collection_id)),
            ChromaHttpApi::Auto => return Err("Chroma API mode not resolved".into()),
        };
        let resp = client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status().is_success() {
            Ok(())
        } else {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            let body = body.trim();
            if body.is_empty() {
                Err(format!("add_documents: {}", status))
            } else {
                Err(format!("add_documents: {} {}", status, body))
            }
        }
    }

    pub async fn delete_documents(&self, kb_id: &str, ids: Vec<String>) -> Result<(), String> {
        if ids.is_empty() {
            return Ok(());
        }
        let cid = match self.collection_id_for_name(kb_id).await {
            Ok(id) => id,
            Err(_) => return Ok(()),
        };
        let mode = self.resolve_http_api().await?;
        let base = self.base_url().await?;
        let body = json!({ "ids": ids });
        let client = self.0.lock().await.client.clone();
        let url = match mode {
            ChromaHttpApi::V1 => format!(
                "{}/api/v1/collections/{}/delete",
                base, cid
            ),
            ChromaHttpApi::V2 => format!("{}/delete", v2_collection_by_id_url(&base, &cid)),
            ChromaHttpApi::Auto => return Err("Chroma API mode not resolved".into()),
        };
        let resp = client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status().is_success() || resp.status().as_u16() == 404 {
            Ok(())
        } else {
            let status = resp.status();
            let t = resp.text().await.unwrap_or_default();
            Err(format!("delete_documents: {} {}", status, t))
        }
    }

    pub async fn collection_id_for_name(&self, name: &str) -> Result<String, String> {
        let mode = self.resolve_http_api().await?;
        let base = self.base_url().await?;
        let client = self.0.lock().await.client.clone();
        match mode {
            ChromaHttpApi::V1 => {
                let resp = client
                    .get(format!("{}/api/v1/collections", base))
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if !resp.status().is_success() {
                    return Err(format!("list collections: {}", resp.status()));
                }
                let list: Value = resp.json().await.map_err(|e| e.to_string())?;
                collection_id_from_list_value(&list, name)
            }
            ChromaHttpApi::V2 => {
                let root = v2_list_collections_url(&base);
                let get_url = format!("{}/{}", root, name);
                let resp = client
                    .get(&get_url)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if resp.status().is_success() {
                    let v: Value = resp.json().await.map_err(|e| e.to_string())?;
                    return collection_id_from_json(&v);
                }
                if resp.status().as_u16() == 404 {
                    return Err(format!("collection '{}' not found", name));
                }
                // Fallback: some builds only support list, not get-by-name
                if resp.status().as_u16() == 405 {
                    return collection_id_for_name_v2_list(&client, &root, name).await;
                }
                Err(format!(
                    "get collection by name: {} {}",
                    resp.status(),
                    resp.text().await.unwrap_or_default()
                ))
            }
            ChromaHttpApi::Auto => Err("Chroma API mode not resolved".into()),
        }
    }

    pub async fn query_collection(
        &self,
        kb_name: &str,
        query_embedding: Vec<f32>,
        n_results: u32,
    ) -> Result<ChromaQueryResult, String> {
        let mode = self.resolve_http_api().await?;
        let cid = self.collection_id_for_name(kb_name).await?;
        let base = self.base_url().await?;
        let body = json!({
            "query_embeddings": [query_embedding],
            "n_results": n_results,
            "include": ["documents", "metadatas", "distances"],
        });
        let client = self.0.lock().await.client.clone();
        let url = match mode {
            ChromaHttpApi::V1 => {
                format!(
                    "{}/api/v1/collections/{}/query",
                    base, cid
                )
            }
            ChromaHttpApi::V2 => format!("{}/query", v2_collection_by_id_url(&base, &cid)),
            ChromaHttpApi::Auto => return Err("Chroma API mode not resolved".into()),
        };
        let resp = client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let t = resp.text().await.unwrap_or_default();
            return Err(format!("query_collection: {} {}", status, t));
        }
        let v: Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(parse_chroma_query_response(&v))
    }

    pub async fn get_collection_count(&self, kb_name: &str) -> Result<u32, String> {
        let mode = self.resolve_http_api().await?;
        let cid = self.collection_id_for_name(kb_name).await?;
        let base = self.base_url().await?;
        let client = self.0.lock().await.client.clone();
        let url = match mode {
            ChromaHttpApi::V1 => format!(
                "{}/api/v1/collections/{}/count",
                base, cid
            ),
            ChromaHttpApi::V2 => format!("{}/count", v2_collection_by_id_url(&base, &cid)),
            ChromaHttpApi::Auto => return Err("Chroma API mode not resolved".into()),
        };
        let resp = client
            .get(url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let t = resp.text().await.unwrap_or_default();
            return Err(format!("get_collection_count: {} {}", status, t));
        }
        let v: Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(v.get("count").and_then(|c| c.as_u64()).unwrap_or(0) as u32)
    }
}

fn v2_list_collections_url(base: &str) -> String {
    format!(
        "{}/api/v2/tenants/{}/databases/{}/collections",
        base.trim_end_matches('/'),
        V2_TENANT,
        V2_DATABASE
    )
}

fn v2_collection_by_id_url(base: &str, collection_id: &str) -> String {
    format!("{}/{}", v2_list_collections_url(base), collection_id)
}

fn collection_id_from_json(v: &Value) -> Result<String, String> {
    v.get("id")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "missing collection id".into())
}

fn collection_id_from_list_value(list: &Value, name: &str) -> Result<String, String> {
    let arr = json_collections_slice(list)?;
    for item in arr {
        if item.get("name").and_then(|n| n.as_str()) == Some(name) {
            return collection_id_from_json(item);
        }
    }
    Err(format!("collection '{}' not found", name))
}

async fn collection_id_for_name_v2_list(
    client: &reqwest::Client,
    root: &str,
    name: &str,
) -> Result<String, String> {
    let resp = client
        .get(root)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("list collections (v2): {}", resp.status()));
    }
    let list: Value = resp.json().await.map_err(|e| e.to_string())?;
    collection_id_from_list_value(&list, name)
}

fn json_collections_slice(list: &Value) -> Result<&Vec<Value>, String> {
    list.as_array()
        .or_else(|| list.get("data").and_then(|d| d.as_array()))
        .or_else(|| list.get("collections").and_then(|c| c.as_array()))
        .ok_or_else(|| "collections response not array".to_string())
}

async fn heartbeat(client: &reqwest::Client, base: &str) -> bool {
    let base = base.trim_end_matches('/');
    // Chroma 1.x 服务端多为 /api/v2/heartbeat；旧版为 /api/v1/heartbeat
    for path in ["/api/v2/heartbeat", "/api/v1/heartbeat"] {
        let ok = client
            .get(format!("{}{}", base, path))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);
        if ok {
            return true;
        }
    }
    false
}

fn dir_disk_usage(dir: &Path) -> u64 {
    fn walk(p: &Path, acc: &mut u64) {
        let Ok(entries) = std::fs::read_dir(p) else {
            return;
        };
        for e in entries.flatten() {
            let path = e.path();
            if path.is_dir() {
                walk(&path, acc);
            } else if let Ok(m) = e.metadata() {
                *acc += m.len();
            }
        }
    }
    let mut acc = 0u64;
    walk(dir, &mut acc);
    acc
}

fn find_available_port(range: std::ops::Range<u16>) -> Result<u16, String> {
    for p in range {
        if std::net::TcpListener::bind(("127.0.0.1", p)).is_ok() {
            return Ok(p);
        }
    }
    Err("no free port in range".into())
}

fn configure_stdio(cmd: &mut Command) {
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

async fn try_spawn_chroma(port: u16, data_str: &str) -> Result<Child, String> {
    // chromadb≥1.5：`python -m chromadb.cli.cli` 无 __main__，须调用 `app()` 或使用 `chroma` 可执行文件。
    const PY_LAUNCH: &str = "import os,sys; from chromadb.cli.cli import app; sys.argv=['chroma','run','--host','127.0.0.1','--port',os.environ['CHROMADB_SPAWN_PORT'],'--path',os.environ['CHROMADB_SPAWN_PATH']]; app()";

    let mut c = Command::new("chroma");
    c.args([
        "run",
        "--host",
        "127.0.0.1",
        "--port",
        &port.to_string(),
        "--path",
        data_str,
    ]);
    configure_stdio(&mut c);
    c.kill_on_drop(true);
    match c.spawn() {
        Ok(child) => return Ok(child),
        Err(_) => {}
    }

    let mut py = Command::new("python");
    py.env("CHROMADB_SPAWN_PORT", port.to_string())
        .env("CHROMADB_SPAWN_PATH", data_str)
        .args(["-c", PY_LAUNCH]);
    configure_stdio(&mut py);
    py.kill_on_drop(true);
    match py.spawn() {
        Ok(child) => return Ok(child),
        Err(_) => {}
    }

    let mut pyw = Command::new("py");
    pyw.env("CHROMADB_SPAWN_PORT", port.to_string())
        .env("CHROMADB_SPAWN_PATH", data_str)
        .args(["-c", PY_LAUNCH]);
    configure_stdio(&mut pyw);
    pyw.kill_on_drop(true);
    pyw.spawn().map_err(|e| format!("cannot spawn chromadb ({})", e))
}
