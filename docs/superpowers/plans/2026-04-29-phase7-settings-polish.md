# 阶段7：设置页面与打磨 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善设置页面、Ollama 管理、错误处理、性能优化和总体打磨，使应用达到可发布状态。

**Architecture:** 设置页面通过 Tauri Commands 读写 SQLite settings 表。Ollama 管理页面提供模型下载/删除/启停功能。全局错误处理通过 Tauri events 和 React ErrorBoundary。

**Tech Stack:** Radix UI (Dialog, Tabs, Select, Switch), Tauri events

**与阶段 6.5 的衔接：** 若已实现或后续将按计划完成 `docs/superpowers/plans/2026-04-29-phase6.5-visual-youth-polish.md`，本阶段新增的设置与各子组件在编写样式时宜优先使用 `src/styles/variables.css` 与 `global.css` 中的语义 token（`var(--*)`）、既定的圆角/阴影与 `focus-visible` 约定，并与既有外观区块（如 `AppearanceSection`）保持同一套视觉语言，尽量减少硬编码色值与零碎间距。

---

## File Structure

```
src/
├── components/
│   └── settings/
│       ├── SettingsPage.tsx        (设置页面主体)
│       ├── OllamaSettings.tsx       (Ollama连接设置)
│       ├── ChunkingSettings.tsx     (分块参数设置)
│       ├── RetrievalSettings.tsx    (检索参数设置)
│       └── DataManager.tsx          (数据管理)
├── hooks/
│   └── useErrorBoundary.tsx         (错误边界)
├── components/
│   └── common/
│       ├── Toast.tsx                (更新：全局 toast)
│       └── ConfirmDialog.tsx        (新增)
```

---

### Task 1: 设置页面框架

**Files:**
- Create: `src/components/settings/SettingsPage.tsx`
- Update: `src/App.tsx`

- [ ] **Step 1: 创建设置页面布局**

`src/components/settings/SettingsPage.tsx`:

使用 Radix UI Tabs 组织四个设置板块：
1. **Ollama 连接** — 服务地址、连接状态、模型管理
2. **分块参数** — max_chunk_size, min_chunk_size, overlap, heading_as_context
3. **检索参数** — 检索模式、向量权重、关键词权重、返回结果数
4. **数据管理** — 数据目录、导出知识库、清空数据

每个 Tab 对应一个子组件。设置值保存到 SQLite settings 表。

```tsx
import * as Tabs from '@radix-ui/react-tabs';

export function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">设置</h1>
      <Tabs.Root defaultValue="ollama">
        <Tabs.List className="flex border-b mb-4">
          <Tabs.Trigger value="ollama" className="px-4 py-2 text-sm">Ollama 连接</Tabs.Trigger>
          <Tabs.Trigger value="chunking" className="px-4 py-2 text-sm">分块参数</Tabs.Trigger>
          <Tabs.Trigger value="retrieval" className="px-4 py-2 text-sm">检索参数</Tabs.Trigger>
          <Tabs.Trigger value="data" className="px-4 py-2 text-sm">数据管理</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="ollama"><OllamaSettings /></Tabs.Content>
        <Tabs.Content value="chunking"><ChunkingSettings /></Tabs.Content>
        <Tabs.Content value="retrieval"><RetrievalSettings /></Tabs.Content>
        <Tabs.Content value="data"><DataManager /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "feat: add settings page with tab navigation framework"
```

---

### Task 2: Ollama 连接设置

**Files:**
- Create: `src/components/settings/OllamaSettings.tsx`
- Update: `src/components/settings/OllamaModelList.tsx`（增强已有组件）

- [ ] **Step 1: 实现 Ollama 连接设置**

`src/components/settings/OllamaSettings.tsx`:

- Ollama 服务地址输入框（默认 http://localhost:11434）
- 连接状态指示灯（绿：已连接，红：断开，黄：检测中）
- 「检测连接」按钮
- 「启动内嵌管理」/「停止内嵌管理」按钮（根据 Ollama 模式显示）
- 模型列表（分组显示 embedding 和 chat 模型）
- 默认模型选择：
  - Embedding 模型下拉选择
  - Chat 模型下拉选择
- 保存设置到 SQLite

- [ ] **Step 2: 在 OllamaModelList 中增加下载和删除功能**

- 「下载模型」按钮：输入模型名称，开始下载
- 下载进度条（通过 Tauri events `ollama:model-downloading`）
- 每个模型行的「删除」按钮（带确认）
- 模型分类标签（embedding/chat）

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add Ollama connection settings with model management"
```

---

### Task 3: 分块和检索参数设置

**Files:**
- Create: `src/components/settings/ChunkingSettings.tsx`
- Create: `src/components/settings/RetrievalSettings.tsx`

- [ ] **Step 1: 实现分块参数设置**

`src/components/settings/ChunkingSettings.tsx`:

- 最大分块大小 (tokens) — 滑块 + 数字输入，范围 200-2000，默认 800
- 最小分块大小 (tokens) — 滑块 + 数字输入，范围 50-500，默认 100
- 分块重叠 (tokens) — 滑块 + 数字输入，范围 0-200，默认 50
- 标题作为上下文 — 开关，默认开启
- 参数说明提示文字
- 「恢复默认」按钮
- 「保存」按钮 → 调用 `set_setting` Command 写入 settings 表

- [ ] **Step 2: 实现检索参数设置**

`src/components/settings/RetrievalSettings.tsx`:

- 默认检索模式 — 下拉选择（智能/语义/关键词）
- 向量权重 α — 滑块 0-1，步长 0.1，默认 0.7
- 关键词权重 β — 滑块 0-1，步长 0.1，默认 0.3
- 确保提示：α + β 应接近 1.0
- 返回结果数 — 数字输入，范围 1-20，默认 6
- 「恢复默认」和「保存」按钮

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add chunking and retrieval parameter settings pages"
```

---

### Task 4: 数据管理设置

**Files:**
- Create: `src/components/settings/DataManager.tsx`
- Create: `src/components/common/ConfirmDialog.tsx`

- [ ] **Step 1: 实现确认对话框**

`src/components/common/ConfirmDialog.tsx`:

使用 Radix UI Dialog 创建可复用的确认对话框：
- 标题、描述、确认按钮（危险操作红色）、取消按钮
- 支持自定义按钮文字
- 支持加载状态（异步操作进行中）

- [ ] **Step 2: 实现数据管理**

`src/components/settings/DataManager.tsx`:

- **数据目录**：显示当前数据目录路径，「浏览」按钮打开目录选择器（使用 tauri-plugin-dialog）
- **存储统计**：显示知识库数量、文档总数、分块总数、向量数据大小
- **导出知识库**：选择知识库 → 导出为 JSON 文件（包含元数据、分块内容、不含向量数据）
- **清空所有数据**：红色警告按钮 → 确认对话框 → 删除所有知识库、文档、分块、对话数据

- [ ] **Step 3: 实现数据导出功能（Rust Command）**

```rust
#[tauri::command]
pub async fn export_knowledge_base(id: String) -> Result<String, AppError> {
    // 导出知识库元数据、文档列表、分块内容为 JSON
    // 不包含向量数据
    let kb = knowledge_base::get_by_id(&id)?;
    let docs = document::list_by_knowledge_base(&id)?;
    let chunks = chunk::list_by_knowledge_base(&id)?;
    let export_data = serde_json::json!({
        "knowledge_base": kb,
        "documents": docs,
        "chunks": chunks,
    });
    Ok(serde_json::to_string_pretty(&export_data)?)
}

#[tauri::command]
pub async fn clear_all_data() -> Result<(), AppError> {
    // 清空所有表（保留 settings）
    // 同步清空所有 ChromaDB collections
}
```

使用 `tauri-plugin-dialog` 的文件保存对话框让用户选择保存位置。

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add data management with export, clear, and storage statistics"
```

---

### Task 5: 全局错误处理与 Toast 通知

**Files:**
- Update: `src/components/common/Toast.tsx`（增强为全局 toast）
- Create: `src/hooks/useErrorBoundary.tsx`
- Create: `src/store/toast.ts`

- [ ] **Step 1: 实现全局 Toast Store**

`src/store/toast.ts`:

```typescript
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
```

- [ ] **Step 2: 增强 Toast 组件**

支持四种类型（success/error/warning/info），自动消失（默认3秒），手动关闭，多条堆叠。

- [ ] **Step 3: 实现错误边界**

`src/hooks/useErrorBoundary.tsx`:

```typescript
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 text-center">
          <h2 className="text-lg font-bold text-red-600">出错了</h2>
          <p className="mt-2 text-sm text-gray-600">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: 在 App.tsx 中集成 ErrorBoundary 和 Toast**

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add global error boundary and toast notification system"
```

---

### Task 6: 性能优化与体验打磨

**Files:**
- Update: 多个组件优化

- [ ] **Step 1: 大列表虚拟化**

文档列表和分块列表超过 100 条时使用虚拟滚动：
```bash
npm install @tanstack/react-virtual
```

在 DocumentList 和 ChunkPreview 中对长列表使用 `useVirtualizer`。

- [ ] **Step 2: 搜索防抖**

在 DocumentList 的搜索框和对话历史的搜索中添加 300ms 防抖。

- [ ] **Step 3: 加载状态优化**

所有数据加载页面添加 Skeleton 占位：
- 知识库列表 → 卡片 Skeleton
- 文档列表 → 卡片 Skeleton
- 对话列表 → 行 Skeleton
- 对话消息 → 气泡 Skeleton

- [ ] **Step 4: 空状态设计**

每个页面添加空状态插画和引导：
- 知识库为空 → "创建第一个知识库"
- 文档为空 → "导入你的第一份文档"
- 对话为空 → "开始提问吧"

- [ ] **Step 5: 快捷键支持**

- `Ctrl/Cmd + N` — 新建知识库
- `Ctrl/Cmd + Enter` — 发送消息
- `Ctrl/Cmd + K` — 搜索
- `Escape` — 关闭弹窗/停止生成

- [ ] **Step 6: 自定义标题栏无障碍**

确保自定义标题栏支持拖拽移动、双击最大化，所有交互元素有 aria 标签。

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "feat: add virtual scrolling, loading skeletons, empty states, and keyboard shortcuts"
```

---

### Task 7: Tauri 构建配置与最终测试

**Files:**
- Update: `src-tauri/tauri.conf.json`
- Update: `src-tauri/icons/`

- [ ] **Step 1: 配置 Tauri 构建选项**

`src-tauri/tauri.conf.json` 关键配置：
- 应用名称：`本地知识库`
- 窗口标题：`本地知识库`
- 窗口大小：最小 1024x768，默认 1280x900
- 无边框窗口（decorations: false，使用自定义 Titlebar）
- 允许的 API：dialog, fs, shell（Ollama/ChromaDB 进程管理）
- 打包标识符：`com.local-knowledge-base.app`

- [ ] **Step 2: 准备应用图标**

准备多尺寸图标：
- 32x32, 128x128, 128x128@2x, 256x256, 512x512
- ICNS (macOS), ICO (Windows)

- [ ] **Step 3: 端到端测试清单**

完整测试流程：
1. 安装并启动应用
2. 创建知识库
3. 导入 PDF 和 Markdown 文档
4. 验证文档解析和分块正确
5. 验证向量化完成
6. 执行语义检索、关键词搜索、混合模式查询
7. 开始对话，验证流式回答和引用溯源
8. 恢复历史对话
9. 修改设置，验证保存和生效
10. 删除文档和知识库，验证数据一致
11. Ollama 断连时验证错误提示
12. 重新启动应用，验证数据持久化

- [ ] **Step 4: 构建安装包**

```bash
npm run tauri build
```

验证生成的安装包可以正常安装和运行。

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: configure Tauri build, app icons, and final integration"
```

---

## 阶段7完成标准

- [ ] 设置页面四个 Tab 全部可用
- [ ] Ollama 连接检测、模型下载/删除正常工作
- [ ] 分块参数和检索参数可调整并持久化
- [ ] 数据导出和清空功能正常
- [ ] 全局错误处理和 Toast 通知正常
- [ ] 大列表有虚拟滚动
- [ ] 所有加载状态有 Skeleton
- [ ] 所有空状态有引导
- [ ] 快捷键正常工作
- [ ] 端到端测试流程全部通过
- [ ] 安装包可正常安装运行