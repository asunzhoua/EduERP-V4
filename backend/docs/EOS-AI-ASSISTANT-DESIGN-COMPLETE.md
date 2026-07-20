# EOS-AI-ASSISTANT-DESIGN-001 — 设计完成报告

> **Version**: 1.0
> **Date**: 2026-07-18
> **Status**: COMPLETED ✅
> **Owner**: Lobster (Orchestrator)
> **Type**: DESIGN ONLY — 无代码产出

---

## 完成摘要

按用户要求完成 EOS AI Assistant 纯架构设计，产出三份设计文档，涉及 3 个飞书机器人模式对比、GPT 职责边界定义、Lobster API 接口设计、权限与安全体系、命令规范。

## 产出物

| # | 文档 | 内容 | 文件大小 | 章节数 |
|:---|:-----|:------|:---------|:-------|
| 1 | `EOS-AI-ASSISTANT-ARCHITECTURE.md` | 架构设计 | 15.2 KB | 8 |
| 2 | `EOS-AI-ASSISTANT-SECURITY-DESIGN.md` | 安全设计 | 9.0 KB | 9 |
| 3 | `EOS-AI-ASSISTANT-USER-COMMAND-SPEC.md` | 命令规范 | 9.6 KB | 5 |
| — | **总计** | **三份纯设计文档** | **33.8 KB** | **22** |

## 文档结构

```
backend/docs/
├── EOS-AI-ASSISTANT-ARCHITECTURE.md        ← 主架构（15199字节）
├── EOS-AI-ASSISTANT-SECURITY-DESIGN.md     ← 安全设计（8966字节）
├── EOS-AI-ASSISTANT-USER-COMMAND-SPEC.md   ← 命令规范（9612字节）
└── EOS-AI-ASSISTANT-DESIGN-COMPLETE.md     ← 本报告
```

## 三个问题回答

### Q1: 飞书机器人采用哪种模式？

**推荐：方案 C — 两者结合（Webhook + 自建应用机器人）**

| 通道 | 用途 | 状态 |
|:-----|:------|:------|
| Webhook 群机器人（已有） | 出站通知：Mission 完成、系统异常、健康报告 | ✅ 已部署 |
| 自建应用机器人（新增） | 入站命令：@机器人查询/创建/控制 | ⏳ 需要 Event Server |

选择理由：充分利用已有 Webhook 资产，同时通过自建应用机器人获得双向通信能力。通知走 Webhook（稳定低成本），交互走 Event（灵活可扩展）。

Event 接收端推荐方案：开发阶段用 ngrok 隧道，生产阶段用轻量云服务器。

---

### Q2: GPT 职责边界

```
GPT = Natural Language Translator + Query Proxy
GPT ≠ Executor
GPT ≠ Lobster
```

**✅ 允许**：
- 解析自然语言 → 结构化命令
- 调用 Lobster API 查询系统状态
- 创建 Mission Draft（需用户确认后 Lobster 才执行）
- 格式化响应并发送通知
- 维护对话上下文

**❌ 禁止**：
- 直接修改 `.missions/` 文件
- 直接调用 Claude Code
- 启动 Pump Runner
- 绕过 Lobster 执行任何写入操作
- 修改 Governance 规则
- 读取 Token/密码

GPT 不知道 Pump Runner 和 Claude Code 的存在，只与 Lobster API 通信。

---

### Q3: Lobster 接口设计

暴露 **7 个接口**，通过 `lobster-api` CLI + JSON 协议：

| 接口 | 命令 | 权限 |
|:-----|:------|:-----|
| 1. 系统状态 | `--query status` | 全员（无需 Token） |
| 2. Mission 列表 | `--query list-missions` | 全员 |
| 3. Mission 详情 | `--query mission <ID>` | 全员 |
| 4. 系统健康 | `--query health` | 全员 |
| 5. 创建 Draft | `--draft create <描述>` | `draft:create` Token |
| 6. 确认 Draft | `--draft confirm <DRAFT_ID>` | `mission:create` Token |
| 7. 控制 Mission | `--mission <pause/resume/abort> <ID>` | `mission:control` Token |

安全设计：HMAC 签名 + Timestamp 限制 + Nonce 去重 + 速率限制 + 完整审计。

---

## 安全设计要点

| 安全边界层级 | 核心措施 |
|:------------|:---------|
| 飞书群成员 | 群白名单、命令分级权限、控制类口令验证 |
| 网络传输 | HTTPS、飞书 Event 签名验证 |
| GPT 进程 | 独立进程、敏感信息自动过滤、命令白名单 |
| Lobster API | HMAC 签名、Timestamp 窗口、Nonce 去重、速率限制 |
| Lobster 治理层 | 操作审计、参数校验、路径穿越防护、幂等性检查 |

紧急关闭流程：三步关闭（停 Event Server → 禁用飞书 Event → 删除 Token）。

## 命令规范要点

| 命令分类 | 数量 | 权限 |
|:---------|:-----|:-----|
| 查询类（状态/健康/列表/查看） | 4 | 全员 |
| 创建类（创建/快速创建） | 2 | 需授权 |
| 控制类（暂停/恢复/中止） | 3 | 仅主人（口令验证） |
| 系统类（帮助） | 1 | 全员 |

支持 10 个命令动词 + 20+ 同义词映射 + 多轮对话上下文维持 + 智能错误响应（6 种场景）。

---

## 不修改的组件清单

| 组件 | 不改的原因 |
|:-----|:-----------|
| Pump Runner (`pump-runner.py`) | 独立调度层，不需感知 AI Assistant |
| Claude Code CLI | 执行器，不与飞书通信 |
| `mission.state` 格式 | Runtime 真相源，不变 |
| `.missions/` 目录结构 | 不变 |
| `feishu-notify.py` | 已有通知脚本，不变 |
| Governance 规则 | CCAI-017 等现有规则不受影响 |

---

## 下一步建议（设计冻结后）

| 阶段 | 内容 | 依赖 | 建议时机 |
|:-----|:------|:-----|:---------|
| 1 | 实施 Feishu Notification Phase（已设计，待实施） | 无 | 设计冻结后可立即开始 |
| 2 | 创建 `lobster-api` CLI 工具 | Lobster 接口设计 | 阶段 1 完成后 |
| 3 | 配置飞书 Event Subscription + ngrok | 飞书 App 权限审批 | 阶段 2 完成后 |
| 4 | 实现 GPT 模块 | Event Server 可用 | 阶段 3 完成后 |

---

**设计结论**：EOS AI Assistant 架构设计与现有 EOS 系统完全兼容，不修改任何现有组件。引入 Layer 0 自然语言接口层，延续“飞书 ≠ Runtime”的核心原则，所有操作都有清晰的审计线和安全边界。
