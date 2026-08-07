# Screenshots（墨书工作台 · README 预览）

本目录存放根 [`README.md`](../../README.md)「界面预览」引用的三张 PNG。截图需在 **墨书工作台（ink-study）主题** 下、应用真实运行后人工截取；本仓库 CI / 无 GUI 环境无法自动生成二进制文件。

## 前置条件

与 [`docs/ops/demo-checklist.md`](../ops/demo-checklist.md) 一致：

1. **依赖就绪**：Ollama 已启动并已 `ollama pull nomic-embed-text`；设置 → 数据管理中 ChromaDB 心跳正常。
2. **启动应用**：`npm run tauri dev`（勿用 `npm run dev`，否则无原生能力与完整壳层）。
3. **演示语料**：首页或空库时点 **「导入演示语料」**，等待文档状态为 **「就绪」**（演示库名：`演示知识库`）。
4. **窗口**：建议 1280×800 或更大；100% 缩放；浅色纸感主题（默认）。

## 三张必截 PNG

| 文件名 | 对应 demo-checklist 时段 | 画面要求 |
|--------|--------------------------|----------|
| `01-overview.png` | 15–40s（导入/状态） | 进入 **演示知识库** 后的 **厚概览** `/kb/:id`：深侧栏 + 纸感主区、顶栏「概览 \| 文档 \| 对话」、最近对话/文档动态、**「开始提问」** CTA；至少 1 份文档「就绪」。 |
| `02-chat-citation.png` | 40–75s（问答 + 引用） | **对话页**：居中阅读栏、流式或完整回答；**引用 pill / 脚注可辨**（可点开引用面板）；排查检索抽屉 **默认关闭**。示例问题：`混合检索是怎么工作的？` 或库内可答问题。 |
| `03-settings-health.png` | 0–15s 或 100–120s | **二选一**：(A) 顶栏 **DependencyHealthBanner** 正常（绿/无告警），或 (B) **设置** 页展示 Ollama / Chroma / 本地嵌入与可选 SiliconFlow「只碰生成」说明。 |

## 逐步操作（推荐顺序）

### 1. `01-overview.png` — 厚概览

1. 侧栏选中「演示知识库」（或导入语料后自动进入）。
2. 确认默认落在 **概览**  Tab（非对话、非文档列表）。
3. 确保概览卡片、最近对话、文档动态、主 CTA 均在视口内；必要时略缩小窗口高度以收全屏。
4. 截取 **主内容区 + 侧栏**（可含 Titlebar mark「本地知识库」）。

### 2. `02-chat-citation.png` — 对话 + 引用

1. 概览点 **「开始提问」** 或顶栏切到 **对话**。
2. 输入库内问题，等待回答与 **引用标记** 出现。
3. 可选：展开一条引用，使 pill / 来源文档名可见。
4. 确认 **排查检索** 未常驻（抽屉关闭）；对话栏居中、阅读感清晰。

### 3. `03-settings-health.png` — 设置或健康条

**方案 A（健康条）**：重启应用或确保依赖已连接，顶栏细条显示正常后截取全宽顶栏 + 侧栏一角。

**方案 B（设置页）**：侧栏底部 **设置** → 展示 Ollama 地址、嵌入模型、Chroma 状态或数据管理区； SiliconFlow 区块可一并露出以体现「只云端生成」。

## 导出与提交

1. **Windows**：`Win + Shift + S` 区域截图 → 另存为 PNG；macOS：`Cmd + Shift + 4`。
2. 保存到本目录，**文件名必须与上表完全一致**（小写、连字符）。
3. 本地打开 [`README.md`](../../README.md) 预览，确认三张图可渲染。
4. 提交示例：

```bash
git add docs/screenshots/01-overview.png docs/screenshots/02-chat-citation.png docs/screenshots/03-settings-health.png README.md docs/screenshots/README.md
git commit -m "docs: add ink-study UI screenshots for README"
```

## 验收

- [ ] 三张 PNG 存在且非占位图
- [ ] 视觉为墨书工作台（深侧栏 `#1c2422`、纸感主区 `#f7f6f3`，非旧版扁平后台）
- [ ] README 表格路径与 `![...](docs/screenshots/....png)` 一致
- [ ] 与 demo-checklist 90–120s 录屏脚本可互证

未截齐前，README 中图片链接会 404；属预期，需在本机跑 app 后补图。
