import { appDataDir } from '@tauri-apps/api/path';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useState } from 'react';
import { tauriCommand } from '../../hooks/useDatabase';
import { knowledgeBaseFromRow, type KnowledgeBaseRow } from '../../types/knowledge-base';
import { useKnowledgeBaseStore } from '../../store/knowledge-base';
import { useToastStore } from '../../store/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';

export interface ChromaDbStatusPayload {
  running: boolean;
  url: string;
  port: number;
  last_error: string | null;
}

export interface ChromaDbHealthPayload {
  responding: boolean;
  status: ChromaDbStatusPayload;
}

export interface StorageStatistics {
  knowledgeBaseCount: number;
  documentCount: number;
  chunkCount: number;
  chromaDataBytes: number;
}

function formatBytes(n: number): string {
  if (n <= 0) return '0 B';
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export function DataManager() {
  const addToast = useToastStore((s) => s.addToast);
  const setKbs = useKnowledgeBaseStore((s) => s.setKnowledgeBases);
  const knowledgeBases = useKnowledgeBaseStore((s) => s.knowledgeBases);

  const [dataPath, setDataPath] = useState<string>('');
  const [stats, setStats] = useState<StorageStatistics | null>(null);
  const [health, setHealth] = useState<ChromaDbHealthPayload | null>(null);
  const [chromBusy, setChromBusy] = useState(false);
  const [exportKbId, setExportKbId] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      const s = await tauriCommand<StorageStatistics>('get_storage_statistics');
      setStats(s);
    } catch {
      setStats(null);
    }
  }, []);

  const refreshChroma = useCallback(async () => {
    try {
      const h = await tauriCommand<ChromaDbHealthPayload>('chromadb_health');
      setHealth(h);
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setDataPath(await appDataDir());
      } catch {
        setDataPath('�?);
      }
    })();
  }, []);

  useEffect(() => {
    void refreshStats();
    void refreshChroma();
  }, [refreshStats, refreshChroma]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await tauriCommand<KnowledgeBaseRow[]>('list_knowledge_bases');
        if (!cancelled) setKbs(rows.map(knowledgeBaseFromRow));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setKbs]);

  useEffect(() => {
    if (knowledgeBases.length && !exportKbId) {
      setExportKbId(knowledgeBases[0].id);
    }
  }, [exportKbId, knowledgeBases]);

  const startChroma = async () => {
    setChromBusy(true);
    try {
      await tauriCommand('start_chromadb');
      await refreshChroma();
    } finally {
      setChromBusy(false);
    }
  };

  const stopChroma = async () => {
    setChromBusy(true);
    try {
      await tauriCommand('stop_chromadb');
      await refreshChroma();
    } finally {
      setChromBusy(false);
    }
  };

  const exportKb = async () => {
    if (!exportKbId) {
      addToast({ type: 'warning', title: '请选择知识�?, duration: 3000 });
      return;
    }
    const kb = knowledgeBases.find((k) => k.id === exportKbId);
    const safe = kb?.name?.replace(/[/\\?%*:|"<>]/g, '_') ?? 'export';
    setExportBusy(true);
    try {
      const picked = await save({
        defaultPath: `${safe}.kb-export.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!picked) return;
      const json = await tauriCommand<string>('export_knowledge_base', { id: exportKbId });
      await writeTextFile(picked, json);
      addToast({ type: 'success', title: '导出完成', duration: 3000 });
    } catch (e) {
      addToast({
        type: 'error',
        title: '导出失败',
        message: e instanceof Error ? e.message : String(e),
        duration: 6000,
      });
    } finally {
      setExportBusy(false);
    }
  };

  const clearAll = async () => {
    setClearBusy(true);
    try {
      await tauriCommand('clear_all_application_data');
      setKbs([]);
      setExportKbId('');
      await refreshStats();
      await refreshChroma();
      addToast({ type: 'success', title: '已清空应用数�?, duration: 4000 });
      setClearOpen(false);
    } catch (e) {
      addToast({
        type: 'error',
        title: '清空失败',
        message: e instanceof Error ? e.message : String(e),
        duration: 6000,
      });
    } finally {
      setClearBusy(false);
    }
  };

  const openExplorer = async () => {
    if (!dataPath || dataPath === '�?) return;
    try {
      await openPath(dataPath);
    } catch (e) {
      addToast({
        type: 'error',
        title: '无法打开目录',
        message: e instanceof Error ? e.message : String(e),
        duration: 6000,
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] space-y-3">
        <h2 className="font-semibold text-[var(--color-text-primary)]">数据目录</h2>
        <p className="text-xs text-[var(--color-text-secondary)] break-all font-mono bg-[var(--color-bg-secondary)]/50 rounded px-2 py-2">
          {dataPath}
        </p>
        <button
          type="button"
          onClick={() => void openExplorer()}
          disabled={!dataPath || dataPath === '�?}
          className="px-4 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] hover:bg-[var(--color-btn-ghost-hover)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          在资源管理器中打开
        </button>
      </section>

      <section className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] space-y-3">
        <h2 className="font-semibold text-[var(--color-text-primary)]">存储统计</h2>
        {stats ? (
          <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
            <li>
              知识库：<strong className="text-[var(--color-text-primary)]">{stats.knowledgeBaseCount}</strong>
            </li>
            <li>
              文档�?strong className="text-[var(--color-text-primary)]">{stats.documentCount}</strong>
            </li>
            <li>
              分块�?strong className="text-[var(--color-text-primary)]">{stats.chunkCount}</strong>
            </li>
            <li>
              ChromaDB 持久化约占：
              <strong className="text-[var(--color-text-primary)]">{formatBytes(stats.chromaDataBytes)}</strong>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">无法读取统计</p>
        )}
        <button
          type="button"
          onClick={() => void refreshStats()}
          className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          刷新统计
        </button>
      </section>

      <section className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] space-y-3">
        <h2 className="font-semibold text-[var(--color-text-primary)]">导出知识�?/h2>
        <p className="text-xs text-[var(--color-text-secondary)]">导出元数据、文档与分块正文，不含向量�?/p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs flex-1 min-w-[10rem]">
            <span className="block mb-1 text-[var(--color-text-secondary)]">知识�?/span>
            <select
              value={exportKbId}
              onChange={(e) => setExportKbId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              {knowledgeBases.length === 0 ? (
                <option value="">暂无</option>
              ) : (
                knowledgeBases.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            disabled={exportBusy || !exportKbId}
            onClick={() => void exportKb()}
            className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-[var(--color-on-accent)] disabled:opacity-50 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {exportBusy ? '导出中�? : '导出�?JSON'}
          </button>
        </div>
      </section>

      <section className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-[var(--color-text-primary)]">ChromaDB</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {health?.responding ? '心跳正常' : '未响应或未启�?} ·{' '}
              {health?.status.url ? health.status.url : '�?}
            </p>
            {health?.status.last_error ? (
              <p className="text-xs mt-2 text-[var(--color-danger-text)]">{health.status.last_error}</p>
            ) : null}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => void refreshChroma()}
              disabled={chromBusy}
              className="px-4 py-2 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-btn-ghost-hover)] disabled:opacity-50"
            >
              刷新状�?
            </button>
            <button
              type="button"
              onClick={() => void startChroma()}
              disabled={chromBusy}
              className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              启动
            </button>
            <button
              type="button"
              onClick={() => void stopChroma()}
              disabled={chromBusy}
              className="px-4 py-2 text-sm rounded border border-[var(--color-danger-border)] text-[var(--color-danger-text)] hover:bg-[var(--color-danger-hover-bg)] disabled:opacity-50"
            >
              停止
            </button>
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] mt-4 leading-relaxed">
          需要本机可用的 Chroma 服务或嵌入版 CLI / Python 包{' '}
          <code className="bg-[var(--color-code-bg)] px-1 rounded">chromadb</code>
          。若心跳失败：先点「启动」再「刷新状态」；端口占用或未安装时，对照{' '}
          <code className="bg-[var(--color-code-bg)] px-1 rounded">docs/ops/troubleshooting.md</code>{' '}
          �?3 条排查�?
        </p>
      </section>

      <section className="rounded-[length:var(--radius-card)] border border-[var(--color-danger-border)] bg-[color-mix(in_srgb,var(--badge-error-bg)_35%,var(--color-surface))] p-5 shadow-[var(--shadow-sm)] space-y-3">
        <h2 className="font-semibold text-[var(--color-danger-text)]">危险区域</h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          清空将删�?strong className="text-[var(--color-text-primary)]">所�?/strong>
          知识库、文档、分块与对话；向量集合会一并清理�?
          <strong className="text-[var(--color-text-primary)]">设置项保�?/strong>�?
        </p>
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-700 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800"
        >
          清空所有数�?
        </button>
      </section>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="确定清空全部数据�?
        description="此操作不可撤销。所有知识内容与对话都会被删除�?
        confirmLabel="立即清空"
        danger
        loading={clearBusy}
        onConfirm={async () => {
          await clearAll();
        }}
      />
    </div>
  );
}
