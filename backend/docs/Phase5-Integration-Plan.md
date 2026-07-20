# Phase 5 业务能力审计与接入方案

审计时间：2026-07-19 21:30
审计方式：只读分析，未改代码，未重启服务，未修改飞书配置

---

## 1. 现有 Bot 能力审计

### 1.1 status / 状态

位置：feishu-bot-server.py 第 398 行 `def get_system_status()`

返回格式：多行纯文本字符串，每段带 emoji 标题

输出内容：

```
📊 EOS AI 状态

系统:
  状态: ONLINE

Pump Runner:
  状态: IDLE

Claude Code:
  进程: RUNNING

当前 Mission:
  M-2026-07-18-002 (RUNNING)

Heartbeat:
  最近检测: 2026-07-19 18:47:32
  状态: ⚠️ ISSUES (OK=3, WARNING=1)

最新 Evidence:
  M-2026-07-18-002: query-performance-optimization-report.md
```

实现方式：
- 硬编码 `系统: ONLINE`
- Pump Runner 状态通过 `tasklist` 搜索 "heartbeat_check" 或 "pump" 进程名判断
- Claude Code 状态通过 `_check_process("claude.exe")` 判断
- 当前 Mission 通过 `_get_mission_status_counts()` 从 `.missions/` 目录读取最新 mission.state
- Heartbeat 通过 `_read_heartbeat_summary()` 从 heartbeat 日志读取
- 最新 Evidence 扫描 `.missions/*/evidence/` 目录

局限性：
- Pump Runner 状态判断依赖进程名，不准确（python.exe 太多了）
- Heartbeat 摘要依赖外部日志文件
- 不包含 EduERP 业务数据（数据库连接数、测试状态等）

### 1.2 missions / 任务列表 / list

位置：feishu-bot-server.py 第 496 行 `def get_missions_list()`

返回格式：多行字符串

输出内容：

```
📋 Missions 列表

最近 5 条:

M-2026-07-19-004: LessonChangeRequest 模块实现
  状态: ✅ COMPLETED
  执行: Claude Code
  创建: 2026-07-19T15:52:20
  结果: ✅ SUCCESS

...（最多5条）...

---
总计: 10 | CREATED: 0 | RUNNING: 0 | COMPLETED: 8 | FAILED: 2 | PAUSED: 0
```

实现方式：
- 使用 `glob.glob(os.path.join(MISSIONS_DIR, "*", "mission.state"))` 扫描所有 mission.state
- 解析 JSON 提取字段
- 按 updated_at 降序排序
- 返回 top 5 + 状态统计摘要
- 有 emoji 映射：CREATED=🆕, RUNNING=🔄, COMPLETED=✅, FAILED=❌, PAUSED=⏸️

局限性：
- 固定返回 5 条，无法按状态筛选
- 无法查看单个 Mission 详情
- 扫描目录可能较慢（未来 mission 增多时）

### 1.3 create mission

位置：feishu-bot-server.py 第 605 行 `def create_mission(text, creator_id)`

参数解析方式：
- 正则匹配 `create mission\s*:\s*(.*)` 
- 从剩余文本中提取 `priority:\s*(P[0-2])`（可选）
- 移除 priority 部分，剩余作为 description
- description 超过 80 字符截断为 name

Mission 文件创建格式：

```json
{
  "mission_id": "M-2026-07-19-xxx",
  "name": "前80字符描述",
  "description": "完整描述",
  "status": "CREATED",
  "priority": "P1",
  "owner": "用户飞书ID",
  "executor": "Claude Code",
  "created_at": "2026-07-19T21:00:00",
  "updated_at": "2026-07-19T21:00:00",
  "tasks": [
    {
      "id": 1,
      "description": "完整描述",
      "status": "CREATED"
    }
  ]
}
```

验证：写入后立即读回校验 mission_id 是否一致。

返回值：(True/False, 结果消息)

局限性：
- 只负责写入文件，不自动启动调度
- 没有回复到群的确认通知（当前由 send_message 回复，但不会主动推送到各种渠道）

---

## 2. 项目现状调研

### 2.1 .missions/ 目录结构

路径：`C:\Users\sunz\.qwenpaw\workspaces\default\.missions\`

现有 Mission：
- M-2026-07-18-001 — 已完成的 mission（登录 Bug 修复）
- M-2026-07-18-002 — RUNNING 状态（优化查询性能，最终阶段）

mission.state 格式：JSON，包含 mission_id, name, description, status, priority, owner, executor, created_at, updated_at, tasks[]

evidence 目录：`.missions/{mission_id}/evidence/`，存放验证文件（Markdown/JSON/日志截图）

### 2.2 Pump Runner

文件系统中未找到 PumpRunner/ 目录。

MEMORY.md 记录：Pump Runner 是一个 CLI 调度器，支持 28/28 任务验证，功能包含 resume/retry/abort/skip。作为调度层位于龙虾和 CC 之间。

当前无法通过文件系统直接调用 Pump Runner。需要通过龙虾的调度指令来启动。

### 2.3 项目状态摘要

来源：MEMORY.md Session Tracking 区块

- 项目：EduERP-V4（NestJS + TypeScript + MySQL）
- 测试：935 tests / 75 suites ALL PASS
- 构建：FAIL（13 TS 错误，ISS-004 PENDING，不阻塞）
- P1 模块：27/27 COMPLETED
- 最后完成：M-2026-07-19-004（LessonChangeRequest 模块实现）
- 当前 Active Mission：无
- 待处理：REC-001/REC-002（Phase 2 中）
- 下一步：Phase 2 完成待验收

### 2.4 飞书通知脚本

位置：`backend/tools/mission-notify.py`

能力：
- 通过龙虾 App（cli_aad18ea46438dccd）飞书 API 发送消息
- 消息发送到 EOS AI Team 群（oc_6e919481fd56e839c5c8e9d1ba71b25b）
- 支持状态标签：📋 CREATED / 🔄 RUNNING / 🔍 REVIEWING / ✅ COMPLETED / ❌ FAILED
- CLI 用法：`python mission-notify.py <状态> <Mission ID> [消息内容]`
- 独立脚本，不与 Bot Server 集成

---

## 3. 候选方案分析

### 候选 A：增强 Mission 管理

价值：高
风险：低
复杂度：低

Bot 当前只能列出 5 条 Mission、查看摘要状态。增强后可以：

具体实现步骤：
1. 新增 `mission <id>` 命令，查看单个 Mission 的完整详情（状态、任务、evidence 列表）
2. 增强 `missions` 命令支持按状态筛选（`missions running` / `missions completed`）
3. 新增 `missions all` 返回全部 Mission 摘要（不再限制 5 条）
4. 修改文件：仅 feishu-bot-server.py，新增 2-3 个函数

涉及代码位置：
- feishu-bot-server.py 第 496 行 `get_missions_list()` — 修改筛选逻辑
- feishu-bot-server.py 第 800 行 command router — 新增命令路由
- 新增 `get_mission_detail(mission_id)` 函数

### 候选 B：与 Pump Runner 集成

价值：极高（飞书成为 EOS 控制面）
风险：中
复杂度：中

飞书群可以直接调度 Mission 执行，不需要回到 QwenPaw 会话。这是整个 EOS 体系的关键目标。

具体实现步骤：
1. Bot Server 新增 `run <id>` 命令，接收 Mission ID 参数
2. 新增 `trigger_mission(mission_id)` 函数，调用 Pump Runner CLI
3. Bot Server 解析 Pump Runner 输出并回复到群
4. 支持 `abort <id>` 中止运行中的 Mission

技术难点：
- subprocess 调用 Pump Runner（Pump Runner 位置不确定，路径需解析）
- CLI 输出捕获和超时处理
- 错误状态反馈到群

涉及代码位置：
- feishu-bot-server.py command router — 新增 run/abort 命令
- 新增 `_call_pump_runner(action, mission_id)` 函数

### 候选 C：EduERP 数据库查询

价值：中
风险：中高
复杂度：中高

Bot 可以直接查询数据库返回业务数据（课时记录、报名信息等）。

评估：
- 需要数据库连接管理（连接池、关闭、超时）
- 密码管理（当前 `.env` 中硬编码 root 密码，不可直接用于 Bot Server）
- SQL 注入风险（用户输入拼接到查询中）
- 数据库凭证不应该从飞书消息中传递
- 不推荐在 Phase 5 实施，建议推迟到专门的 Data API 层建设

### 候选 D：增强 create mission

价值：低
风险：极低
复杂度：极低

当前 create mission 功能已可用。增强点有限：
- 支持更丰富的参数（deadline、tags）
- 支持创建后自动通知群
- 但风险极低，价值也低，优先级不高

---

## 4. 推荐方案及理由

### 推荐方案：候选 A + 候选 B 分两阶段实施

第一阶段（Phase 5.1）：候选 A — 增强 Mission 管理

理由：
- 价值高 — 用户可以直接在群里查看 Mission 详情，不需要回到 QwenPaw
- 风险低 — 纯文件读取操作，不涉及进程管理、数据库、外部通信
- 复杂度低 — 可以在现有代码结构内完成，不需要新依赖
- 为候选 B 打基础 — 先验证 Mission ID 路径和 detail 函数，候选 B 复用相同逻辑

第二阶段（Phase 5.2）：候选 B — 与 Pump Runner 集成

理由：
- 价值极高 — 这是 EOS 控制面的核心能力，飞书群可以直接调度任务
- 风险中 — 需要解决 Pump Runner 定位和 subprocess 管理问题
- 依赖第一阶段完成

### 不推荐方案

候选 C（EduERP 数据库查询）— 不推荐在当前阶段实施。数据库密码管理、连接池、SQL 注入防护都需要额外基础设施。建议等待专门的 Data API 层。

候选 D（增强 create mission）— 不推荐优先实施。已有基础可用，增强价值有限。

---

## 5. 实施方案的详细步骤

### 第一阶段（Phase 5.1）：增强 Mission 管理

Step 1：新增 get_mission_detail(mission_id) 函数
- 从 MISSIONS_DIR/{mission_id}/mission.state 读取 JSON
- 从 {mission_id}/evidence/ 目录列出 evidence 文件
- 返回格式化字符串包含：名称、描述、状态、优先级、执行者、创建时间、更新时间、任务列表、evidence 列表

Step 2：增强 get_missions_list() 支持筛选
- 参数：status_filter (可选) — "running", "completed", "failed", "created", "paused"
- 筛选后按 updated_at 排序
- 修复返回条数限制（不再硬编码 5 条）

Step 3：command router 新增命令
- `mission <id>` → 调用 get_mission_detail(id)
- `missions running/completed/failed` → 调用 get_missions_list(status_filter)
- `missions all` → 调用 get_missions_list() 无限制

Step 4：验证
- 群聊发 `mission M-2026-07-18-002` → 返回完整详情
- 群聊发 `missions completed` → 返回已完成列表
- 私聊发 `mission xxx` → 同样能查

涉及文件：
- feishu-bot-server.py：新增函数 + 修改 command router
- 新增 Phase5.1 验证报告

### 第二阶段（Phase 5.2）：与 Pump Runner 集成

Step 1：定位 Pump Runner 入口
- 查找 Pump Runner 实际路径（可能在工作区或项目目录的其他位置）
- 确认 CLI 调用方式

Step 2：新增 trigger_mission(mission_id) 函数
- subprocess 调用 Pump Runner
- 捕获 stdout/stderr
- 设置超时（建议 60 秒）
- 返回执行结果

Step 3：command router 新增 run/abort 命令
- `run <id>` → 调用 trigger_mission(id)
- `abort <id>` → 发送中止信号

Step 4：通知集成
- 任务运行中 → 发送 RUNNING 通知到群
- 任务完成 → 发送 COMPLETED 通知（调用 mission-notify.py 或直接 API）

Step 5：验证
- 群聊发 `run M-2026-07-18-002` → 启动调度
- 群聊收到 RUNNING 通知
- 收到 COMPLETED/FAILED 通知

---

## 6. 预计风险和安全边界

### 风险清单

风险 1：Mission ID 不存在时的错误处理
防护：get_mission_detail 检查路径是否存在，不存在返回 "未找到 Mission {id}"
不影响其他命令

风险 2：目录遍历攻击
防护：使用 os.path.basename() 限制 Mission ID 为目录名，禁止 `../` 路径穿越

风险 3：subprocess 阻塞事件循环（Phase 5.2）
防护：设置 subprocess timeout，长时间未完成时返回 "执行超时，请在 QwenPaw 中查看结果"

风险 4：Pump Runner 路径变化（Phase 5.2）
防护：首次调用时自动检测路径，找不到路径时返回明确错误信息

风险 5：命令冲突
防护：现有命令（status/missions/create mission）保持不变，新增命令使用独立前缀

### 回滚方案

第一阶段（Phase 5.1）回滚：
- 删除 command router 中新增的路由分支
- 保留 get_mission_detail 函数（不会影响现有功能）
- 重启 Bot Server

第二阶段（Phase 5.2）回滚：
- 删除 run/abort 命令路由
- 删除 trigger_mission 函数
- 重启 Bot Server

### 安全边界

- 所有新增命令保持 read-only 直到 Phase 5.2
- Mission ID 参数用 basename 约束，禁止路径穿越
- subprocess 调用设超时，防止 Bot Server 挂起
- 不修改飞书事件订阅、WS 连接、权限配置
- 不引入新依赖（仅使用标准库）
- 所有变更只影响 feishu-bot-server.py 这一个文件

---

生成时间: 2026-07-19 21:35
审计人: 龙虾（Orchestrator）
状态: 只读分析完成，未改代码，未重启服务
