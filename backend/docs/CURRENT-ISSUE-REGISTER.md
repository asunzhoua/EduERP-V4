# CURRENT-ISSUE-REGISTER.md

> **Version**: 1.0
> **Date**: 2026-07-18
> **Status**: REGISTERED ONLY — no fixes applied
> **Note**: 只登记，禁止修复。

---

## 🔴 P0 — Critical

### REC-001: 新会话无状态恢复
| 字段 | 值 |
|:-----|:----|
| **描述** | 每次新会话启动时，龙虾不知道之前干了什么。无 Session Recovery 机制。 |
| **影响** | 每次醒来都是"全新开始"，可能错过之前未完成的任务 |
| **涉及文件** | AGENTS.md |
| **触发条件** | 每次新聊天会话启动 |
| **证据** | AGENTS.md 审计：无任何 Session Hook 规则 |
| **Fix 方向** | AGENTS.md 增加 Session Recovery 规则块 |

### REC-002: 无系统主动健康检查
| 字段 | 值 |
|:-----|:----|
| **描述** | 系统无主动检测 Pump Runner / Feishu / Evidence 状态的机制。只能被动等人问。 |
| **影响** | 卡住的任务无人发现，有问题的状态无人报告 |
| **涉及文件** | AGENTS.md, HEARTBEAT.md |
| **触发条件** | 系统运行中 |
| **证据** | HEARTBEAT.md 审计：无系统健康检测 |
| **Fix 方向** | HEARTBEAT.md 增加系统健康检测块 |

---

## 🟡 P1 — High

### REC-003: 无 Feishu Board 自动扫描
| 字段 | 值 |
|:-----|:----|
| **描述** | Feishu Mission Board 上有 CREATED 任务时，龙虾不会主动发现 |
| **影响** | 主人做了任务但系统不响应 |
| **涉及文件** | HEARTBEAT.md |
| **Fix 方向** | Heartbeat 增加 Feishu Board 扫描 |

### REC-004: 无 Stale Mission 检测
| 字段 | 值 |
|:-----|:----|
| **描述** | 卡在 RUNNING 状态超过 30min 的 Mission 无人发现 |
| **影响** | Pump Runner 可能已死，但状态留在 RUNNING |
| **涉及文件** | HEARTBEAT.md |
| **Fix 方向** | Heartbeat 检查 mission.state.updated_at 与当前时间差 |

### REC-005: 无 Cron 监控
| 字段 | 值 |
|:-----|:----|
| **描述** | 无定时任务，无人值守时段无保底检测 |
| **影响** | 系统完全依赖人工触发 |
| **涉及文件** | —（新配置） |
| **Fix 方向** | 创建 system-health-check cron，15min 间隔 |

---

## 🟢 P2 — Medium

### REC-006: 无 Evidence 新鲜度检查
| 字段 | 值 |
|:-----|:----|
| **描述** | 不知道上次成功执行是什么时候 |
| **影响** | 无法快速判断系统是否健康 |
| **涉及文件** | HEARTBEAT.md |
| **Fix 方向** | Heartbeat 检查最近 mission.state.updated_at |

### REC-007: 无主动通知机制
| 字段 | 值 |
|:-----|:----|
| **描述** | 发现问题时龙虾无法主动通知主人 |
| **影响** | 异常只能等人追问 |
| **涉及文件** | AGENTS.md |
| **Fix 方向** | AGENTS.md 增加"发现问题 → 主动汇报"规则 |

---

## 🟢 已知但 Low Priority

| # | 问题 | 说明 |
|:---|:-----|:------|
| ISS-002 | pump-test-001 遗留 PAUSED | 上次 Pump Runner 测试残留，无影响 |
| — | stability-001 / stability-8h 空目录 | 旧命名遗留，无 mission.state |
| — | EduERP-V4 4 个 P0 安全问题 | 属于项目本身，不由本系统处理 |

---

## 汇总

| Severity | Count | Issues |
|:---------|:------|:-------|
| 🔴 P0 | 2 | REC-001, REC-002 |
| 🟡 P1 | 3 | REC-003, REC-004, REC-005 |
| 🟢 P2 | 2 | REC-006, REC-007 |
| 🟢 Low | 3 | ISS-002, stability-*, 项目安全 |
| **Total** | **10** | — |
