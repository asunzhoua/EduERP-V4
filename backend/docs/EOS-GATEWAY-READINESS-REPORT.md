# EOS Gateway Readiness Report

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **审计来源**: HEARTBEAT-PRODUCTION-AUDIT.md + CLAUDE-CODE-MONITORING-FACT-AUDIT.md + FEISHU-GATEWAY-PREREQUISITE.md + EOS-CURRENT-SYSTEM-STATE-REPORT.md  

---

## 1. 审计总览

| 审计批次 | 引用文档 | 结论 |
|:---------|:---------|:------|
| Batch 1: 系统基线 | `EOS-CURRENT-SYSTEM-STATE-REPORT.md` | ✅ 系统功能正常，但未完全自动化 |
| Batch 1: Lobster 能力 | `LOBSTER-ACTIVE-CAPABILITY-AUDIT.md` | ✅ 5项主动能力全部就绪 |
| Batch 2: Heartbeat 完整性 | `HEARTBEAT-PRODUCTION-AUDIT.md` | ✅ 通过（有条件: 凭证据久化） |
| Batch 2: CC 监控事实 | `CLAUDE-CODE-MONITORING-FACT-AUDIT.md` | ⚠️ 仅通过 mission.state 间接监控 |
| Batch 2: 网关前置条件 | `FEISHU-GATEWAY-PREREQUISITE.md` | 📋 5项必须新增 + 8项架构边界 |

---

## 2. 已就绪能力清单

| 能力 | 状态 | 备注 |
|:-----|:------|:------|
| Heartbeat 定时检测 | ✅ 已部署 | 15min周期，Windows Task Scheduler |
| Feishu Board 检测 | ⚠️ 待凭证 | 代码完整，缺FEISHU_APP_ID/SECRET持久化 |
| Runtime State 检测 | ✅ 已部署 | FAILED/PAUSED/STALE完整检测 |
| Liveness 检测 | ✅ 已部署 | 4h空闲通知 |
| 通知去重 | ✅ 已部署 | 3600s冷却期 |
| 异常通知推送 | ✅ 已部署 | feishu-notify.py → 飞书群Webhook |
| Session Recovery | ✅ 规则就绪 | AGENTS.md L73-L110 |
| 架构边界 | ✅ 零越权 | 飞书→Pump Runner→CC 隔离完整 |

---

## 3. 缺失能力清单

| 能力 | 缺失类型 | 影响 | 何时需要 |
|:-----|:---------|:------|:---------|
| CC 进程检测 | 功能缺失 | 无法直接判断CC是否存活 | 双向入口前 P0 |
| evidence/exit_code 分析 | 功能缺失 | 无法自动分析失败原因 | 双向入口前 P0 |
| CC stdout 心跳监控 | 功能缺失 | 无法判断CC是否卡死（仅靠30min STALE） | 双向入口前 P0 |
| `im:message` 权限 | 未开通 | 无法接收飞书消息 | 双向入口必须 |
| Event 接收服务器 | 未开发 | 飞书回调无落脚点 | 双向入口必须 |
| GPT 翻译层 | 未开发 | 无法将自然语言→Draft | 双向入口必须 |
| 用户白名单验证 | 未设计 | 无法控制谁可操作 | 双向入口必须 |

---

## 4. 风险项

| 风险 | 严重度 | 说明 | 缓解措施 |
|:-----|:-------|:------|:---------|
| CC 进程崩溃不可知 | 高 | 无 tasklist 检测，仅靠30min STALE | 在心跳中添加 tasklist 检测（2小时工作量） |
| Feishu Board 凭证未持久化 | 中 | Board 检测 SKIP 导致无法发现待处理任务 | Owner 执行 setx 命令（5分钟） |
| Event 服务器 ngrok 不稳定 | 中 | 开源ngrok 有连接数/时长限制 | 生产环境需云服务器 |
| GPT 翻译幻觉 | 中 | GPT 生成错误的 Mission Draft | Lobster 强制审核确认 |
| 权限审批周期 | 低 | `im:message` 需管理员审批 | 提前申请 |

---

## 5. 结论

### ⚠️ NOT READY — 需完成 P0 前置条件

### 理由

双向入口（Phase 4.1/4.2）当前不可启动。3个必要条件未满足：

**条件 1 — 基础检测完整（P0）**
- ❌ CC 进程检测缺失（无 tasklist）
- ❌ evidence/exit_code 分析缺失
- ⚠️ STALE 检测存在但单一

**条件 2 — 飞书权限（P1）**
- ❌ `im:message` 未开通
- ❌ `im:chat` 未开通
- ⚠️ Webhook 是单向通道，不足以支撑双向

**条件 3 — 基础设施（P1）**
- ❌ Event 接收服务器未开发
- ❌ GPT 翻译层未开发
- ❌ 白名单验证未设计

### 恢复条件

| 条件 | 优先级 | 完成后状态 |
|:-----|:-------|:-----------|
| 持久化 FEISHU_APP_ID/SECRET | P0 | Board 检测激活 |
| 心跳添加 tasklist 进程检测 | P0 | CC 存活可判定 |
| 开通 `im:message` 权限 | P1 | 飞书可接收消息 |
| Event 服务器 MVP | P1 | 双向入口基础就绪 |

**三者全部满足后 → READY**

---

### 建议路径

```
Step 0 (已就绪) → 当前系统冻结
    │
Step 1 (P0, 1天) → 完善心跳检测
    ├── 持久化飞书凭证 (5min) ← 等Owner
    ├── 添加 tasklist 进程检测 (2h)
    └── 添加 evidence/exit_code 分析 (2h)
    │
Step 2 (P0, 30min) → 申请 im:message 权限
    └── 飞书管理员审批
    │
Step 3 (P1, 1周) → Event 服务器 + GPT 翻译
    ├── Flask 服务器 + ngrok
    ├── Token 验证 + 白名单
    └── GPT 自然语言→Draft
    │
Step 4 (验证) → 完整闭环
    └── 飞书群发消息 → 收到回复
```

**当前瓶颈**: `im:message` 权限申请（需 Owner 在飞书开发者后台操作）
**次瓶颈**: tasklist 进程检测（需修改 heartbeat_check.py，1-2小时）
**建议**: 先做能做的（tasklist + 凭证持久化），权限申请与代码开发并行
