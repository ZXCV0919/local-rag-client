import { homeDir, join } from '@tauri-apps/api/path';
import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import { tauriCommand } from '../../hooks/useDatabase';
import { importAndChunkDocument } from '../importer';
import {
  knowledgeBaseFromRow,
  type KnowledgeBase,
  type KnowledgeBaseRow,
} from '../../types/knowledge-base';
import { DEFAULT_SETTINGS } from '../../types/settings';

export const DEMO_KB_NAME = '演示知识库';

const DEMO_FILES = [
  'ollama-setup.md',
  'hybrid-retrieval.md',
  'siliconflow-privacy.md',
  'chunking-strategy.md',
  'chromadb-lifecycle.md',
] as const;

async function loadDemoMarkdown(fileName: string): Promise<string> {
  const res = await fetch(`/demo-kb/${fileName}`);
  if (!res.ok) {
    throw new Error(`无法加载演示语料 ${fileName}`);
  }
  return res.text();
}

async function materializeDemoFiles(): Promise<string[]> {
  const home = await homeDir();
  const dir = await join(home, '.local-kb-demo');
  await mkdir(dir, { recursive: true });
  const paths: string[] = [];
  for (const name of DEMO_FILES) {
    const body = await loadDemoMarkdown(name);
    const path = await join(dir, name);
    await writeTextFile(path, body);
    paths.push(path);
  }
  return paths;
}

/**
 * 创建「演示知识库」（若尚无同名）并导入内置 mini-kb Markdown。
 * 依赖本机 Ollama 嵌入；调用方应先做健康检查。
 */
export async function seedDemoKnowledgeBase(opts?: {
  onProgress?: (fileName: string, index: number, total: number) => void;
}): Promise<{ knowledgeBase: KnowledgeBase; created: boolean }> {
  const rows = await tauriCommand<KnowledgeBaseRow[]>('list_knowledge_bases');
  const existing = rows.find((r) => r.name === DEMO_KB_NAME);
  let kb: KnowledgeBase;
  let created = false;

  if (existing) {
    kb = knowledgeBaseFromRow(existing);
  } else {
    const row = await tauriCommand<KnowledgeBaseRow>('create_knowledge_base', {
      request: {
        name: DEMO_KB_NAME,
        description: '内置小样本语料，用于快速体验检索与引用问答',
        embedding_model: DEFAULT_SETTINGS.default_embedding_model,
      },
    });
    kb = knowledgeBaseFromRow(row);
    created = true;
  }

  const paths = await materializeDemoFiles();
  const total = paths.length;
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!;
    const fileName = DEMO_FILES[i]!;
    opts?.onProgress?.(fileName, i + 1, total);
    // Skip if same file name already in this KB
    const docs = await tauriCommand<{ file_name: string }[]>('list_documents', {
      kbId: kb.id,
    } as { kbId: string });
    if (docs.some((d) => d.file_name === fileName)) {
      continue;
    }
    await importAndChunkDocument(kb, path, fileName, 0, () => {});
  }

  const refreshed = await tauriCommand<KnowledgeBaseRow>('get_knowledge_base', { id: kb.id });
  return { knowledgeBase: knowledgeBaseFromRow(refreshed), created };
}
