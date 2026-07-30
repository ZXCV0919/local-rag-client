import * as Tabs from '@radix-ui/react-tabs';
import { AppearanceSection } from './AppearanceSection';
import { ChunkingSettings } from './ChunkingSettings';
import { DataManager } from './DataManager';
import { OllamaSettings } from './OllamaSettings';
import { RetrievalSettings } from './RetrievalSettings';

const TAB_TRIGGER =
  'px-4 py-2 text-sm font-medium rounded-t-[length:var(--radius-control)] border-b-2 border-transparent text-[var(--color-text-secondary)] data-[state=active]:border-[var(--color-accent)] data-[state=active]:text-[var(--color-text-primary)] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]';

export function SettingsPage() {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 p-6 md:p-8 lg:px-10">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">设置</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">外观、本地模型、检索与数据维护</p>
      </div>

      <AppearanceSection />

      <Tabs.Root defaultValue="ollama" className="w-full">
        <Tabs.List className="flex flex-wrap gap-1 border-b border-[var(--color-border)] mb-4 pb-px">
          <Tabs.Trigger className={TAB_TRIGGER} value="ollama">
            模型与连接
          </Tabs.Trigger>
          <Tabs.Trigger className={TAB_TRIGGER} value="chunking">
            分块参数
          </Tabs.Trigger>
          <Tabs.Trigger className={TAB_TRIGGER} value="retrieval">
            检索参数
          </Tabs.Trigger>
          <Tabs.Trigger className={TAB_TRIGGER} value="data">
            数据管理
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="ollama" className="outline-none">
          <OllamaSettings />
        </Tabs.Content>
        <Tabs.Content value="chunking" className="outline-none">
          <ChunkingSettings />
        </Tabs.Content>
        <Tabs.Content value="retrieval" className="outline-none">
          <RetrievalSettings />
        </Tabs.Content>
        <Tabs.Content value="data" className="outline-none">
          <DataManager />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
