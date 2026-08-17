# Chunk Source Preview Perf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the document detail 「全文对照」 panel fast for large docs by disk+memory caching of parsed `DocContent` and windowed (not full-document) DOM rendering.

**Architecture:** Persist preview `DocContent` under `app_data_dir/source_preview/{document_id}.json` at import/reprocess (and on cold-load miss). Frontend `loadDocumentSource` checks memory → disk → parse. `ChunkSourcePanel` defaults to a 3000-char context window around `findHighlightInFullText` matches; optional expand renders by section.

**Tech Stack:** Tauri 2 (Rust commands + `AppHandle` paths), React 19, Vitest, existing `source-preview.ts` / `chunk-display.ts` / `ChunkSourcePanel.tsx`.

**Spec:** `docs/superpowers/specs/2026-08-10-chunk-source-preview-perf-design.md`

## Global Constraints

- Do **not** use `chunk.char_start` / `char_end` as indices into `buildFullDocumentText` (they are concatenated-chunk offsets only).
- Highlight positioning must keep using `findHighlightInFullText` / `findHighlightRange`.
- Cache write failures must not fail import/reprocess (log + continue).
- Default UI mode is windowed; expand-full is opt-in.
- Do not virtualize left TOC or paginate `list_document_chunks` in this plan.
- Default context window radius: `CONTEXT = 3000` characters.
- Cache file `version: 1`; reject/ignore other versions by deleting and reparsing.

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/utils/chunk-display.ts` | Add `sliceContextWindow` |
| `src/utils/chunk-display-window.test.ts` | Unit tests for window slicing |
| `src-tauri/src/services/source_preview_cache.rs` | Path + read/write/delete JSON files |
| `src-tauri/src/services/mod.rs` | Export module |
| `src-tauri/src/commands/source_preview.rs` | Tauri commands |
| `src-tauri/src/commands/mod.rs` | Export commands module |
| `src-tauri/src/lib.rs` | Register invoke handlers |
| `src-tauri/src/commands/document.rs` | Delete cache on `delete_document` |
| `src-tauri/src/commands/knowledge_base.rs` | Delete caches before KB purge |
| `src/types/source-preview-cache.ts` | Shared TS cache file type |
| `src/services/document/source-preview.ts` | Memory map + 3-tier load + save helper |
| `src/services/document/source-preview.test.ts` | Load-path unit tests (mocked invoke) |
| `src/services/importer/index.ts` | Best-effort write after parse |
| `src/components/document/chunk-preview/ChunkSourcePanel.tsx` | Windowed + expand UI |
| `src/components/document/ChunkPreview.tsx` | Pass-through only if needed (likely unchanged) |

---

### Task 1: `sliceContextWindow` helper

**Files:**
- Modify: `src/utils/chunk-display.ts`
- Create: `src/utils/chunk-display-window.test.ts`

**Interfaces:**
- Consumes: none (pure)
- Produces:

```ts
export const SOURCE_PREVIEW_CONTEXT_CHARS = 3000;

export type TextRange = { start: number; end: number };

export type ContextWindow = {
  /** Absolute offsets into fullText */
  windowStart: number;
  windowEnd: number;
  text: string;
  /** Highlight relative to `text`, or null if no range */
  highlight: TextRange | null;
  hasPrefix: boolean;
  hasSuffix: boolean;
};

export function sliceContextWindow(
  fullText: string,
  range: TextRange | null,
  contextChars?: number,
): ContextWindow;
```

- [ ] **Step 1: Write the failing tests**

Create `src/utils/chunk-display-window.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sliceContextWindow } from './chunk-display';

describe('sliceContextWindow', () => {
  it('returns empty window for empty fullText', () => {
    const w = sliceContextWindow('', { start: 0, end: 1 });
    expect(w).toEqual({
      windowStart: 0,
      windowEnd: 0,
      text: '',
      highlight: null,
      hasPrefix: false,
      hasSuffix: false,
    });
  });

  it('when range is null, returns empty text and no highlight (caller shows chunk fallback)', () => {
    const w = sliceContextWindow('hello world', null);
    expect(w.text).toBe('');
    expect(w.highlight).toBeNull();
    expect(w.hasPrefix).toBe(false);
    expect(w.hasSuffix).toBe(false);
  });

  it('windows around a mid-string match with default context', () => {
    const full = 'A'.repeat(1000) + 'TARGET' + 'B'.repeat(1000);
    const start = 1000;
    const end = 1006;
    const w = sliceContextWindow(full, { start, end }, 50);
    expect(w.hasPrefix).toBe(true);
    expect(w.hasSuffix).toBe(true);
    expect(w.text.includes('TARGET')).toBe(true);
    expect(w.highlight).toEqual({
      start: start - w.windowStart,
      end: end - w.windowStart,
    });
    expect(w.text.slice(w.highlight!.start, w.highlight!.end)).toBe('TARGET');
  });

  it('clamps at start of document', () => {
    const full = 'HEAD' + 'x'.repeat(200);
    const w = sliceContextWindow(full, { start: 0, end: 4 }, 50);
    expect(w.windowStart).toBe(0);
    expect(w.hasPrefix).toBe(false);
    expect(w.text.startsWith('HEAD')).toBe(true);
  });

  it('clamps at end of document', () => {
    const full = 'x'.repeat(200) + 'TAIL';
    const start = full.length - 4;
    const w = sliceContextWindow(full, { start, end: full.length }, 50);
    expect(w.windowEnd).toBe(full.length);
    expect(w.hasSuffix).toBe(false);
    expect(w.text.endsWith('TAIL')).toBe(true);
  });

  it('expands windowStart backward to previous newline when possible', () => {
    const full = 'aaa\nbbbTARGETccc\nddd';
    const start = full.indexOf('TARGET');
    const end = start + 6;
    const w = sliceContextWindow(full, { start, end }, 2);
    // With tiny context, newline snap should still prefer starting at 'bbb...'
    expect(w.text.startsWith('bbb') || w.windowStart === full.lastIndexOf('\n', start) + 1).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/chunk-display-window.test.ts`

Expected: FAIL (export / function missing)

- [ ] **Step 3: Implement `sliceContextWindow`**

Append to `src/utils/chunk-display.ts`:

```ts
export const SOURCE_PREVIEW_CONTEXT_CHARS = 3000;

export type TextRange = { start: number; end: number };

export type ContextWindow = {
  windowStart: number;
  windowEnd: number;
  text: string;
  highlight: TextRange | null;
  hasPrefix: boolean;
  hasSuffix: boolean;
};

function snapStartToNewline(text: string, index: number): number {
  if (index <= 0) return 0;
  const nl = text.lastIndexOf('\n', index);
  if (nl >= 0 && nl >= index - 80) return nl + 1;
  return index;
}

function snapEndToNewline(text: string, index: number): number {
  if (index >= text.length) return text.length;
  const nl = text.indexOf('\n', index);
  if (nl >= 0 && nl <= index + 80) return nl;
  return index;
}

export function sliceContextWindow(
  fullText: string,
  range: TextRange | null,
  contextChars: number = SOURCE_PREVIEW_CONTEXT_CHARS,
): ContextWindow {
  if (!fullText || !range) {
    return {
      windowStart: 0,
      windowEnd: 0,
      text: '',
      highlight: null,
      hasPrefix: false,
      hasSuffix: false,
    };
  }

  const start = Math.max(0, Math.min(range.start, fullText.length));
  const end = Math.max(start, Math.min(range.end, fullText.length));

  let windowStart = Math.max(0, start - contextChars);
  let windowEnd = Math.min(fullText.length, end + contextChars);
  windowStart = snapStartToNewline(fullText, windowStart);
  windowEnd = snapEndToNewline(fullText, windowEnd);

  const text = fullText.slice(windowStart, windowEnd);
  return {
    windowStart,
    windowEnd,
    text,
    highlight: { start: start - windowStart, end: end - windowStart },
    hasPrefix: windowStart > 0,
    hasSuffix: windowEnd < fullText.length,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/chunk-display-window.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/chunk-display.ts src/utils/chunk-display-window.test.ts
git commit -m "$(cat <<'EOF'
feat: add sliceContextWindow for source preview panes

EOF
)"
```

---

### Task 2: Tauri source preview cache commands

**Files:**
- Create: `src-tauri/src/services/source_preview_cache.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Create: `src-tauri/src/commands/source_preview.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands/document.rs` (`delete_document`)
- Modify: `src-tauri/src/commands/knowledge_base.rs` (`delete_knowledge_base`)

**Interfaces:**
- Consumes: `AppHandle` path API; `document::list_by_knowledge_base` for KB delete
- Produces (invoke names, camelCase args from frontend):

```ts
// write
tauriCommand('write_source_preview_cache', {
  payload: {
    version: 1,
    documentId: string,
    contentHash: string,
    content: DocContent, // serde: title, file_type, sections[...]
  }
})

// read → null if missing
tauriCommand<SourcePreviewCacheFile | null>('read_source_preview_cache', {
  documentId: string
})

tauriCommand('delete_source_preview_cache', { documentId: string })
```

Rust payload uses `#[serde(rename_all = "camelCase")]` on command args; nested `DocContent` fields stay snake-ish matching existing TS `DocContent` (`file_type`, `heading_path`, etc. — **serialize with the same keys the frontend already uses**). Prefer defining Rust structs that match TS exactly:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourcePreviewCacheFile {
    pub version: u32,
    pub document_id: String,
    pub content_hash: String,
    pub content: DocContentPreview,
}
```

Frontend will send/receive **snake_case JSON keys** for the file body (`document_id`, `content_hash`, `file_type`, …) to match on-disk format in the spec. Command wrappers may use camelCase only for top-level invoke args (`documentId`, `payload`).

- [ ] **Step 1: Add `source_preview_cache` service**

`src-tauri/src/services/mod.rs` — add `pub mod source_preview_cache;`

`src-tauri/src/services/source_preview_cache.rs`:

```rust
use crate::errors::AppError;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocSectionPreview {
    pub heading: String,
    pub heading_path: String,
    pub heading_level: i32,
    pub content: String,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocContentPreview {
    pub title: String,
    pub file_type: String,
    pub sections: Vec<DocSectionPreview>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourcePreviewCacheFile {
    pub version: u32,
    pub document_id: String,
    pub content_hash: String,
    pub content: DocContentPreview,
}

fn sanitize_document_id(document_id: &str) -> Result<String, AppError> {
    if document_id.is_empty()
        || document_id.contains('/')
        || document_id.contains('\\')
        || document_id.contains("..")
    {
        return Err(AppError::validation("Invalid document id for source preview cache"));
    }
    Ok(document_id.to_string())
}

pub fn cache_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal(e.to_string()))?
        .join("source_preview");
    std::fs::create_dir_all(&dir).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(dir)
}

pub fn cache_path(app: &AppHandle, document_id: &str) -> Result<PathBuf, AppError> {
    let id = sanitize_document_id(document_id)?;
    Ok(cache_dir(app)?.join(format!("{id}.json")))
}

pub fn write_cache(app: &AppHandle, file: &SourcePreviewCacheFile) -> Result<(), AppError> {
    if file.version != 1 {
        return Err(AppError::validation("Unsupported source preview cache version"));
    }
    let path = cache_path(app, &file.document_id)?;
    let json = serde_json::to_string(file).map_err(|e| AppError::internal(e.to_string()))?;
    std::fs::write(&path, json).map_err(|e| AppError::internal(e.to_string()))
}

pub fn read_cache(app: &AppHandle, document_id: &str) -> Result<Option<SourcePreviewCacheFile>, AppError> {
    let path = cache_path(app, document_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| AppError::internal(e.to_string()))?;
    match serde_json::from_str::<SourcePreviewCacheFile>(&raw) {
        Ok(parsed) if parsed.version == 1 => Ok(Some(parsed)),
        _ => {
            let _ = std::fs::remove_file(&path);
            Ok(None)
        }
    }
}

pub fn delete_cache(app: &AppHandle, document_id: &str) -> Result<(), AppError> {
    let path = cache_path(app, document_id)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| AppError::internal(e.to_string()))?;
    }
    Ok(())
}

pub fn delete_caches_for_document_ids(app: &AppHandle, ids: &[String]) {
    for id in ids {
        let _ = delete_cache(app, id);
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_document_id;

    #[test]
    fn rejects_path_traversal() {
        assert!(sanitize_document_id("../x").is_err());
        assert!(sanitize_document_id("a/b").is_err());
        assert!(sanitize_document_id("ok-id").is_ok());
    }
}
```

- [ ] **Step 2: Add commands module**

`src-tauri/src/commands/source_preview.rs`:

```rust
use crate::errors::AppError;
use crate::services::source_preview_cache::{self, SourcePreviewCacheFile};
use serde::Deserialize;
use tauri::AppHandle;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteSourcePreviewPayload {
    pub version: u32,
    pub document_id: String,
    pub content_hash: String,
    pub content: source_preview_cache::DocContentPreview,
}

#[tauri::command]
pub fn write_source_preview_cache(
    app: AppHandle,
    payload: WriteSourcePreviewPayload,
) -> Result<(), AppError> {
    let file = SourcePreviewCacheFile {
        version: payload.version,
        document_id: payload.document_id,
        content_hash: payload.content_hash,
        content: payload.content,
    };
    source_preview_cache::write_cache(&app, &file)
}

#[tauri::command]
pub fn read_source_preview_cache(
    app: AppHandle,
    document_id: String,
) -> Result<Option<SourcePreviewCacheFile>, AppError> {
    source_preview_cache::read_cache(&app, &document_id)
}

#[tauri::command]
pub fn delete_source_preview_cache(app: AppHandle, document_id: String) -> Result<(), AppError> {
    source_preview_cache::delete_cache(&app, &document_id)
}
```

Register in `commands/mod.rs`: `pub mod source_preview;`

In `lib.rs` invoke handler list add:

```rust
commands::source_preview::write_source_preview_cache,
commands::source_preview::read_source_preview_cache,
commands::source_preview::delete_source_preview_cache,
```

- [ ] **Step 3: Hook deletes**

In `delete_document` **before** `document::delete`, with `app: AppHandle` added to the command signature:

```rust
let _ = crate::services::source_preview_cache::delete_cache(&app, &id);
```

In `delete_knowledge_base`, **before** `purge_knowledge_base`:

```rust
let docs = crate::db::document::list_by_knowledge_base(&id).unwrap_or_default();
let ids: Vec<String> = docs.into_iter().map(|d| d.id).collect();
crate::services::source_preview_cache::delete_caches_for_document_ids(&app, &ids);
```

Add `app: AppHandle` to `delete_knowledge_base` signature.

- [ ] **Step 4: Compile check**

Run: `cd src-tauri && cargo test sanitize -- --nocapture`  
(or `cargo test source_preview_cache`)

Expected: PASS for `rejects_path_traversal`

Run: `cd src-tauri && cargo check`

Expected: success

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/source_preview_cache.rs src-tauri/src/services/mod.rs \
  src-tauri/src/commands/source_preview.rs src-tauri/src/commands/mod.rs \
  src-tauri/src/lib.rs src-tauri/src/commands/document.rs \
  src-tauri/src/commands/knowledge_base.rs
git commit -m "$(cat <<'EOF'
feat: add source preview disk cache commands

EOF
)"
```

---

### Task 3: Frontend load/save with memory + disk tiers

**Files:**
- Create: `src/types/source-preview-cache.ts`
- Modify: `src/services/document/source-preview.ts`
- Create: `src/services/document/source-preview.test.ts`

**Interfaces:**
- Consumes: Tauri commands from Task 2; existing `parseDocument`, `mergeSectionsForPreview`
- Produces:

```ts
export type SourcePreviewCacheFile = {
  version: 1;
  document_id: string;
  content_hash: string;
  content: DocContent;
};

export async function saveDocumentSourceCache(
  documentId: string,
  contentHash: string,
  content: DocContent,
): Promise<void>; // best-effort; swallows errors after console.warn

export async function loadDocumentSource(doc: Document): Promise<DocContent | null>;

/** Test-only / rare: clear memory map */
export function clearSourcePreviewMemoryCache(): void;
```

- [ ] **Step 1: Write failing tests for load path**

`src/services/document/source-preview.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('../../hooks/useDatabase', () => ({
  tauriCommand: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('../parser', () => ({
  getSupportedType: () => 'md',
  parseDocument: vi.fn(async () => ({
    content: {
      title: 'parsed',
      file_type: 'md',
      sections: [{ heading: 'H', heading_path: 'H', heading_level: 1, content: 'body', content_type: 'text' }],
    },
    metadata: {},
  })),
}));

import {
  clearSourcePreviewMemoryCache,
  loadDocumentSource,
  saveDocumentSourceCache,
} from './source-preview';
import type { Document } from '../../types/document';

const doc = {
  id: 'doc-1',
  content_hash: 'hash-a',
  file_name: 'a.md',
  file_path: '/tmp/a.md',
  file_type: 'md',
} as Document;

describe('loadDocumentSource', () => {
  beforeEach(() => {
    clearSourcePreviewMemoryCache();
    invokeMock.mockReset();
  });

  it('returns memory cache on second call without disk/parse', async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'read_source_preview_cache') {
        return {
          version: 1,
          document_id: 'doc-1',
          content_hash: 'hash-a',
          content: {
            title: 'cached',
            file_type: 'md',
            sections: [{ heading: '', heading_path: '', heading_level: 0, content: 'x', content_type: 'text' }],
          },
        };
      }
      throw new Error(`unexpected ${cmd}`);
    });
    const first = await loadDocumentSource(doc);
    expect(first?.title).toBe('cached');
    invokeMock.mockClear();
    const second = await loadDocumentSource(doc);
    expect(second?.title).toBe('cached');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('ignores disk cache when content_hash mismatches and falls back to parse', async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'read_source_preview_cache') {
        return {
          version: 1,
          document_id: 'doc-1',
          content_hash: 'old-hash',
          content: { title: 'stale', file_type: 'md', sections: [] },
        };
      }
      if (cmd === 'delete_source_preview_cache') return null;
      if (cmd === 'read_file_bytes') return Array.from(new TextEncoder().encode('# hi'));
      if (cmd === 'write_source_preview_cache') return null;
      throw new Error(`unexpected ${cmd}`);
    });
    const result = await loadDocumentSource(doc);
    expect(result?.title).toBe('parsed');
    expect(invokeMock).toHaveBeenCalledWith(
      'delete_source_preview_cache',
      expect.objectContaining({ documentId: 'doc-1' }),
    );
  });
});

describe('saveDocumentSourceCache', () => {
  beforeEach(() => {
    clearSourcePreviewMemoryCache();
    invokeMock.mockReset();
  });

  it('writes cache and seeds memory', async () => {
    invokeMock.mockResolvedValue(null);
    await saveDocumentSourceCache('doc-1', 'hash-a', {
      title: 't',
      file_type: 'md',
      sections: [],
    });
    expect(invokeMock).toHaveBeenCalledWith(
      'write_source_preview_cache',
      expect.objectContaining({
        payload: expect.objectContaining({
          version: 1,
          documentId: 'doc-1',
          contentHash: 'hash-a',
        }),
      }),
    );
    invokeMock.mockClear();
    const loaded = await loadDocumentSource(doc);
    expect(loaded?.title).toBe('t');
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
```

Adjust mock argument shapes to **exactly** match whatever `saveDocumentSourceCache` / `loadDocumentSource` pass to `tauriCommand` after implementation (if you keep snake_case inside `payload` matching Rust `WriteSourcePreviewPayload` with camelCase rename, use `documentId`/`contentHash` at payload top level).

**Preferred invoke payload (align with Task 2 camelCase):**

```ts
await tauriCommand('write_source_preview_cache', {
  payload: {
    version: 1,
    documentId,
    contentHash,
    content, // DocContent with file_type / heading_path keys as today
  },
});
```

Rust `WriteSourcePreviewPayload` must deserialize `content` fields using the **same** property names as TS `DocContent` (`file_type`, not `fileType`). Use `#[serde(rename_all = "snake_case")]` only if needed on nested structs; TS already uses snake_case for those fields.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/services/document/source-preview.test.ts`

Expected: FAIL (missing exports / behavior)

- [ ] **Step 3: Implement types + service**

`src/types/source-preview-cache.ts`:

```ts
import type { DocContent } from './chunk';

export type SourcePreviewCacheFile = {
  version: 1;
  document_id: string;
  content_hash: string;
  content: DocContent;
};
```

Rewrite `src/services/document/source-preview.ts` to:

1. Keep `mergeSectionsForPreview` / `isDegenerateSectionList` as today.
2. Module-level `Map<string, { contentHash: string; content: DocContent }>`.
3. `saveDocumentSourceCache`: update memory; `try/catch` write via tauri; `console.warn` on failure.
4. `loadDocumentSource`:
   - unsupported type → `null`
   - memory hit (id + hash) → return
   - `read_source_preview_cache`; if hash match → memory + return
   - if hash mismatch → `delete_source_preview_cache` then continue
   - `read_file_bytes` + `parseDocument` + `mergeSectionsForPreview` → memory + best-effort write → return
   - catch → `console.error` + `null`

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/services/document/source-preview.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/source-preview-cache.ts src/services/document/source-preview.ts \
  src/services/document/source-preview.test.ts
git commit -m "$(cat <<'EOF'
feat: load document source via memory and disk cache

EOF
)"
```

---

### Task 4: Write cache during import / reprocess

**Files:**
- Modify: `src/services/importer/index.ts`

**Interfaces:**
- Consumes: `parseAndChunkDocument` → `{ parsed, chunks }`; `saveDocumentSourceCache`; `mergeSectionsForPreview`
- Produces: side effect only (cache files after successful parse, before or after `create_document_chunks`)

- [ ] **Step 1: Locate both call sites**

In `importDocument` (or equivalent) and `reprocessDocument`, change:

```ts
const { chunks } = await parseAndChunkDocument(...);
```

to:

```ts
const { parsed, chunks } = await parseAndChunkDocument(...);
```

Immediately after parse (still inside try, before or after saving chunks):

```ts
const previewContent = {
  ...parsed.content,
  sections: mergeSectionsForPreview(parsed.content.sections),
};
await saveDocumentSourceCache(docId, /* content hash for this doc */, previewContent);
```

For **new import**: use the `content_hash` already computed for `create_document`.  
For **reprocess**: use `doc.content_hash`.

Import:

```ts
import { mergeSectionsForPreview, saveDocumentSourceCache } from '../document/source-preview';
```

`saveDocumentSourceCache` already swallows errors — still `await` it so memory is warm for immediate preview.

- [ ] **Step 2: Verify TypeScript build**

Run: `npx tsc --noEmit`

Expected: no errors from importer changes

- [ ] **Step 3: Commit**

```bash
git add src/services/importer/index.ts
git commit -m "$(cat <<'EOF'
feat: persist source preview cache on import and reprocess

EOF
)"
```

---

### Task 5: Windowed `ChunkSourcePanel` + expand full

**Files:**
- Modify: `src/components/document/chunk-preview/ChunkSourcePanel.tsx`

**Interfaces:**
- Consumes: `buildFullDocumentText`, `findHighlightInFullText`, `sliceContextWindow`, `SOURCE_PREVIEW_CONTEXT_CHARS`, `chunkHeadingLabel`
- Produces: UI behavior only

- [ ] **Step 1: Add expand state and window rendering**

Replace the single full-text article body with this behavior:

1. `const [expanded, setExpanded] = useState(false);`
2. Reset `expanded` to `false` when `source` identity / `doc` changes (effect on `source` reference or a `key` from parent — simplest: `useEffect(() => setExpanded(false), [source]);`).
3. Memo:

```ts
const fullText = useMemo(
  () => (source ? buildFullDocumentText(source.sections) : ''),
  [source],
);
const highlightRange = useMemo(
  () => (fullText && activeChunk ? findHighlightInFullText(fullText, activeChunk) : null),
  [fullText, activeChunk],
);
const windowed = useMemo(
  () => sliceContextWindow(fullText, highlightRange, SOURCE_PREVIEW_CONTEXT_CHARS),
  [fullText, highlightRange],
);
```

4. Header actions: button toggling `展开全文` / `收起`.

5. **Default (!expanded && highlightRange):**
   - Show `hasPrefix` hint: `… 前文已省略`
   - `renderHighlighted(windowed.text, windowed.highlight!, highlightRef, activeChunk.id)`
   - Show `hasSuffix` hint: `后文已省略 …`
   - Keep existing scroll-to-mark `useLayoutEffect` (targets mark inside window — still works)

6. **expanded:**
   - Map `source.sections` to blocks:

```tsx
{source.sections.map((section, idx) => {
  const block = /* same heading+content rules as buildFullDocumentText single section */;
  // If highlight overlaps this block in fullText, split with mark; else plain text
})}
```

   Practical approach: keep computing `fullText` + `highlightRange`; when expanded, still render **one** article but built from **per-section `<div key={idx}>`** children whose concatenated text equals `fullText` (join with `\n\n`). Place the `<mark>` only in the section that contains `highlightRange.start` by tracking a running `offset` while mapping sections.

7. **!highlightRange:** do **not** render `fullText`. Show status text + `activeChunk.content` aside (existing fallback). Optionally still allow expand to browse sections without highlight.

8. Loading / empty states unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Manual smoke (required before claiming done)**

1. Open a document with many chunks → middle panel skeleton should clear quickly on second open of same doc (disk/memory cache).
2. Click several TOC items rapidly → only a window of text updates; highlight moves.
3. Click 展开全文 / 收起.
4. Delete document → no leftover requirement beyond best-effort cache delete (verify command path if possible).

- [ ] **Step 4: Commit**

```bash
git add src/components/document/chunk-preview/ChunkSourcePanel.tsx
git commit -m "$(cat <<'EOF'
feat: window source preview panel with optional full expand

EOF
)"
```

---

### Task 6: Regression suite + plan checkbox pass

**Files:** none new (verification)

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test -- src/utils/chunk-display-window.test.ts src/services/document/source-preview.test.ts
cd src-tauri && cargo test source_preview_cache
```

Expected: all PASS

- [ ] **Step 2: Run frontend typecheck**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Spec checklist**

Confirm each success criterion from the spec has an implementation touchpoint:

| Spec # | Covered by |
|--------|------------|
| 1 secondary open fast | Tasks 2–4 |
| 2 windowed DOM default | Tasks 1, 5 |
| 3 highlight + switch | Task 5 |
| 4 match failure fallback | Task 5 |
| 5 delete cleanup | Task 2 |
| 6 cold parse backfill | Task 3 |

- [ ] **Step 4: Final commit only if leftover fixes**

If Step 1–3 required fixes, commit them; otherwise stop.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Disk cache under `source_preview/{id}.json` version 1 | Task 2 |
| Memory → disk → parse load order | Task 3 |
| Import/reprocess write | Task 4 |
| Hash mismatch invalidate | Task 3 |
| delete doc / delete KB cleanup | Task 2 |
| Window CONTEXT=3000 + newline snap | Task 1 |
| No char_start misuse | Global + Task 5 uses findHighlight* |
| Expand full by sections | Task 5 |
| Match failure without full DOM | Task 5 |
| Write failure non-blocking | Tasks 3–4 |
| Unit tests window + hash miss | Tasks 1, 3 |

No intentional placeholders left. Nested DocContent field naming (snake_case) called out in Tasks 2–3 to avoid serde drift.
