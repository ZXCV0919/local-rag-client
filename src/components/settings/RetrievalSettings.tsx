import { useCallback, useEffect, useState } from 'react';
import { tauriCommand } from '../../hooks/useDatabase';
import { useSettingsStore } from '../../store/settings';
import { useToastStore } from '../../store/toast';
import type { RetrievalMode, RerankMode } from '../../types/settings';
import { DEFAULT_SETTINGS } from '../../types/settings';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function RetrievalSettings() {
  const s = useSettingsStore((state) => state.settings);
  const setStore = useSettingsStore((state) => state.setSettings);
  const addToast = useToastStore((state) => state.addToast);

  const [mode, setMode] = useState<RetrievalMode>(s.retrieval_mode);
  const [rerankMode, setRerankMode] = useState<RerankMode>(s.rerank_mode);
  const [vectorWeight, setVectorWeight] = useState(s.vector_weight);
  const [keywordWeight, setKeywordWeight] = useState(s.keyword_weight);
  const [maxResults, setMaxResults] = useState(s.max_results);
  const answerSelfCheck = useSettingsStore((st) => st.settings.answer_self_check);
  const chatProvider = useSettingsStore((st) => st.settings.chat_provider);

  useEffect(() => {
    setMode(s.retrieval_mode);
    setRerankMode(s.rerank_mode);
    setVectorWeight(s.vector_weight);
    setKeywordWeight(s.keyword_weight);
    setMaxResults(s.max_results);
  }, [s.retrieval_mode, s.rerank_mode, s.vector_weight, s.keyword_weight, s.max_results]);

  const persistSelfCheck = useCallback(
    async (next: boolean) => {
      setStore({ answer_self_check: next });
      await tauriCommand('set_setting', { key: 'answer_self_check', value: JSON.stringify(next) });
    },
    [setStore],
  );

  const restore = useCallback(() => {
    setMode(DEFAULT_SETTINGS.retrieval_mode);
    setRerankMode(DEFAULT_SETTINGS.rerank_mode);
    setVectorWeight(DEFAULT_SETTINGS.vector_weight);
    setKeywordWeight(DEFAULT_SETTINGS.keyword_weight);
    setMaxResults(DEFAULT_SETTINGS.max_results);
  }, []);

  const save = useCallback(async () => {
    const vw = clamp01(Math.round(vectorWeight * 10) / 10);
    const kw = clamp01(Math.round(keywordWeight * 10) / 10);
    const mr = Math.min(50, Math.max(1, Math.trunc(maxResults)));
    try {
      await Promise.all([
        tauriCommand('set_setting', { key: 'retrieval_mode', value: JSON.stringify(mode) }),
        tauriCommand('set_setting', { key: 'rerank_mode', value: JSON.stringify(rerankMode) }),
        tauriCommand('set_setting', { key: 'vector_weight', value: JSON.stringify(vw) }),
        tauriCommand('set_setting', { key: 'keyword_weight', value: JSON.stringify(kw) }),
        tauriCommand('set_setting', { key: 'max_results', value: JSON.stringify(mr) }),
      ]);
      setStore({
        retrieval_mode: mode,
        rerank_mode: rerankMode,
        vector_weight: vw,
        keyword_weight: kw,
        max_results: mr,
      });
      addToast({ type: 'success', title: '检索设置已保存', duration: 2600 });
    } catch (e) {
      addToast({
        type: 'error',
        title: '保存失败',
        message: e instanceof Error ? e.message : String(e),
        duration: 5000,
      });
    }
  }, [addToast, keywordWeight, maxResults, mode, rerankMode, setStore, vectorWeight]);

  const sum = (vectorWeight + keywordWeight).toFixed(1);

  return (
    <div className="space-y-6">
      <section className="space-y-5 overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
        <div>
          <h2 className="text-[length:var(--text-section)] font-semibold tracking-tight text-[var(--color-text-primary)]">检索默认</h2>
          <p className="mt-1 text-[length:var(--text-meta)] leading-relaxed text-[var(--color-text-secondary)]">
            与对话侧「排查检索」读取同一套设置。α、β 建议之和接近 1。
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-[var(--color-text-secondary)] text-xs block mb-1">默认检索模式</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as RetrievalMode)}
            className="w-full max-w-xs px-3 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <option value="hybrid">智能（混合）</option>
            <option value="semantic">语义</option>
            <option value="keyword">关键词</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-[var(--color-text-secondary)] text-xs block mb-1">重排策略</span>
          <select
            value={rerankMode}
            onChange={(e) => setRerankMode(e.target.value as RerankMode)}
            className="w-full max-w-xs px-3 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <option value="rrf">加权 RRF（默认，更快）</option>
            <option value="llm">LLM listwise（更准但更慢，失败回退 RRF）</option>
          </select>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
            LLM 重排会多一次短推理，使用当前对话提供方（Ollama / SiliconFlow）。
          </p>
        </label>

        <SliderRow
          label="向量权重 α"
          value={vectorWeight}
          onChange={(n) => setVectorWeight(clamp01(n))}
          step={0.1}
        />
        <SliderRow
          label="关键词权重 β"
          value={keywordWeight}
          onChange={(n) => setKeywordWeight(clamp01(n))}
          step={0.1}
        />
        <p className="text-xs text-[var(--color-text-secondary)]">α + β ≈ <span className="font-mono">{sum}</span></p>

        <div className="space-y-1">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">返回片段数（1–50）</label>
          <input
            type="number"
            min={1}
            max={50}
            value={maxResults}
            onChange={(e) => setMaxResults(Math.min(50, Math.max(1, Math.trunc(Number(e.target.value)) || 1)))}
            className="w-28 px-2 py-1.5 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={restore}
            className="px-4 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
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

      <section className="space-y-3 overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-[length:var(--text-section)] font-semibold tracking-tight text-[var(--color-text-primary)]">对话可靠性</h2>
        <p className="text-[length:var(--text-meta)] leading-relaxed text-[var(--color-text-secondary)]">
          每条助手回答在流式结束后会多一次短推理，怀疑未基于引用时在末尾追加提示；额外延迟与算力。
        </p>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--color-text-primary)]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
            checked={answerSelfCheck}
            onChange={(e) => void persistSelfCheck(e.target.checked)}
          />
          <span>回答后自检（降低幻觉风险）</span>
        </label>
        {chatProvider === 'siliconflow' && answerSelfCheck ? (
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40 px-3 py-2">
            云端模式下自检会额外消耗一次硅基流动 API 调用。
          </p>
        ) : null}
      </section>
    </div>
  );
}

function SliderRow(props: { label: string; value: number; onChange: (n: number) => void; step: number }) {
  const { label, value, onChange, step } = props;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-[var(--color-text-primary)]">{label}</span>
        <span className="font-mono text-[var(--color-text-secondary)]">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent)]"
      />
    </div>
  );
}
