import * as Switch from '@radix-ui/react-switch';
import { useCallback, useEffect, useState } from 'react';
import { tauriCommand } from '../../hooks/useDatabase';
import { useSettingsStore } from '../../store/settings';
import { useToastStore } from '../../store/toast';
import type { ChunkingStrategy } from '../../types/knowledge-base';
import { FALLBACK_CHUNKING_STRATEGY } from '../../types/knowledge-base';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function ChunkingSettings() {
  const strat = useSettingsStore((s) => s.settings.default_chunking_strategy);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const addToast = useToastStore((s) => s.addToast);
  const [draft, setDraft] = useState<ChunkingStrategy>(() => ({ ...strat }));

  useEffect(() => {
    setDraft({ ...strat });
  }, [strat]);

  const restore = useCallback(() => {
    const d = { ...FALLBACK_CHUNKING_STRATEGY };
    setDraft(d);
  }, []);

  const save = useCallback(async () => {
    const next = {
      max_chunk_size: clamp(draft.max_chunk_size, 200, 2000),
      min_chunk_size: clamp(draft.min_chunk_size, 50, 500),
      overlap: clamp(draft.overlap, 0, 200),
      heading_as_context: draft.heading_as_context,
    };
    try {
      await tauriCommand('set_setting', {
        key: 'default_chunking_strategy',
        value: JSON.stringify(next),
      });
      setSettings({ default_chunking_strategy: next });
      setDraft(next);
      addToast({ type: 'success', title: '分块默认已保存', duration: 2600 });
    } catch (e) {
      addToast({
        type: 'error',
        title: '保存失败',
        message: e instanceof Error ? e.message : String(e),
        duration: 5000,
      });
    }
  }, [addToast, draft.heading_as_context, draft.max_chunk_size, draft.min_chunk_size, draft.overlap, setSettings]);

  return (
    <div className="space-y-6">
      <section className="space-y-5 overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
        <div>
          <h2 className="text-[length:var(--text-section)] font-semibold tracking-tight text-[var(--color-text-primary)]">分块默认值</h2>
          <p className="mt-1 text-[length:var(--text-meta)] leading-relaxed text-[var(--color-text-secondary)]">
            影响<strong className="font-medium text-[var(--color-text-primary)]">新建知识库</strong>
            时的默认策略（已有知识库不受影响）。与文档解析、向量化的分块一致。
          </p>
        </div>

        <div className="space-y-4">
          <SliderRow
            label="最大分块（tokens）"
            hint="单个分块上限，建议 600–1200"
            min={200}
            max={2000}
            step={50}
            value={draft.max_chunk_size}
            onChange={(n) => setDraft((d) => ({ ...d, max_chunk_size: n }))}
          />
          <SliderRow
            label="最小分块（tokens）"
            hint="过小会合并更多短段"
            min={50}
            max={500}
            step={10}
            value={draft.min_chunk_size}
            onChange={(n) => setDraft((d) => ({ ...d, min_chunk_size: n }))}
          />
          <SliderRow
            label="重叠（tokens）"
            hint="相邻分块共享的尾部上下文"
            min={0}
            max={200}
            step={5}
            value={draft.overlap}
            onChange={(n) => setDraft((d) => ({ ...d, overlap: n }))}
          />

          <div className="flex items-center justify-between gap-4 rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-3 py-2">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">标题作为上下文</div>
              <div className="text-xs text-[var(--color-text-secondary)]">在分块内容中保留标题路径线索</div>
            </div>
            <Switch.Root
              checked={draft.heading_as_context}
              onCheckedChange={(heading_as_context) => setDraft((d) => ({ ...d, heading_as_context }))}
              className="relative h-6 w-10 rounded-full bg-[var(--color-bg-secondary)] data-[state=checked]:bg-[var(--color-accent)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform data-[state=checked]:translate-x-[18px]" />
            </Switch.Root>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={restore}
            className="px-4 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] hover:bg-[var(--color-btn-ghost-hover)] text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            恢复默认
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className="px-4 py-2 text-sm rounded-[length:var(--radius-control)] bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            保存
          </button>
        </div>
      </section>
    </div>
  );
}

function SliderRow(props: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const { label, hint, min, max, step, value, onChange } = props;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || min, min, max))}
          className="w-24 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-right"
        />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">{hint}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
        className="w-full accent-[var(--color-accent)]"
      />
    </div>
  );
}
