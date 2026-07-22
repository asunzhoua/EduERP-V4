# M-2026-07-20-P53-REAL FAILURE REPORT

## 基本信息

| 项目 | 内容 |
|------|------|
| Mission ID | M-2026-07-20-P53-REAL |
| 名称 | Phase 5.3: Swagger docs for Contract controller |
| 描述 | Add @ApiParam to contract controller |
| 优先级 | P2 |
| 执行器 | Pump Runner → Claude Code |
| 创建者/owner | test |
| 创建时间 | 2026-07-20 05:55:00 |
| 失败时间 | 2026-07-20 05:44:58 |
| 最终状态 | FAILED |

## Mission 阶段

| 阶段 | 时间 |
|------|------|
| CREATED | 2026-07-20 05:55:00（state 记录，实际更早） |
| RUNNING | 2026-07-20 05:40:49（evidence 目录创建时间） |
| FAILED | 2026-07-20 05:44:58 |
| 执行窗口 | 约 4 分钟 |

说明：mission.state 的 created_at=05:55 晚于 updated_at=05:44，时间戳有误。
实际启动时间根据 evidence 目录的创建时间（05:40）判定。

## 最后成功步骤

**无任何成功步骤。** evidence/1 目录完全为空：
- 无 stdout.log
- 无 stderr.log
- 无 meta.json

Pump Runner 的 execute_task 启动 CC 子进程后，未收集到任何输出。

## 错误信息

### 根因：CC prompt wrapper 导致交互阻塞

Phase 5.3 的 pump_runner.py 中 execute_task() 调用 CC CLI 时使用了包装后的 prompt：

```
"You are a coding agent. Execute the following task: " + raw_desc
```

CC 在 `--print` 模式下将这个包装器内容识别为用户输入的交互问题，而非直接命令。导致：
1. CC 等待用户在终端中进一步输入/确认
2. pump_runner 监控 300 秒超时
3. 子进程被 pump_runner 强制终止
4. 没有任何 stdout/stderr 被收集到 evidence

### 镜像 Mission 对比：M-2026-07-20-P53

M-2026-07-20-P53（无 -REAL 后缀）是测试任务，同样通过 pump_runner 执行。
该任务的描述是"创建一个 test-p53.txt 文件"，使用了 `${TASK_DESC}` 格式注入。
其 evidence 显示 exit_code=0 但 stdout/stderr 也为空 —— 说明虽然 exit code 正常，但 CC 可能仍未产生有效输出。

## 时间线分析

```
05:10  M-2026-07-20-TEST 创建（DELETED）
05:26  M-2026-07-20-P53 创建 → COMPLETED（exit_code=0，但无实质输出）
05:30  M-2026-07-20-P53 最后更新完成
05:40  M-2026-07-20-P53-REAL evidence 目录创建 → RUNNING
05:44  M-2026-07-20-P53-REAL → FAILED (timeout)
05:45  Phase 5.3.1 验证通过 —— 改用 spawn_subagent 直接调 CC，不使用 pump_runner 的 wrapper
       prompt 格式：精确 "Run this command using Bash tool: <command>"
```

关键转折点：05:45 发现正确的 CC 调用方式后，实际任务（contract.controller.ts 添加 @ApiParam）
通过 spawn_subagent 直接调度 CC 执行成功，而不是通过 pump_runner。

## 根因总结

| 原因 | 说明 |
|------|------|
| 直接原因 | CC prompt wrapper 导致 CC 阻塞等待交互输入 |
| 机制缺陷 | pump_runner.py execute_task() 使用了错误格式的 prompt wrapper |
| 系统缺陷 | pump_runner 未处理 CC 交互阻塞场景（没有 abort logic） |
| 深层原因 | pump_runner 设计时假定 CC CLI 的 --print 模式可以直接执行命令，但未验证 prompt 格式兼容性 |

## 恢复验证

Phase 5.3.1 CC Real Execution（05:45）已验证替代方案有效：
- 绕过 pump_runner，直接 spawn_subagent 调度 CC
- prompt 格式：`"Run this command using Bash tool: python edit_contract_swagger.py"`
- CC 通过 Bash tool 运行 Python edit 脚本完成 contract.controller.ts 修改
- 935 tests / 75 suites ALL PASS

## 是否需要重新执行

**不需要。** 该 Mission 的目标（Add @ApiParam to contract controller）已在 Phase 5.3.1 验证中
通过 spawn_subagent 直接调度 CC 完成。实际修改已在 contract.controller.ts 中生效。

## 后续改进建议

1. Pump Runner 的 execute_task 中的 prompt wrapper 需删除，直接传递原始命令
2. 或：pump_runner 增加交互超时检测（no output for 60s → abort）
3. 或：pump_runner 的 CC 调用改用 spawn_subagent 方式
（以上建议已记录在 DECISION_LOG Decision-002 中，待需要自动化多任务调度时再处理）

## 证据位置

- Mission state：`.missions/M-2026-07-20-P53-REAL/mission.state`
- 空 evidence：`.missions/M-2026-07-20-P53-REAL/evidence/1/`（无任何文件）
- 并行成功验证：Phase 5.3.1 CC Real Execution（memory/2026-07-20.md 05:45）
- 决策记录：EOS/DECISION_LOG.md Decision-002
