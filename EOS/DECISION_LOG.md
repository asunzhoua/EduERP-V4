# DECISION_LOG — EOS 关键决策记录

## Decision-001: Prompt Wrapper 模式
Problem: CC --print 模式下无法使用 Edit tool 修改文件
Evidence: Pump Runner 的 execute_task 使用 --print 模式，CC 无法交互式确认
Decision: 通过 spawn_subagent 直接调度 CC，使用 --dangerously-skip-permissions + 命令式提示词
Result: 验证可行，CC 成功完成 .env JWT 密钥替换
Date: 2026-07-19

## Decision-002: Pump Runner execute_task 暂不修复
Problem: Pump Runner 的 execute_task 仍使用 --print 模式
Evidence: 直接 spawn_subagent 调度 CC 已验证可行
Decision: 推迟修复，优先推进业务功能开发。待需要自动化多任务调度时再做
Date: 2026-07-20

## Decision-003: 数据库无 Migration 策略
Problem: 项目使用 synchronize: false，无 migration 目录
Evidence: Student.userId 列通过 ALTER TABLE 手动添加
Decision: 当前阶段接受手动 SQL 变更，在 MVP 证据文档中标注为已知问题
Date: 2026-07-20

## Decision-004: 响应格式修复范围
Problem: 小程序 request.js 用 res.data.success 判断成功，后端返回 code: 0
Evidence: 后端 ApiResponse 格式 {code:0, message:"success", data:{...}}
Decision: 修改小程序 request.js + app.js 的判断逻辑，不改后端
Result: CC 修改完成，两个文件通过语法检查
Date: 2026-07-20
