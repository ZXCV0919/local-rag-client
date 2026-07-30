import type { DragEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { stat } from '@tauri-apps/plugin-fs';
import type { KnowledgeBase } from '../../types/knowledge-base';
import type { ImportProgress } from '../../types/document';
import { importAndChunkDocument } from '../../services/importer';
import { getSupportedType } from '../../services/parser';

function baseName(path: string): string {
  const seg = path.replace(/[/\\]+$/, '').split(/[/\\]/);
  return seg[seg.length - 1] ?? path;
}

function filterImportPaths(paths: string[]): string[] {
  return paths.filter((p) => getSupportedType(baseName(p)) != null);
}

interface DocumentImporterProps {
  knowledgeBase: KnowledgeBase;
  onProgress?: (documentId: string, p: ImportProgress) => void;
  onComplete?: () => void;
  /** 单文件导入失败时的提示（多文件逐个失败时会多次触发）。 */
  onImportError?: (message: string) => void;
}

export function DocumentImporter({
  knowledgeBase,
  onProgress,
  onComplete,
  onImportError,
}: DocumentImporterProps) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const busyRef = useRef(false);
  const runPathsRef = useRef<(paths: string[]) => Promise<void>>(async () => {});
  /** `over` 事件不含 paths，沿用最近一次 `enter` 的文件列表。 */
  const lastDragPathsRef = useRef<string[]>([]);

  const runPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setBusy(true);
      try {
        for (const path of paths) {
          const fileName = baseName(path);
          let size = 0;
          try {
            const meta = await stat(path);
            size = typeof meta.size === 'bigint' ? Number(meta.size) : meta.size;
          } catch {
            size = 0;
          }
          try {
            const doc = await importAndChunkDocument(knowledgeBase, path, fileName, size, (p) => {
              onProgress?.(p.document_id, p);
            });
            onProgress?.(doc.id, {
              document_id: doc.id,
              status: doc.status,
              current_step: 'complete',
              completed: 6,
              total: 6,
            });
          } catch (e) {
            const msg =
              e instanceof Error ? e.message : typeof e === 'string' ? e : String(e);
            onImportError?.(`${fileName}：${msg}`);
          }
        }
      } finally {
        setBusy(false);
        onComplete?.();
      }
    },
    [knowledgeBase, onComplete, onProgress, onImportError],
  );

  runPathsRef.current = runPaths;
  busyRef.current = busy;

  useEffect(() => {
    let cancelled = false;
    let unlistenFn: { (): Promise<void> } | (() => void) | undefined;

    void (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const unlisten = await getCurrentWebview().onDragDropEvent(({ payload: event }) => {
          switch (event.type) {
            case 'enter': {
              lastDragPathsRef.current = event.paths;
              const next = filterImportPaths(event.paths);
              setDragOver(next.length > 0 && !busyRef.current);
              break;
            }
            case 'over': {
              const next = filterImportPaths(lastDragPathsRef.current);
              setDragOver(next.length > 0 && !busyRef.current);
              break;
            }
            case 'leave':
              lastDragPathsRef.current = [];
              setDragOver(false);
              break;
            case 'drop': {
              lastDragPathsRef.current = [];
              setDragOver(false);
              if (busyRef.current) return;
              const files = filterImportPaths(event.paths);
              if (files.length === 0) return;
              void runPathsRef.current(files);
              break;
            }
            default:
              break;
          }
        });
        if (cancelled) {
          void Promise.resolve(unlisten()).catch(() => {});
        } else {
          unlistenFn = unlisten;
        }
      } catch {
        /* 非 WebView（例如纯浏览器预览）仅占位：仍可用浏览导入。 */
      }
    })();

    return () => {
      cancelled = true;
      try {
        const u = unlistenFn;
        if (u != null) void Promise.resolve(u()).catch(() => {});
      } catch {
        /* noop */
      }
    };
  }, []);

  const pickFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: '文档', extensions: ['pdf', 'md', 'txt', 'docx'] }],
    });
    if (selected === null) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await runPaths(paths);
  }, [runPaths]);

  const onHtmlDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (busyRef.current || e.dataTransfer.files.length === 0) return;
      const paths: string[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files.item(i);
        if (!f) continue;
        const p = (f as File & { path?: string }).path;
        if (typeof p === 'string' && p) paths.push(p);
      }
      const usable = filterImportPaths(paths);
      if (usable.length) await runPaths(usable);
    },
    [runPaths],
  );

  return (
    <div
      data-tauri-no-drag
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => void onHtmlDrop(e)}
      className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
        dragOver
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40'
      }`}
    >
      <p className="text-sm text-[var(--color-text-secondary)] mb-3">
        拖拽 PDF / Markdown / 文本 / Word 到此处，或选择文件导入（解析 → 分块 → 向量化 → 向量库）。
      </p>
      <p className="text-xs text-[var(--color-text-secondary)]/85 mb-3">
        若拖拽无反应，请使用「浏览并导入」或与标题栏区分开再试（标题栏用于拖动窗口）。
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void pickFiles()}
        className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
      >
        {busy ? '处理中…' : '浏览并导入'}
      </button>
    </div>
  );
}
