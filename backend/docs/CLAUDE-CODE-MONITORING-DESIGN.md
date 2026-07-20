# Claude Code Monitoring Design

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **状态**: 设计稿  
> **原则**: 只设计，不开发。不改变现有架构。

---

## 1. 问题定义

当前 Claude Code 的运行时状态缺乏主动监控机制。现有信息：

| 信息源 | 内容 | 获取方式 |
|:-------|:-----|:---------|
| Pump Runner state | task_id / status / started_at / retry_count | `.missions/{id}/mission.state` |
| Pump Runner evidence | stdout / stderr / exit_code | `.missions/{id}/evidence/` |
| Claude Code CLI | 进程是否存在 | `tasklist /FI "IMAGENAME eq claude.exe"` |

**缺失的**: CC 长时间无响应时的主动告警、CC 进程异常退出时的检测、任务心跳超时的判定。

---

## 2. 监控指标

### 2.1 直接指标

| 指标 | 数据源 | 判定标准 |
|:-----|:-------|:---------|
| mission.state.updated_at | `.missions/{id}/mission.state` | 超过 30 分钟无更新 → STALE |
| exit_code | `.missions/{id}/evidence/exit_code` | exit_code ≠ 0 → FAILED |
| stdout 最后一行 | `.missions/{id}/evidence/stdout.log` | 是否包含错误模式 |
| claude.exe 进程 | `tasklist` | 进程不存在 → CRASHED |

### 2.2 派生指标

| 指标 | 计算方式 | 用途 |
|:-----|:---------|:-----|
| 执行时长 | `now - mission.state.started_at` | 判断是否超时 |
| 连续失败次数 | Pump Runner retry_count | 判断是否应 PAUSED |
| 任务心跳间隔 | 相邻 stdout 写入时间差 | 判断 CC 是否在正常执行 |

---

## 3. 监控架构

```
Pump Runner
    │
    ├── mission.state (任务状态)
    ├── evidence/ (执行证据)
    └── task heartbeat (stdout 时间戳)
         │
         ▼
Heartbeat (Lobster)
    │
    ├── 扫描 .missions/*/mission.state ← 每 30 分钟
    ├── 检查 updated_at 是否超时
    ├── 检查 exit_code 是否存在
    └── 检查 claude.exe 进程
         │
         ▼
异常判定逻辑
    │
    ├── RUNNING + updated_at > 30min → STALE
    ├── FAILED + no evidence → MYSTERY FAILURE
    ├── PAUSED + consecutive_failures ≥ 2 → STOPPED
    └── 进程不存在 + state=RUNNING → CRASHED
         │
         ▼
feishu-notify.py → EOS AI Team 群
```

---

## 4. 通知规则

| 条件 | Severity | 消息模板 |
|:-----|:---------|:---------|
| RUNNING 超时超过 30 分钟 | WARNING | `⚠️ Claude Code STALE: M-xxx 已运行 X 分钟无响应` |
| 连续失败达到暂停阈值 | WARNING | `⚠️ Pump Runner PAUSED: M-xxx 连续失败 X 次` |
| CC 进程异常退出 | ERROR | `🚨 Claude Code CRASHED: 进程意外退出，M-xxx 执行中断` |
| 任务正常完成 | INFO | `ℹ️ Mission Complete: M-xxx 执行成功` |
| 4 小时无任何活动 | INFO | `ℹ️ 系统空闲: 超过 4 小时无新任务` |

---

## 5. 数据来源确认

| 数据 | 权威来源 | 备份来源 |
|:-----|:---------|:---------|
| 任务状态 | `.missions/{id}/mission.state` | Feishu Mission Board（回写） |
| 执行证据 | `.missions/{id}/evidence/` | 无备份 |
| CC 进程状态 | `tasklist` / `Get-Process` | 无 |
| 时间戳 | mission.state.updated_at | Feishu Board 回写时间 |

**原则**: `.missions/` 为 Runtime Source of Truth，Feishu 为 Control Plane Dashboard。

---

## 6. 实施约束

| 操作 | 允许/禁止 | 原因 |
|:-----|:---------|:------|
| 读取 mission.state | ✅ 允许 | 只读检测 |
| 发送通知 | ✅ 允许 | feishu-notify.py 已部署 |
| 读取 evidence | ✅ 允许 | 检测执行状态 |
| 检查进程 | ✅ 允许 | tasklist 不修改系统 |
| 修改 mission.state | ❌ 禁止 | Runtime SOT, Pump Runner 唯一写入 |
| 启动/停止 CC | ❌ 禁止 | 越权 |
| 修改 Pump Runner 状态 | ❌ 禁止 | 越权 |

---

## 7. 设计决策记录

| 决策 | 选择 | 理由 |
|:-----|:-----|:------|
| 监控主体 | Lobster Heartbeat | 现有 Heartbeat 机制已部署，无需新增组件 |
| 检测周期 | 30 分钟 | 与 Heartbeat 现有频率一致 |
| 告警通道 | Webhook 群通知 | 已部署，零额外成本 |
| 进程检测方式 | tasklist | 兼容 Windows，标准库可用 |
| 超时阈值 | 30 分钟 | 与现有 STALE 判定一致 |
