# EOS Next Phase Roadmap

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **依据**: 基于系统基线审计 + Lobster 能力审计 + 架构边界验证的事实排列  
> **原则**: 禁止提前开发未验证需求

---

## 优先级排序

```
Priority 0: 系统稳定性 ─── 现有能力加固
    │
Priority 1: 飞书双向入口 ─── 核心能力扩展
    │
Priority 2: GPT API Gateway ─── 智能入口
    │
Priority 3: 监控增强 ─── Claude Code 可观测性
```

---

## Priority 0: 系统稳定性

**状态**: 部分完成，有遗留问题

| 事项 | 状态 | 工作量 | 依赖 |
|:-----|:-----|:-------|:-----|
| 清理 pump-test-001 PAUSED 状态 | ⏳ 待处理 | 5分钟 | 无 |
| Cron 定时心跳部署 | ⏳ 设计完成 | 1小时 | HEARTBEAT.md + CRON-HEARTBEAT-DESIGN.md |
| 环境变量持久化验证 | ✅ 已完成 | — | — |
| Webhook 通知稳定性验证 | ✅ 已完成 | — | — |

**建议**: 先部署 Cron 定时心跳（30分钟周期），让 Heartbeat 自动检测投产。清理 testing 遗留的 PAUSED mission。

---

## Priority 1: 飞书双向入口

**状态**: 设计完成（EOS-AI-ASSISTANT-ARCHITECTURE.md），等待 Owner 审核

| 阶段 | 事项 | 工作量 | 依赖 |
|:-----|:-----|:-------|:-----|
| Phase 4.1 | 开通 `im:message` + `im:chat` 权限 | 10分钟 | 飞书开发者后台 |
| Phase 4.1 | 重新发布飞书应用版本 | 5分钟 | 权限审核通过 |
| Phase 4.1 | 开发 Event 接收服务器（ngrok + Flask） | 4小时 | 权限开通 |
| Phase 4.1 | Event Subscription 配置 | 1小时 | 服务器就绪 |
| Phase 4.1 | 飞书群能收发消息 | — | 以上全部完成 |

**风险**:
- `im:message` 权限需要管理员审批（上次已做过一次）
- Event 服务器需要公网可达（ngrok 用于开发，生产需云服务器）
- ngrok 有连接数限制，长时间运行可能断连

**建议**: 先部署 Phase 4.1 最小可行版本，验证 Event Subscription 链路后再扩展。

---

## Priority 2: GPT API Gateway

**状态**: 设计完成，需双向入口就绪后实施

| 阶段 | 事项 | 工作量 | 依赖 |
|:-----|:-----|:-------|:-----|
| Phase 4.2 | GPT 接入飞书消息处理 | 8小时 | Phase 4.1 完成 |
| Phase 4.2 | Lobster 状态查询接口开发 | 4小时 | GPT 接入 |
| Phase 4.2 | Mission Draft 生成逻辑 | 4小时 | 状态查询接口 |
| Phase 4.2 | 权限验证体系 | 4小时 | Draft 逻辑 |

**风险**:
- GPT API 成本：每次查询消耗 Token，需预估
- GPT 幻觉：生成的 Draft 需要 Lobster 审核确认机制

**建议**: GPT 只做查询和 Draft 生成，不做任何执行操作。

---

## Priority 3: 监控增强

**状态**: 设计完成（CLAUDE-CODE-MONITORING-DESIGN.md）

| 事项 | 工作量 | 依赖 |
|:-----|:-------|:-----|
| Claude Code 进程心跳检测 | 2小时 | Heartbeat 现有机制 |
| 超时自动告警 | 1小时 | 通知脚本已就绪 |
| 执行证据自动检查 | 1小时 | Pump Runner 已有 evidence |

**建议**: 在部署 Cron 定时心跳时一并实现，代码量小，收益高。不单独开辟阶段。

---

## 路线图 Gantt

```
Week 1          Week 2          Week 3          Week 4
│               │               │               │
P0: Cleanup     P1: Phase 4.1   P1: Phase 4.1   P2: Phase 4.2
├─ pump cleanup ├─ im:message   ├─ Event Server ├─ GPT 接入
├─ cron deploy  ├─ 重新发布     ├─ Subscription ├─ Lobster API
└─              └─              └─ 测试         └─ Draft
                │               │               │
                P3: Monitoring  P3: Monitoring
                ├─ 超时告警     ├─ 进程检测
                └─              └─
```

---

## 成本估算

| 阶段 | 预估人时 | 风险等级 |
|:-----|:---------|:---------|
| P0: 系统稳定性 | 2小时 | 低 |
| P1: 飞书双向入口 | 12小时 | 中（权限） |
| P2: GPT API Gateway | 20小时 | 高（集成复杂度） |
| P3: 监控增强 | 4小时 | 低 |

---

## 决策建议

基于审计事实，推荐执行顺序：

1. **立即** → P0: 清理 pump-test-001 + 部署 Cron 心跳（2h）
2. **下一步** → P1: 开通 `im:message` 权限 + 重新发布（15min）
3. **审核后** → P1: Phase 4.1 Event 服务器开发（4h）
4. **并行** → P3: Claude Code 超时告警（2h，集成到心跳）
5. **条件** → P2: 需 Owner 明确 GPT 模型选型后启动

**禁止**: 在 Owner 未审核架构设计文档前进入 Phase 4.1 开发。
