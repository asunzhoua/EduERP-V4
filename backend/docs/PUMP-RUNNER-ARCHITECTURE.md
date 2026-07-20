# Pump Runner Architecture

> **Version**: 1.0  
> **Date**: 2026-07-18  
> **Status**: Draft  

## 1. Overview

Pump Runner 是一个**非 AI 的轻量调度脚本**，用于长期、连续地调度 Claude Code CLI。它是三层架构中的 Layer 2，承上（Orchestrator）启下（Claude Code CLI），核心职责是：

- 维护任务队列并逐一分发给 Claude Code CLI
- 跟踪执行状态，支持中断恢复
- 收集每次 CLI 调用的 Evidence（日志、exit code、输出）
- 在失败时执行重试，超过阈值后暂停等待人工介入

```
┌─────────────────────────────────────────────┐
│  Layer 1: Orchestrator（龙虾）               │
│  Mission Planning / Task Dispatch / Review  │
└──────────────────┬──────────────────────────┘
                   │ mission.json + tasks/*.json
┌──────────────────▼──────────────────────────┐
│  Layer 2: Pump Runner（非 AI 脚本）          │
│  Task Queue / CLI Invocation / Retry /      │
│  State Persistence / Evidence Collection    │
└──────────────────┬──────────────────────────┘
                   │ claude --print
┌──────────────────▼──────────────────────────┐
│  Layer 3: Claude Code CLI（执行器）           │
│  Coding / Testing / Refactoring / Docs      │
└─────────────────────────────────────────────┘
```

---

## 2. State Machine

Pump Runner 维护一个 Mission 级别的状态机和一个 Task 级别的状态机。

### 2.1 Mission State

```
MISSION_CREATED
      │
      ▼
   RUNNING ◄──────────────┐
      │                    │
      │ failure            │ success / retry
      ▼                    │
   RETRYING ───────────────┘
      │
      │ max consecutive failures reached
      ▼
    PAUSED ──(manual resume)──► RUNNING
      │
      │ unrecoverable / manual abort
      ▼
   FAILED  /  COMPLETED
```

### 2.2 Task State

```
PENDING
   │
   ▼
RUNNING
   │
   ├──► COMPLETED
   │
   ├──► FAILED ──► RETRYING ──► RUNNING
   │
   └──► SKIPPED (by dependency or manual)
```

### 2.3 Transition Rules

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `MISSION_CREATED` | `RUNNING` | Pump starts first task | — |
| `RUNNING` | `RETRYING` | Task exits non-zero | `retries < max_retries` |
| `RETRYING` | `RUNNING` | Retry timer expires | — |
| `RUNNING` | `PAUSED` | Consecutive failures ≥ `max_consecutive_failures` | — |
| `RUNNING` | `COMPLETED` | All tasks in terminal state | — |
| `RETRYING` | `PAUSED` | Consecutive failures ≥ `max_consecutive_failures` | — |
| `PAUSED` | `RUNNING` | Manual resume (`--resume`) | — |
| `PAUSED` | `FAILED` | Manual abort (`--abort`) | — |

---

## 3. File Structure

```
.missions/
├── {mission-id}/
│   ├── mission.json              # Mission-level state & config
│   ├── mission.state             # Runtime state (JSON, updated in-place)
│   ├── tasks/
│   │   ├── T001.task.json        # Task definition
│   │   ├── T002.task.json
│   │   └── ...
│   ├── evidence/
│   │   ├── T001/
│   │   │   ├── run-001.stdout.log
│   │   │   ├── run-001.stderr.log
│   │   │   ├── run-001.meta.json  # exit code, duration, tokens
│   │   │   ├── run-002.stdout.log
│   │   │   ├── run-002.stderr.log
│   │   │   └── run-002.meta.json
│   │   └── T002/
│   │       └── ...
│   └── pump.log                  # Pump Runner's own execution log
```

---

## 4. Schema Definitions

### 4.1 mission.json — Mission Definition

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "name", "tasks", "config"],
  "properties": {
    "id": { "type": "string", "description": "Unique mission ID, e.g. M-2026-07-18-001" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "config": {
      "type": "object",
      "properties": {
        "maxRetries": { "type": "integer", "default": 2 },
        "maxConsecutiveFailures": { "type": "integer", "default": 2 },
        "retryDelaySeconds": { "type": "integer", "default": 30 },
        "cliTimeoutSeconds": { "type": "integer", "default": 600 },
        "claudePrintFlags": { "type": "array", "items": { "type": "string" }, "default": ["--print"] }
      }
    },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "prompt"],
        "properties": {
          "id": { "type": "string", "pattern": "^T\\d{3}$" },
          "name": { "type": "string" },
          "prompt": { "type": "string", "description": "Prompt text or @path/to/prompt.md" },
          "dependsOn": { "type": "array", "items": { "type": "string" }, "default": [] },
          "priority": { "type": "integer", "default": 0 }
        }
      }
    }
  }
}
```

### 4.2 mission.state — Runtime State

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["missionId", "status", "currentTaskIndex", "tasks", "stats"],
  "properties": {
    "missionId": { "type": "string" },
    "status": {
      "type": "string",
      "enum": ["MISSION_CREATED", "RUNNING", "RETRYING", "PAUSED", "COMPLETED", "FAILED"]
    },
    "currentTaskIndex": { "type": "integer" },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "status"],
        "properties": {
          "id": { "type": "string" },
          "status": {
            "type": "string",
            "enum": ["PENDING", "RUNNING", "COMPLETED", "FAILED", "RETRYING", "SKIPPED"]
          },
          "retries": { "type": "integer", "default": 0 },
          "consecutiveFailures": { "type": "integer", "default": 0 },
          "lastRun": {
            "type": "object",
            "properties": {
              "exitCode": { "type": "integer" },
              "startedAt": { "type": "string", "format": "date-time" },
              "finishedAt": { "type": "string", "format": "date-time" },
              "durationMs": { "type": "integer" }
            }
          }
        }
      }
    },
    "stats": {
      "type": "object",
      "properties": {
        "totalRuns": { "type": "integer", "default": 0 },
        "totalFailures": { "type": "integer", "default": 0 },
        "startedAt": { "type": ["string", "null"], "format": "date-time" },
        "finishedAt": { "type": ["string", "null"], "format": "date-time" }
      }
    }
  }
}
```

### 4.3 Task Evidence — run-{NNN}.meta.json

```json
{
  "taskId": "T001",
  "runNumber": 1,
  "exitCode": 0,
  "startedAt": "2026-07-18T10:00:00Z",
  "finishedAt": "2026-07-18T10:02:34Z",
  "durationMs": 154000,
  "stdoutSize": 4096,
  "stderrSize": 0,
  "promptHash": "sha256:abc123..."
}
```

---

## 5. Core Algorithm

```
function runMission(missionId):
    state = loadOrCreate(missionId)

    for each task in state.tasks:
        if task.status == COMPLETED or task.status == SKIPPED:
            continue

        // Check dependencies
        if any dependency not COMPLETED:
            task.status = SKIPPED
            continue

        state.status = RUNNING
        persist(state)

        // Execute loop (with retries)
        while task.retries <= config.maxRetries:
            task.status = RUNNING
            persist(state)

            result = executeClaude(task, task.retries + 1)
            collectEvidence(task, result)

            if result.exitCode == 0:
                task.status = COMPLETED
                task.consecutiveFailures = 0
                persist(state)
                break

            // Failure path
            task.retries += 1
            task.consecutiveFailures += 1
            state.stats.totalFailures += 1

            if task.consecutiveFailures >= config.maxConsecutiveFailures:
                state.status = PAUSED
                persist(state)
                alert("Mission paused — too many consecutive failures")
                return  // wait for manual intervention

            task.status = RETRYING
            persist(state)
            sleep(config.retryDelaySeconds)

        if task.status != COMPLETED:
            task.status = FAILED
            state.status = FAILED
            persist(state)
            return

    state.status = COMPLETED
    state.stats.finishedAt = now()
    persist(state)

function executeClaude(task, runNumber):
    evidenceDir = makeEvidenceDir(task.id)
    prompt = resolvePrompt(task.prompt)  // inline text or read from file

    args = config.claudePrintFlags + ["--output-format", "json"]
    proc = subprocess.run(
        ["claude"] + args,
        input=prompt,
        capture_output=True,
        timeout=config.cliTimeoutSeconds
    )

    // Persist evidence immediately
    write(evidenceDir + "/run-{runNumber:03d}.stdout.log", proc.stdout)
    write(evidenceDir + "/run-{runNumber:03d}.stderr.log", proc.stderr)
    write(evidenceDir + "/run-{runNumber:03d}.meta.json", {
        exitCode: proc.returncode,
        startedAt: proc.startTime,
        finishedAt: proc.endTime,
        durationMs: proc.durationMs,
        stdoutSize: len(proc.stdout),
        stderrSize: len(proc.stderr),
        promptHash: sha256(prompt)
    })

    return proc
```

---

## 6. Resume Logic

Pump Runner 支持从任意断点恢复：

1. **启动时**读取 `mission.state`（原子读取，若损坏则回退到 `.bak`）
2. 找到第一个非 `COMPLETED` / 非 `SKIPPED` 的 task
3. 若该 task 为 `RUNNING`，视为上一次未完成，将其重置为 `PENDING` 并从头执行
4. 继续正常流程

```python
def resume(missionId):
    state = load(missionId + "/mission.state")
    if state is None:
        raise MissionNotFound(missionId)

    # Find next actionable task
    for task in state.tasks:
        if task.status in ("RUNNING", "RETRYING"):
            # Last run was interrupted — reset to PENDING
            task.status = "PENDING"
            task.retries = 0
            break
        if task.status == "PENDING":
            break

    runMission(state)
```

### 原子写入

`mission.state` 使用 **write-to-temp-then-rename** 策略：

```python
def persist(state):
    tmp = statePath + ".tmp"
    backup = statePath + ".bak"
    write(tmp, serialize(state))
    if exists(statePath):
        copy(statePath, backup)   # .bak = last known good
    rename(tmp, statePath)         # atomic on same filesystem
```

---

## 7. Retry Strategy

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxRetries` | 2 | Maximum retries **per task** (3 total attempts) |
| `maxConsecutiveFailures` | 2 | Across **any** tasks — pauses the entire mission |
| `retryDelaySeconds` | 30 | Fixed delay before retry (no exponential backoff v1) |

**Retry scope**: Per-task only. A failed task's retry count is independent of other tasks.

**Consecutive failure tracking**: `consecutiveFailures` increments on each failure and resets to 0 on success. When a single task fails its maxRetries, the next task starts fresh. If two *different* tasks fail back-to-back, the mission pauses.

---

## 8. Logging Format

### 8.1 pump.log — Pump Runner's Own Log

```json
{"ts":"2026-07-18T10:00:00Z","level":"INFO","msg":"mission started","missionId":"M-2026-07-18-001"}
{"ts":"2026-07-18T10:00:01Z","level":"INFO","msg":"task T001 dispatch","run":1}
{"ts":"2026-07-18T10:02:35Z","level":"INFO","msg":"task T001 completed","exitCode":0,"durationMs":154000}
{"ts":"2026-07-18T10:02:36Z","level":"INFO","msg":"task T002 dispatch","run":1}
{"ts":"2026-07-18T10:03:00Z","level":"ERROR","msg":"task T002 failed","exitCode":1,"run":1,"retriesLeft":2}
{"ts":"2026-07-18T10:03:30Z","level":"INFO","msg":"task T002 retry","run":2}
```

### 8.2 Log Levels

| Level | Usage |
|-------|-------|
| `DEBUG` | Verbose output, state file writes |
| `INFO` | Lifecycle events: start, dispatch, complete |
| `WARN` | Retries, degraded state |
| `ERROR` | Failures, paused missions |
| `FATAL` | Unrecoverable pump errors (corrupted state, missing mission) |

---

## 9. Evidence Collection Strategy

**每次 Claude Code CLI 调用**都收集：

| Artifact | Path | Content |
|----------|------|---------|
| stdout | `evidence/{task}/run-{NNN}.stdout.log` | CLI 的完整标准输出 |
| stderr | `evidence/{task}/run-{NNN}.stderr.log` | CLI 的完整错误输出 |
| meta | `evidence/{task}/run-{NNN}.meta.json` | exit code, timing, sizes, prompt hash |

**Pump-level Evidence**:

| Artifact | Path | Content |
|----------|------|---------|
| pump log | `pump.log` | Pump Runner 的结构化日志 |
| final state | `mission.state` | 终态快照 |

### Evidence Integrity

- Evidence 文件**只追加，不覆盖**。每个 run 的文件名包含 run number，不会冲突。
- `mission.state` 使用 atomic write（见 §6）。
- `mission.state.bak` 保留最后一个已知的好状态。

---

## 10. CLI Interface

```bash
# Start a new mission
python pump_runner.py start .missions/M-2026-07-18-001/mission.json

# Resume a paused/interrupted mission
python pump_runner.py resume .missions/M-2026-07-18-001/mission.state

# Check mission status (read-only)
python pump_runner.py status .missions/M-2026-07-18-001/mission.state

# Abort a paused mission
python pump_runner.py abort .missions/M-2026-07-18-001/mission.state
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Mission completed successfully |
| `1` | Mission failed (task exceeded max retries) |
| `2` | Mission paused (consecutive failures threshold) |
| `3` | Invalid arguments or missing files |
| `4` | Pump internal error (state corruption, etc.) |

---

## 11. Implementation Notes

### Technology Choice

- **Python 3.10+** — 跨平台, subprocess management 友好, json 模块内置
- 单文件实现 (`pump_runner.py`), 无外部依赖
- PowerShell 作为备选 (Windows 环境下若 Python 不可用)

### Concurrency

- **单任务串行** — Pump Runner 一次只执行一个 task
- 不并行调度 Claude Code CLI (避免资源竞争)
- 未来可扩展为多 runner 并行 (每个 runner 锁定任务)

### Graceful Shutdown

- 捕获 `SIGINT` / `SIGTERM`
- 等待当前 task 完成（或超时）
- 将当前 task 重置为 `PENDING`
- 持久化状态后退出

---

## 12. Future Extensions

- **Web Dashboard** — 实时查看 mission 进度
- **Notification** — Task 完成/失败时推送通知
- **Prompt Template Engine** — 支持变量替换、模板文件
- **Cost Tracking** — 从 CLI 输出中提取 token 用量
- **Multi-runner** — 分布式任务调度
