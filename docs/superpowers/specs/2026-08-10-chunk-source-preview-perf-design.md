# 分块预览「全文对照」性能优化

**日期：** 2026-08-10  
**状态：** 已确认  
**问题：** 文档分块较多时，文档详情页中间「全文对照」首屏加载慢，切换分块时也有卡顿  
**方案：** A（窗口化渲染 + 内存缓存）+ B（导入时落盘解析结果）

---

## 1. 目标与成功标准

### 1.1 目标

1. 打开分块预览时，「全文对照」尽快可用（优先消除重复整文件解析等待）
2. 切换左侧分块时，中间栏不明显卡顿（避免整篇原文 DOM 反复挂载）
3. 保留「对照原文并高亮当前分块」的能力；可选展开全文

### 1.2 成功标准

| # | 标准 |
|---|------|
| 1 | 同一文档二次打开（同会话或有磁盘缓存）：全文对照不再走完整 `parseDocument`，骨架明显缩短 |
| 2 | 默认模式下中间栏 DOM 只渲染当前分块附近窗口，不挂载整篇 `fullText` |
| 3 | 能匹配时高亮当前分块；切换分块时滚动/高亮更新流畅 |
| 4 | 匹配失败时展示当前分块内容 + 说明，不强制整篇 DOM |
| 5 | 删除文档 / 清空知识库时清理对应源预览缓存 |
| 6 | 旧文档无缓存时：首次打开可回退解析并回写缓存，行为兼容 |

---

## 2. 非目标

- 左侧「分块目录」虚拟滚动（另开任务）
- `list_document_chunks` 分页或去掉全量 `content`
- 加速解析器 / chunker 本身
- 改变分块算法或 `char_start`/`char_end` 语义（见 §4.2）
- 右侧「分块详情」改版

---

## 3. 方案选择

采用 **A + B**：

| 部分 | 内容 |
|------|------|
| **B 落盘** | 导入/重分块后把预览用 `DocContent` 写入 app data；预览优先读缓存 |
| **A 窗口化** | 默认只渲染高亮附近窗口；内存 Map 避免同会话重复读盘/解析；可选「展开全文」 |

未单独采用：

- **仅缓存仍整篇渲染**：首屏会好，切换仍可能卡
- **仅分块上下文拼贴**：实现简单，但失去真正原文对照

---

## 4. 数据存储与加载

### 4.1 磁盘格式

路径（相对 app data dir）：

```text
source_preview/{document_id}.json
```

JSON 形状：

```ts
type SourcePreviewCacheFile = {
  version: 1;
  document_id: string;
  content_hash: string;
  /** 已做过 mergeSectionsForPreview 的结构，与预览消费一致 */
  content: DocContent;
};
```

放文件系统、不进 SQLite，避免大 JSON 拖累主库。

### 4.2 坐标说明（重要）

现有 `chunk.char_start` / `char_end` 是 **分块内容依次拼接** 后的偏移，**不是** `buildFullDocumentText(sections)` 的下标。

因此定位高亮 **继续使用** `findHighlightInFullText(fullText, chunk)`（字符串匹配）；窗口从该匹配 range 向两侧扩展。  
**禁止**把裸 `char_start`/`char_end` 直接当 `fullText` 下标使用。

### 4.3 写入时机

1. **导入 / 重分块成功路径**：`parseAndChunk*` 已得到 `parsed.content` → `mergeSectionsForPreview` → 写盘（best-effort，失败只打日志，不阻断导入）
2. **预览冷启动未命中**：回退 `read_file_bytes` + `parseDocument` → 合并 sections → 写盘 + 进内存

### 4.4 加载顺序

```
loadDocumentSource(doc)
  1. 内存 Map[documentId] 且 content_hash 匹配 → 返回
  2. 读磁盘缓存且 content_hash 匹配 → 填内存 → 返回
  3. 读原文件并 parse → merge → 写盘 + 内存 → 返回
  4. 失败 → null（现有错误文案）
```

### 4.5 失效与清理

| 事件 | 行为 |
|------|------|
| 读盘 `content_hash` ≠ 文档当前 hash | 删坏缓存，走解析回退 |
| `delete_document` | 删 `source_preview/{id}.json` |
| `purge_knowledge_base` / 删 KB | 先列出该 KB 文档 id，逐个 `delete_source_preview_cache` |
| 重导入导致同 id 新 hash | 写入覆盖；旧 hash 自然失效 |

### 4.6 Tauri API（建议）

在既有 file/document 命令旁增加窄接口（命名可微调）：

- `read_source_preview_cache(document_id) -> Option<SourcePreviewCacheFile>`
- `write_source_preview_cache(payload: SourcePreviewCacheFile) -> ()`
- `delete_source_preview_cache(document_id) -> ()`

路径解析统一走 `app_data_dir()/source_preview/`。

---

## 5. 中间栏窗口化渲染

### 5.1 默认：上下文窗口

对当前文档：

1. `fullText = buildFullDocumentText(source.sections)`（`useMemo`，随 source 变）
2. `range = findHighlightInFullText(fullText, activeChunk)`
3. 若有 range：窗口 `[clamp(0, start - CONTEXT), clamp(len, end + CONTEXT)]`，默认 `CONTEXT = 3000` 字符，并向外扩到最近换行，避免半截词
4. DOM 结构：

```text
[…前文省略]（可选按钮「向上扩展」或依赖「展开全文」）
  窗口内文本，中间 <mark> 高亮 active 区间（相对窗口换算）
[后文省略…]
```

5. 切换 `activeChunk` → 只换窗口切片与 mark，不挂整篇

### 5.2 展开全文

- Header 增加「展开全文 / 收起」
- 展开：按 **section** 分块渲染多个节点（而非单一巨型 text node）；高亮所在 section 内再切 mark
- 默认仍为窗口模式

### 5.3 匹配失败

- 显示说明文案 + `activeChunk.content`（沿用现旁注思路）
- 不挂载整篇 `fullText`

### 5.4 与页面加载解耦

- `DocumentDetailPage` 仍可先加载 doc + chunks，左侧/右侧先可交互
- `ChunkSourcePanel` 在 `sourceLoading` 时单独 skeleton，不阻塞整页（若当前整页仍等 chunks，保持现状；不把 source 解析串进 chunks await）

---

## 6. 组件与模块边界

| 模块 | 职责 |
|------|------|
| `src/services/document/source-preview.ts` | 加载顺序、merge、内存 Map；调用 Tauri 读写缓存 |
| `src/services/importer/*` | 解析成功后触发写缓存 |
| `src-tauri` source preview commands | 读写删缓存文件 |
| `delete_document` / KB purge | 调用删缓存 |
| `ChunkSourcePanel.tsx` | 窗口/展开 UI、高亮、滚动 |
| `chunk-display.ts` | 可抽 `sliceContextWindow(fullText, range, context)`；定位逻辑保持现有 find* |

---

## 7. 错误处理

- 写缓存失败：导入继续；预览仍可回退解析
- 读缓存 JSON 损坏：删除文件并回退解析
- 原文件缺失且无有效缓存：中间栏显示现有「无法加载原文…」
- 展开全文时超大文档：允许短暂卡顿；默认路径仍走窗口，不把展开设为默认

---

## 8. 测试与验收

### 8.1 手工

1. 导入中大型 docx/md → 打开分块预览：有缓存后二次打开中间栏明显更快
2. 快速点击左侧多个分块：中间高亮跟随，无明显整页卡死
3. 展开全文 / 收起正常
4. 删文档后对应缓存文件消失
5. 无缓存旧文档：首次打开可解析并生成缓存

### 8.2 单测（优先）

- `sliceContextWindow` 边界（开头/结尾/无 range）
- 缓存 hash 不匹配时加载走解析路径（可 mock Tauri）

---

## 9. 实现分期（供 plan 拆分）

1. Tauri 缓存读写删 + 删除文档时清理  
2. `loadDocumentSource` 三级加载 + importer 写缓存  
3. `ChunkSourcePanel` 窗口化 + 展开全文  
4. 验收与回归
