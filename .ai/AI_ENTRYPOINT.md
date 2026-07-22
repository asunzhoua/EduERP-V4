# EduERP-V4 AI Entry Point

> 任何 AI Agent（GPT / Claude / QwenPaw / OpenCode）进入此项目时的唯一入口。

---

## Boot Sequence

AI Agent 接入项目时，按以下顺序读取：

1. 先读本文件（AI_ENTRYPOINT.md）— 了解入口和禁止事项
2. 读 PROJECT_CONTEXT.md — 理解项目和业务背景
3. 读 PROJECT_STATE.md — 了解当前状态和 Phase 进度
4. 读 AI_EXECUTION_RULES.md — 了解执行约束和规则
5. 如果涉及架构决策，再读 ARCHITECTURE.md

---

## 禁止事项

- 禁止猜测业务规则 — 所有规则以 PROJECT_CONTEXT.md 中的"核心业务规则"为准
- 禁止跳过验证 — 修改代码后必须确保测试通过
- 禁止修改未确认的模块 — 只处理明确指定的任务范围
- 禁止凭空创建架构文档 — 只基于实际代码和测试结果生成文档
- 禁止用 Markdown 表格输出 — 用户要求纯文本格式
- 禁止假设数据库列名 — 以实际 MySQL SHOW COLUMNS 结果为准
- 禁止假设前端响应格式 — 以 request.js 中的实际解析逻辑为准

---

## 关键文件索引

### 项目根目录
- README.md — 项目简介
- EduERP_AI_Context.md — 完整项目上下文（给 GPT 上传用的一站式文件）

### .ai/ 目录（AI 专用上下文）
- AI_ENTRYPOINT.md — 本文件
- PROJECT_CONTEXT.md — 项目背景、架构、业务规则、API
- PROJECT_STATE.md — 当前 Phase 进度、测试、构建、安全状态
- AI_EXECUTION_RULES.md — AI 执行规则和约束

### 后端
- backend/src/ — 完整源码
- backend/docs/ — EOS 技术设计文档

### 微信小程序
- miniapp/pages/ — 12 个页面
- miniapp/utils/request.js — API 请求封装

### 治理体系
- EOS/RULES.md — EOS 运行规则
- EOS/PROJECT_STATE.md — EOS 级状态
- EOS/DECISION_LOG.md — 架构决策记录
- EOS/EVIDENCE_LOG.md — 证据链索引

---

## AI 提问前的自检清单

- [ ] 我是否已读 PROJECT_CONTEXT.md？
- [ ] 我是否已读 PROJECT_STATE.md？
- [ ] 我是否已读 AI_EXECUTION_RULES.md？
- [ ] 我知道当前 Phase 是什么？
- [ ] 我知道测试状态吗？
- [ ] 我知道要修改的文件属于哪个模块？

---

*此文件由 EOS Orchestrator 维护，更新时同步更新 PROJECT_CONTEXT.md 和 PROJECT_STATE.md。*
