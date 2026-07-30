# 明显短板解决方案（按严重度）

> 对应秋招项目评估中的短板清单。每条给出：**问题影响 → 目标 → 方案选型 → 落地步骤 → 验收标准 → 面试话术**。
>
> 与迭代执行计划的映射见：`docs/superpowers/plans/2026-07-31-phase9-autumn-interview-hardening.md`

---

## 总览

| 严重度 | 短板 | 归属迭代 | 建议工期 |
|--------|------|----------|----------|
| 高 | 无自动化测试 / CI | P0 | 3–5 天 |
| 高 | 无 golden Q&A / 检索评测 | P0 | 3–5 天 |
| 中 | 重排非神经模型 | P1 | 5–7 天 |
| 中 | 依赖本机 Ollama + Chroma | P0 文档 + P2 可选硬化 | 1–2 天文档；可选更长 |
| 中 | 主线程解析分块 | P1 | 3–5 天 |
| 中 | 云端 API Key 前端可读 | P2 | 3–5 天 |
| 低 | 根 README 仍是模板 | P0 | 0.5–1 天 |

原则：先补「能证明正确 / 能量化变好」的防护网，再做深度与安全；不一次性重写架构。

---

## 高 · 1 无自动化测试 / CI

### 问题影响
面试被问「怎么保证正确？」时缺少客观证据；回归依赖手工点点点，改检索/切分易 silently break。

### 目标
- 纯逻辑模块有单测，CI 可跑
- 不追求全量 e2e（桌面端成本高），先覆盖 RAG 核心纯函数

### 方案选型
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| A. Vitest 测 `src/services` 纯函数 | 快、零 UI、与 Vite 同栈 | 不覆盖 Tauri IPC | **推荐** |
| B. Playwright 全 UI e2e | 贴近真实 | 依赖本机 Ollama/Chroma，脆 | 暂缓 |
| C. Rust `#[cfg(test)]` 测 FTS | 贴近关键词检索 | 需 fixture DB | P0 可选 1–2 个 smoke |

### 落地步骤
1. 增加 `vitest` + `npm run test`
2. 优先单测（不依赖网络/本机服务）：
   - `src/services/retrieval/reranker.ts`
   - `src/services/retrieval/relevance-gate.ts`
   - `src/utils/citations.ts`
   - `src/services/chunker/`（heading / overlap 边界）
   - `src/services/llm/context-window.ts`（预算裁剪）
3. 可选：GitHub Actions `on: push` → `npm ci && npm test && npm run build`（前端构建即可，不必每次 `tauri build`）

### 验收标准
- `npm test` 通过，核心模块 ≥ 20 条断言级用例
- README / 面试稿能写出「测了哪些、故意没测哪些」

### 面试话术
「桌面端全链路 e2e 成本高，我先把无副作用的检索融合、拒答门控、引用解析做成单测；IPC 与 Ollama 用手工冒烟 + 评测集兜底。」

---

## 高 · 2 无 golden Q&A / 检索评测

### 问题影响
无法证明 hybrid / 门控 / 重排「变好了」；面试深挖只能讲感觉。

### 目标
固定一小套问答与标注，能离线算出「Top-K 命中率 / 引用覆盖」等简单指标。

### 方案选型
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| A. 静态 JSON 评测集 + Node 脚本调检索函数 | 可控、可复现、易讲 | 需一份固定样例库或 mock chunks | **推荐** |
| B. RAGAS / DeepEval 全自动 | 看起来高级 | 依赖 LLM 判分、成本与噪声大 | 有余力再加 |
| C. 只做人工表格 | 零开发 | 不可回归 | 不够 |

### 落地步骤
1. 建目录 `evals/`：
   - `evals/fixtures/mini-kb/`：3–5 篇短文（可提交仓库）
   - `evals/golden.json`：每条含 `query`、`relevant_chunk_ids` 或 `must_contain`、`expect_decline`（可选）
2. 脚本 `evals/run-retrieval-eval.ts`：
   - 对 hybrid / semantic / keyword 分别跑
   - 输出：Hit@K、MRR（简易）、拒答准确率（该拒则拒、不该拒则放行）
3. 把一次运行结果贴进 `evals/RESULTS.md`（基线数字）
4. （可选）再跑「仅 RRF」vs「RRF+词法加成」对比表

### 验收标准
- 仓库内可 `npm run eval:retrieval` 产出表格
- 至少 15 条 golden（含 2–3 条应拒答样本）
- 面试可展示「改融合权重前后 Hit@5」对比

### 面试话术
「我没有假装 SOTA 评测，但有固定 golden set 和 Hit@K；改检索策略时能用数字对比，而不是凭感觉。」

---

## 中 · 3 重排非神经模型

### 问题影响
被问 cross-encoder / LLM rerank 时显得浅；当前加权 RRF 合理，但缺「进阶一档」的对比故事。

### 目标
保留 RRF 为默认；增加**可选**第二阶段重排，并用评测集证明何时有用。

### 方案选型
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| A. LLM listwise 重排（本地/云端） | 实现快、无新模型文件 | 延迟与成本高 | **P1 首选**（开关默认关） |
| B. 本地 cross-encoder ONNX | 延迟可控、更「检索正统」 | 打包体积与加载复杂 | P1 备选 / P2 |
| C. 只调 RRF 超参 | 简单 | 无法回答「神经重排」 | 不够 |

### 落地步骤
1. 设置项：`rerank_mode: 'rrf' | 'llm'`（默认 `rrf`）
2. `llm` 路径：对 Top-N（如 20）候选，让模型输出排序 JSON，再截断到 `maxResults`
3. fail-open：解析失败则回退 RRF 顺序
4. 用 golden set 对比两种模式的 Hit@K 与延迟

### 验收标准
- 默认行为与现网一致（RRF）
- 打开 LLM 重排后评测可跑通；有一份对比表
- 设置页有简短说明：「更准但更慢」

### 面试话术
「默认用加权 RRF 控延迟；可选 LLM 重排做第二阶段。我在 golden set 上比过 Hit@K，xxx 类问题提升明显，延迟大约多 y 秒，所以做成开关。」

---

## 中 · 4 依赖本机 Ollama + Chroma

### 问题影响
「一键可运行」不成立；演示翻车风险高（服务未起、端口占用、Python 环境）。

### 目标
降低首启挫败；面试/演示有明确排障路径。不强制把 Chroma 打进单二进制（成本过高）。

### 方案选型
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| A. 启动检测 + 引导 UI + 排障文档 | 投入小、立刻减风险 | 仍需用户装依赖 | **P0 必做** |
| B. 内嵌 Chroma / 换纯本地向量库 | 依赖少 | 大改存储层 | 超出秋招窗口，仅作「未来」 |
| C. Docker Compose 一键依赖 | 对开发友好 | 对普通用户仍重 | README 可选附录 |

### 落地步骤
1. 首启 / 设置页：检测 Ollama、Chroma 可达性；失败时中文指引（安装链接、默认端口、常见错误）
2. README「环境依赖」章节 + `docs/ops/troubleshooting.md`（5 条最高频故障）
3. 演示前 checklist（1 分钟）：模型是否已 pull、知识库是否 ready、检索模式

### 验收标准
- 冷启动失败时用户能看到「缺什么、怎么装」，而不是白屏/模糊报错
- 面试官问依赖时，能 30 秒讲清边界与降级策略

---

## 中 · 5 主线程解析分块

### 问题影响
大 PDF/DOCX 导入时 UI 卡顿；被问 Web Worker / 任务队列时被动。

### 目标
解析+分块移出 UI 主线程；进度回调仍更新 UI。

### 方案选型
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| A. Vite Worker：parse/chunk | 标准、改动局部 | pdf.js 已有 worker，需理清双 worker | **推荐** |
| B. 全部丢给 Rust | 性能好 | 重写 parser，周期长 | 不选 |
| C. `scheduler` / 分片 `requestIdleCallback` | 实现快 | 仍占主线程 | 临时缓解，不够 |

### 落地步骤
1. 将 `parser` + `chunker` 调用收口到 `importer` 的 worker 消息协议
2. 主线程只收进度事件与结果 chunks
3. 用一份 20MB+ PDF 做前后卡顿对比（可录屏）

### 验收标准
- 导入大文件时窗口可拖动、可点取消（若已有取消则保持）
- 面试能讲「为何留在 TS、如何用 Worker 隔离」

---

## 中 · 6 云端 API Key 前端可读

### 问题影响
安全意识被质疑；Key 在 SQLite / WebView 内存中明文，有本地恶意脚本/扩展理论风险。

### 目标
Key 不进入前端 JS 可读状态；聊天请求经 Rust 代理带 Authorization。

### 方案选型
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| A. Rust 命令代理 SiliconFlow 流式 | 符合 Tauri 安全模型 | 要改 stream 路径 | **P2 推荐** |
| B. OS Keychain 存 Key，仍由前端读出使用 | 静态落盘更好 | 运行时前端仍可见 | 过渡方案 |
| C. 不支持云端 | 最安全 | 削弱产品能力 | 不选 |

### 落地步骤
1. 设置页：写入 Key 只调 `save_secret`；读回只返回「已配置 / 未配置」掩码
2. 新增 `chat_stream_siliconflow`（或通用 proxy）：Rust 读库中 Key，转发 SSE/流
3. 前端 `chat-provider` 在 siliconflow 模式下走 Tauri 事件流，不再带 Bearer
4. 文档写明：本地恶意进程仍可能读用户目录——威胁模型是「防前端泄漏」而非「防本机 root」

### 验收标准
- DevTools / 前端 store 中看不到完整 Key
- SiliconFlow 流式问答与取消仍可用

---

## 低 · 7 根 README 仍是模板

### 问题影响
GitHub / 简历链接第一印象减分；与真实产品能力严重不符。

### 目标
5 分钟内让陌生人看懂：是什么、怎么跑、架构要点、演示路径。

### 落地步骤
1. 重写根 `README.md`：功能列表、截图/GIF 位、环境依赖、开发命令、打包命令、架构简图、文档索引链接
2. 标明版本 1.0 与 `release/v1.0.0` 安装包用途
3. 删掉 Vite/Tauri 模板套话

### 验收标准
- 非作者按 README 能装依赖并 `npm run tauri dev`（或至少知道差哪一步）

---

## 短板 → 迭代映射（速查）

```
高·测试/CI     ──► P0 Task A
高·评测集      ──► P0 Task B
低·README      ──► P0 Task C
中·依赖体验    ──► P0 Task D（检测+文档） / P2 更深封装（可选）
中·神经重排    ──► P1 Task E
中·主线程卡顿  ──► P1 Task F
中·Key 安全    ──► P2 Task G
P2 另含        ──► CI 工作流完善、演示视频/checklist
```
