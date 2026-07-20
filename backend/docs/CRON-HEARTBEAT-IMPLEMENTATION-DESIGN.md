# Cron Heartbeat Implementation Design

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **依据**: CRON-HEARTBEAT-DESIGN.md + HEARTBEAT.md + 环境审计  
> **平台**: Windows 10 (cmd.exe)  
> **周期**: 15 分钟

---

## 1. 架构

```
Windows Task Scheduler
    │  每 15 分钟
    ▼
heartbeat.cmd / heartbeat.ps1
    │
    ├── 1. Feishu Mission Board Check (feishu_bootstrap.py --verify)
    │       ↓
    │       CREATED count > 0 → WARNING
    │
    ├── 2. Pump Runner State Check (.missions/*/mission.state)
    │       ↓
    │       PAUSED/FAILED → WARNING
    │       RUNNING + >30min stale → WARNING
    │
    ├── 3. System Liveness Check
    │       ↓
    │       4h no activity → INFO
    │
    └── 4. Notification (feishu-notify.py)
            ↓
            异常 → WARNING/ERROR 群通知
            正常 → 静默（无通知 = 系统正常）
```

---

## 2. 实现方案选择

| 方案 | 方式 | 复杂度 | 推荐 |
|:-----|:-----|:-------|:-----|
| A. Python 脚本 + schtasks | `python heartbeat_check.py` | 低 | ⭐ 首选 |
| B. PowerShell + schtasks | 纯 PS1 | 中 | 备选 |
| C. QwenPaw cron 集成 | 已有的 cron skill | 低 | 已设计，但依赖会话 |

**推荐**: 方案 A（Python 脚本 + Windows Task Scheduler）

理由:
- ✅ Python 环境已验证可用
- ✅ feishu-notify.py 已有 Python 通知能力
- ✅ feishu_bootstrap.py 已有 Feishu API 调用
- ✅ 不与 QwenPaw 内置 cron 冲突（备份机制）
- ✅ Windows Task Scheduler 不依赖任何会话存活

---

## 3. Heartbeat 脚本设计

### 3.1 脚本定位

创建一个独立的 `backend/tools/heartbeat_check.py`

与 Pump Runner 隔离：
- 不修改任何文件
- 不做 Runtime 决策
- 只读检测 + 通知

### 3.2 检测逻辑

```python
# 伪代码
def heartbeat_check():
    results = []
    
    # 1. Feishu Mission Board
    missions = read_feishu_board()
    created = [m for m in missions if m['status'] == 'CREATED']
    if created:
        notify(WARNING, f"待处理 Mission: {len(created)} 个")
    
    # 2. Runtime State
    for state_file in glob('.missions/*/mission.state'):
        state = json.load(state_file)
        if state['status'] == 'FAILED':
            notify(WARNING, f"Mission {state['id']} FAILED")
        elif state['status'] == 'PAUSED':
            notify(WARNING, f"Mission {state['id']} PAUSED")
        elif state['status'] == 'RUNNING':
            age = now - state['updated_at']
            if age > 30min:
                notify(WARNING, f"Mission {state['id']} STALE ({age}min)")
    
    # 3. Liveness Check
    last_activity = get_last_activity_time()
    if now - last_activity > 4h:
        notify(INFO, "系统空闲 > 4 小时")
    
    # 4. Log
    log_result(results)
```

### 3.3 静默原则

- 无异常 → 不发送通知（无消息 = 系统正常）
- 有异常 → 发送对应级别通知
- 每次运行写入日志文件（供审计）

---

## 4. 日志设计

| 字段 | 示例 |
|:-----|:------|
| timestamp | 2026-07-18 14:30:00 |
| check_id | Feishu Board |
| status | OK / WARNING / ERROR |
| detail | Created missions: 0 |
| notification | not_sent |

日志路径: `backend/logs/heartbeat/YYYY-MM-DD.log`

---

## 5. 调度配置（Windows Task Scheduler）

| 参数 | 值 |
|:-----|:----|
| 触发器 | 每 15 分钟，无限期 |
| 操作 | `python C:\path\to\heartbeat_check.py` |
| 起始位置 | `C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4\` |
| 运行用户 | 当前用户 |
| 最高权限 | 否（普通用户即可） |
| 任务名 | `EOS-Heartbeat-Check` |

### 创建命令
```cmd
schtasks /create /tn "EOS-Heartbeat-Check" /tr "python C:\path\heartbeat_check.py" /sc minute /mo 15 /st 09:00 /du 24:00 /f
```

---

## 6. 边界确认

| 操作 | 允许/禁止 | 原因 |
|:-----|:---------|:------|
| 读取 Feishu Board | ✅ 允许 | 只读 API |
| 读取 .missions/ | ✅ 允许 | 只读文件 |
| 调用 feishu-notify.py | ✅ 允许 | 通知层 |
| 写日志文件 | ✅ 允许 | `backend/logs/heartbeat/` |
| 修改 mission.state | ❌ 禁止 | Runtime SOT |
| 调用 Claude Code | ❌ 禁止 | 越权 |
| 启动 Pump Runner | ❌ 禁止 | 越权 |
| 修改飞书 Board | ❌ 禁止 | 只读 |

---

## 7. 错误处理

| 场景 | 行为 |
|:-----|:------|
| Feishu API 不可用 | 记录 ERROR 日志，不通知（避免风暴） |
| 网络不可用 | 记录 WARNING，跳过网络检测 |
| Python 异常 | 捕获后写入日志，不通知 |
| 连续失败 | 日志记录，不重复通知 |

---

## 8. 回滚方案

```cmd
schtasks /delete /tn "EOS-Heartbeat-Check" /f
```
简单删除任务即可。不影响任何现有系统。
