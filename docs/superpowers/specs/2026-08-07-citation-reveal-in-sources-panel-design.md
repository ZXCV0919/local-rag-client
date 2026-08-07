# 引用点击：右侧文档面板定位高亮

**日期：** 2026-08-07  
**状态：** 已确认  
**前置：** Cursor 式极简三栏工作台（右侧 Sources 面板已存在）  
**目标：** 点击引用后不再弹出中间浮层，改为在右侧文档面板定位并高亮对应分块

---

## 1. 目标与成功标准

### 1.1 目标

用户在对话中点击来源引用时：

1. **不显示**中间 `CitationPopover` 浮层（图一红框）
2. **自动展开**右侧文档面板（若已关闭）
3. 在右侧预览中**选中对应文档**、**滚动到对应分块**并**高亮**

内联引用 pill 与底部「参考来源」卡片行为一致。

### 1.2 成功标准

| # | 标准 |
|---|------|
| 1 | 点内联引用：无中间浮层；右侧打开并高亮对应分块 |
| 2 | 点底部来源卡片：同上，不跳转文档详情页 |
| 3 | 面板关闭时点击：先展开再定位 |
| 4 | 同一引用重复点击：仍触发滚动与短时高亮 |
| 5 | 文档详情页现有 `?chunk=` 定位行为不受影响 |

---

## 2. 非目标

- 不改造文档详情页 `ChunkPreview` / `ChunkSourcePanel`（完整原文对照仍走文档页）
- 不改检索结果面板（`SearchResultsPanel`）的跳转逻辑（本次范围外）
- 不新增「查看全文」次要入口（浮层完全移除；截断边界仅 toast 提示）
- 不引入 URL query 深链驱动右侧定位（避免与 `/documents/:id?chunk=` 混淆）

---

## 3. 方案选择

采用 **SourcesPanel 上下文驱动定位**（方案 1）：

- 扩展 `SourcesPanelContext`，提供 `revealChunk({ documentId, chunkId })`
- 点击方只调用 context；右侧面板订阅并执行选中 / 滚动 / 高亮

未采用：

- **路由 query 驱动**：会弄脏对话路由，并与文档页 `?chunk=` 语义冲突
- **直接跳文档详情页**：离开对话主舞台，不符合「右侧文档中定位」

---

## 4. 交互与数据流

```
Citation / SourceCard click
  → resolve chunk (documentId + chunkId)
  → revealChunk({ documentId, chunkId })
  → SourcesPanelContext: open=true + focusChunk={ documentId, chunkId, nonce }
  → SourcesPanel: setSelectedDocId(documentId)
  → DocumentPreviewPane: scroll to chunk + highlight
```

### 4.1 状态形状

扩展 `useSourcesPanel` / `SourcesPanelContext`：

```ts
type FocusChunk = {
  documentId: string;
  chunkId: string;
  nonce: number; // 同一 chunk 重复点击仍能触发效果
};

revealChunk(target: { documentId: string; chunkId: string }): void;
// 实现：setOpen(true)；setFocusChunk({ ...target, nonce: prev+1 })
```

面板开关仍用现有 `ui.sourcesPanelOpen` localStorage。

---

## 5. 组件改动

### 5.1 点击入口

| 组件 | 改动 |
|------|------|
| `MessageBubble` | 内联引用按钮 `onClick` → 取 `chunkId` 对应 chunk 的 `document_id` → `revealChunk`；去掉 `CitationPopover` 包裹 |
| `MessageSourcesBar` | 卡片点击改为 `revealChunk`；移除 `navigate('/documents/...?chunk=')` |
| `CitationPopup.tsx` | 移除浮层用法后删除该文件（或同步清理无用导出） |

点击前需拿到 `documentId`：

- 来源卡片路径：已加载 `chunk`，直接用 `chunk.document_id`
- 内联引用路径：若尚未加载 chunk，点击时 `get_chunk(chunkId)` 再 `revealChunk`；失败则 toast

### 5.2 右侧面板

| 组件 | 改动 |
|------|------|
| `SourcesPanel` | 订阅 `focusChunk`；有值时 `setSelectedDocId(documentId)`；将 `focusChunkId` + `nonce` 传给预览 |
| `DocumentPreviewPane` | 按分块渲染（每块 `data-chunk-id`）；收到 focus 时滚动到该块并施加高亮样式（短时 pulse，使用现有 citation 高亮色变量） |

预览仍可保留现有截断上限（`MAX_CHUNKS` / `MAX_CHARS`），但渲染结构需支持按 chunk 定位，不能只拼成一段不可寻址纯文本。

### 5.3 不改动

- `DocumentDetailPage` + `ChunkPreview` + `ChunkSourcePanel`
- `SourcesPanel` 文档列表布局与开关记忆

---

## 6. 边界情况

| 情况 | 处理 |
|------|------|
| 右侧面板已关闭 | `revealChunk` 先 `setOpen(true)`，再定位高亮 |
| 目标文档不在当前 KB 列表 | toast「找不到该文档」 |
| chunk 加载失败 / ID 无效 | 尽量打开面板；toast「未找到对应片段」 |
| 同一引用连点两次 | `nonce` 递增，再次滚动并短时高亮 |
| 目标分块在预览截断范围外 | 选中文档 + toast「片段在截断范围外，可打开全文」；本次不强制加跳转入口 |
| 引用缺 `chunkId` 映射 | 无动作（与现网一致） |

---

## 7. 测试

### 7.1 自动化

扩展 `useSourcesPanel` 相关测试：

- `revealChunk` 将 `open` 设为 `true`
- `focusChunk` 写入正确的 `documentId` / `chunkId`
- 同一目标再次调用时 `nonce` 变化

### 7.2 手动

1. 对话页点内联引用 → 无浮层；右栏展开并高亮
2. 点底部来源卡片 → 同上，路由仍停在对话页
3. 关闭右栏后再点 → 自动展开并定位
4. 连点同一引用 → 每次都有滚动/高亮反馈
5. 打开文档详情 `?chunk=` → 原行为正常

---

## 8. 实现顺序（供计划拆分）

1. 扩展 `useSourcesPanel` + context 类型与单测
2. `DocumentPreviewPane` 分块渲染 + focus 滚动高亮
3. `SourcesPanel` 订阅 `focusChunk` 并选中文档
4. `MessageBubble` / `MessageSourcesBar` 改为 `revealChunk`
5. 删除 `CitationPopup` 及相关引用
6. 手动验收上表场景
