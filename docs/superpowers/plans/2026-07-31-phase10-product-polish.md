# Phase 10 · 产品观感与首次体验打磨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Task 1–6 已在主分支落地（2026-07-31）；截图 PNG 需本地运行后人工补齐。

**Goal:** 在不堆新算法的前提下，把「通用 AI 后台感」压下去，并让第一次打开 → 导入 → 提问这条主路径更丝滑、更好演示。

**Architecture:** 只动前端视觉令牌、空状态/引导组件、启动健康检查条、样例知识库导入入口，以及 README 展示资产；不改 RAG 默认检索路径，不引入云端嵌入。

**Tech Stack:** 现有 Tauri 2 + React + CSS 变量（`variables.css` / Tailwind）+ 已有 `check_ollama_status` / `chromadb_health` Command。

## Global Constraints

- 不做全链路云端嵌入 / 云向量库
- 不重写对话/检索核心；设置页可微调文案
- 视觉方向：**墨青绿本地书房**（青绿强调色 + 纸感浅底），明确避开默认「靛蓝 SaaS」与暖奶油+赤陶套路
- 默认强调色建议：`--color-accent: #0f766e`（teal-700），hover `#0d9488`；浅底 `#f7f6f3` / 表面 `#fffcf8`
- 公开仓库不新增「短板/秋招评估」类文档；本计划是产品打磨
- 单任务可独立验收；演示录屏放最后，不阻塞代码任务

## 范围对照（来自已确认短板）

| 问题 | 本计划任务 |
|------|------------|
| 模板紫 / 通用后台观感 | Task 1 |
| 空状态弱、缺引导 | Task 2 |
| 品牌感弱 | Task 1 + Task 2 侧栏/启动文案 |
| 首次启动门槛高 | Task 3 |
| 对话 vs 工作台易懵 | Task 4 |
| 缺截图/录屏 | Task 6 |
| 演示用样例 KB | Task 5 |
| PDF 主线程体感差 | Task 4（进度文案）；不做 PDF Worker 大改 |
| git 历史清短板 | **不做**（可选附录，默认跳过） |

## 推荐工期

| 档位 | 内容 | 工期 |
|------|------|------|
| **推荐（本计划）** | Task 1–6 | **4–6 天** |
| 最小 | 仅 Task 1 + 2 + 6（截图） | 2–3 天 |
| 加量 | + PDF Worker / 历史清理 | 另计 |

## File map

| 文件 | 职责 |
|------|------|
| `src/styles/variables.css` | 主题色、纸感背景、阴影令牌 |
| `src/utils/accent-theme.ts` / 设置默认 accent | 默认强调色与主题一致 |
| `src/components/layout/Sidebar.tsx` | 品牌区 + 空知识库引导 CTA |
| `src/components/chat/MessageList.tsx` | 对话空状态三步引导 |
| `src/components/document/DocumentList.tsx` | 文档空状态 CTA |
| `src/components/knowledge-base/KnowledgeBaseOverview.tsx`（或列表页） | 首页空状态 |
| `src/components/common/DependencyHealthBanner.tsx`（新建） | 顶栏依赖健康条 |
| `src/components/layout/AppLayout.tsx` 或 `Titlebar` 附近 | 挂载健康条 |
| `src/components/chat/ChatHeader.tsx` / `RetrievalWorkbench` 相关 | 主路径文案澄清 |
| `evals/fixtures/mini-kb/*` → 应用内「导入演示语料」 | 样例 KB（复用已有 fixture） |
| `docs/ops/demo-checklist.md` + `README.md` | 演示步骤与截图位 |
| `docs/assets/` 或 `docs/screenshots/`（新建） | README 用 PNG（人工截图） |

---

### Task 1: 墨青绿视觉令牌（去模板紫）

**Files:**
- Modify: `src/styles/variables.css`
- Modify: `src/types/settings.ts`（若默认 accent 写死为 indigo）
- Modify: `src/components/settings/AppearanceSection.tsx`（预设色板若含紫为主，改预设顺序）
- Modify: `src/utils/kb-theme.ts`（若 KB 色条偏紫系，换成青绿/石板/琥珀一组）

**Interfaces:**
- Consumes: 现有 CSS 变量名（`--color-accent` 等），不改变量名
- Produces: 浅色默认主题呈现「纸感 + 青绿」；深色主题同步调暗青绿，避免仍像默认紫黑

- [ ] **Step 1: 改浅色令牌**

在 `variables.css` 的 `:root` / light 段设置（数值可微调但色相保持青绿）：

```css
:root {
  --color-accent: #0f766e;
  --color-accent-hover: #0d9488;
  --color-on-accent: #ffffff;
}
:root:not([data-theme]),
:root[data-theme='light'] {
  --color-bg-primary: #f7f6f3;
  --color-bg-secondary: #efece6;
  --color-surface: #fffcf8;
  --color-bg-sidebar: #fffcf8;
  --color-border: #e7e2d9;
  /* citation 用 accent 的 alpha，勿写死 indigo rgba */
}
```

- [ ] **Step 2: 改深色令牌**

暗色背景保持现有结构，把 accent / citation / active 条从紫系改为青绿系（`#2dd4bf` 一类用于暗色强调即可）。

- [ ] **Step 3: 默认设置与预设**

若 `DEFAULT_SETTINGS` 或外观预设含 `#6366f1`，改为 `#0f766e`；预设色板前三个改为：青绿 / 石板蓝 / 琥珀，紫色可留在末位。

- [ ] **Step 4: 目视验收**

Run: `npm run tauri:dev`（或项目现有 dev 脚本）  
Expected: 侧栏、主按钮、引用高亮不再是靛蓝主调；浅色页有轻微纸感灰，不是纯 `#f5f5f5` 平板灰。

- [ ] **Step 5: Commit**

```bash
git add src/styles/variables.css src/types/settings.ts src/components/settings/AppearanceSection.tsx src/utils/kb-theme.ts
git commit -m "style: shift default theme to ink-teal local library look"
```

---

### Task 2: 三条空状态主路径引导

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`（「暂无知识库」→ CTA）
- Modify: `src/components/knowledge-base/KnowledgeBaseOverview.tsx`（或实际首页组件）
- Modify: `src/components/document/DocumentList.tsx`
- Modify: `src/components/chat/MessageList.tsx`
- Create（可选）: `src/components/common/EmptyState.tsx` — 统一标题/说明/主按钮/次按钮

**Interfaces:**
- Consumes: `useAppNavigate`、现有「新建知识库」「导入」入口
- Produces: 空状态必须给出 **一个主行动**（按钮），文案三步清晰

文案标准（中文，勿堆术语）：

| 场景 | 标题 | 说明 | 主按钮 |
|------|------|------|--------|
| 无 KB | 还没有知识库 | 先建一个本地库，再导入文档 | 新建知识库 |
| 无文档 | 还没有文档 | 导入 PDF / Markdown / Word，解析后即可提问 | 去导入（或聚焦导入区） |
| 无对话 | 问一句试试 | 1 导入文档 → 2 等向量化完成 → 3 在下方提问 | 若无文档则按钮变「去导入文档」 |

- [ ] **Step 1: 抽出或内联 EmptyState**

```tsx
// EmptyState props（建议）
type EmptyStateProps = {
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};
```

- [ ] **Step 2: 接到 Sidebar / 文档列表 / 对话空态**

`MessageList` 现有空态改为含步骤列表（ol）+ 条件 CTA；去掉「也可先用顶部检索栏」作为第一句（降级到次要说明，见 Task 4）。

- [ ] **Step 3: 目视验收**

Expected: 新用户从零到「知道下一步点哪」不超过一眼；无「暂无知识库」纯灰字无按钮。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): add guided empty states for kb, docs, and chat"
```

---

### Task 3: 启动依赖健康条（Ollama / 嵌入模型 / Chroma）

**Files:**
- Create: `src/components/common/DependencyHealthBanner.tsx`
- Create: `src/hooks/useDependencyHealth.ts`（或内联 hook）
- Modify: `src/components/layout/AppLayout.tsx`（在 titlebar 下或主内容顶挂载）
- Reuse: `check_ollama_status`、`chromadb_health`；设置里已有模型列表逻辑（`useOllama` / settings store 的 embed model）

**Interfaces:**
- Consumes:
  - `tauriCommand<OllamaStatusPayload>('check_ollama_status')`
  - `tauriCommand<ChromaDbHealthPayload>('chromadb_health')`
  - settings 中的 `embedding_model`（或等价 key）
- Produces: `DependencyHealth = { ollamaOk, embedModelPresent, chromaOk, messages: string[] }`

行为：
- 全部 OK → **不显示**横幅（避免常驻噪音）
- 任一失败 → 顶栏警告条，人话说明 +「打开设置」按钮
- 启动后检查一次；每 30s 或从设置页返回时再检查
- 文案示例：「本机 Ollama 未连接，嵌入与本地对话不可用」「未找到嵌入模型 nomic-embed-text，请在设置中拉取」「ChromaDB 未响应，向量检索暂不可用」

- [ ] **Step 1: 实现 `useDependencyHealth`**

```ts
export type DependencyHealth = {
  ready: boolean;
  ollamaOk: boolean;
  embedModelOk: boolean;
  chromaOk: boolean;
  issues: string[];
};
```

- [ ] **Step 2: Banner UI**

单行/可折行；`role="status"`；危险色用现有 `--color-warning` / `--color-error`，不要新造紫色告警。

- [ ] **Step 3: 挂到 AppLayout**

- [ ] **Step 4: 手工验收**

停 Ollama → 出现横幅；启动并 pull 模型且 Chroma 正常 → 横幅消失。

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: show dependency health banner when Ollama/Chroma missing"
```

---

### Task 4: 主路径文案（对话优先，工作台降级）

**Files:**
- Modify: `src/components/chat/ChatHeader.tsx`
- Modify: `src/components/chat/MessageList.tsx`（次要说明）
- Modify: `src/components/chat/RetrievalWorkbench.tsx` 或 `ModeSelector` / 工作台入口文案
- Modify: `src/components/document/EmbeddingProgress.tsx`（若有）— PDF/大文件等待时强调「仍在处理，请勿关闭」

原则：
- **默认故事：**「导入文档 → 在对话里提问」
- 检索工作台定位为 **「排查搜没搜对」的高级面板**，标题/tooltip 写清，不要和「聊天」抢主 CTA
- PDF：不在本任务做 Worker；只保证导入进度可见、失败可重试文案清楚

- [ ] **Step 1: 改 Chat 空态与 Header 副标题**

副标题示例：「基于本库文档检索后回答；需要核对命中片段时再打开检索工作台。」

- [ ] **Step 2: 工作台入口改名/加说明**

例如按钮「检索工作台」旁 title：`先看检索命中，再决定要不要问模型`。

- [ ] **Step 3: 验收** — 产品新人能说出主路径，不把工作台当唯一入口。

- [ ] **Step 4: Commit**

```bash
git commit -m "copy: clarify chat as primary path vs retrieval workbench"
```

---

### Task 5: 「一键导入演示语料」样例 KB

**Files:**
- Create: `src/assets/demo-kb/` **或** 打包只读资源：把 `evals/fixtures/mini-kb/*.md` 复制到 `public/demo-kb/`（Tauri 需能读到）
- Modify: 空状态 / 知识库概览 — 「导入演示文档」按钮
- Modify: `src/services/importer` 调用链或新建 `src/services/demo/seed-demo-kb.ts`

**Interfaces:**
- Consumes: 现有创建 KB + 导入文档 API（与 `DocumentImporter` 相同后端路径）
- Produces: `seedDemoKnowledgeBase(): Promise<{ knowledgeBaseId: string }>`  
  - 创建名为「演示知识库」的 KB（若已存在可跳过或复用）
  - 导入 5 个 markdown fixture
  - 触发既有解析/分块/嵌入流水线
  - 完成后 `navigate` 到该 KB 对话页

注意：
- 演示导入仍依赖本机 Ollama 嵌入；若健康检查未通过，按钮先触发 Task 3 的提示或 toast「请先连接 Ollama」
- 不要把二进制 release 打进仓库；fixture 文本很小，可进 git

- [ ] **Step 1: 把 fixture 放到前端可读路径**（`public/demo-kb/*.md` 最简单）

- [ ] **Step 2: 实现 seed 函数并接按钮**

- [ ] **Step 3: 验收** — 空库点击后出现演示 KB + 文档进入处理；完成后可对「混合检索 / Ollama 端口」等提问命中。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: one-click seed demo knowledge base from mini-kb fixtures"
```

---

### Task 6: README 截图位 + 演示录屏清单

**Files:**
- Create: `docs/screenshots/`（放入 3 张 PNG：知识库总览、对话+引用、设置/健康状态）
- Modify: `README.md` — 顶部或功能概览下插入截图
- Modify: `docs/ops/demo-checklist.md` — 固定 **90–120 秒** 录屏脚本

录屏脚本（写进 checklist）：

1. 0–15s：打开应用，健康条正常（或演示「未连接→连接」各 5s）
2. 15–40s：一键演示语料或快速导入，展示进度
3. 40–75s：提问 → 流式回答 → 点开引用
4. 75–100s：打开检索工作台对照命中（强调这是排查工具）
5. 100–120s：设置里指出本地嵌入 + 可选 SiliconFlow 仅生成

- [ ] **Step 1: 按 Task 1–5 完成后的 UI 截三张图**（人工；agent 可留空目录 + README 占位说明）

- [ ] **Step 2: README 增加截图 Markdown**

```markdown
## 界面预览

![知识库](docs/screenshots/01-overview.png)
![对话引用](docs/screenshots/02-chat-citation.png)
```

- [ ] **Step 3: 更新 demo-checklist 时码脚本**

- [ ] **Step 4: Commit**（截图与文案；视频可放 GitHub Release / 网盘，**不要**强行 commit 大 mp4）

```bash
git commit -m "docs: add screenshots and tighten demo checklist"
```

---

## 明确不做（本阶段）

- PDF 进 Web Worker（成本高；仅文案缓解）
- UI e2e / Playwright
- 全云 RAG
- `git filter-repo` 清历史（需要 force push；另议）
- 大改信息架构（多窗口、移动端）

## 验收总标准（Phase 10 Done）

1. 默认主题不再一眼「靛蓝模板」
2. 零数据状态下处处有主按钮引导
3. 依赖缺失时顶栏人话提示；正常时无横幅
4. 一键演示语料可走到「能提问」
5. README 有界面图；demo-checklist 有 2 分钟脚本

## Spec coverage

- UI 观感 → Task 1  
- 空状态 → Task 2  
- 品牌 → Task 1–2  
- 首次门槛 → Task 3 + 5  
- 主路径清晰 → Task 4  
- 样例 KB → Task 5  
- 截图/录屏 → Task 6  
- PDF 体感 → Task 4 文案 only  

---

## 执行方式

计划落地后可选：

1. **Subagent-Driven** — 每任务一个子代理 + 复查  
2. **Inline Execution** — 本会话按 Task 1→6 连续做，每任务检查点  

历史短板文档清理默认不做。
