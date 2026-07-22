# Mission: M-2026-07-24-EOS-Agent-Role-Validation
# Mission Title: EOS Agent Role Validation Test
# Status: IN PROGRESS

## Objective
验证经过 AGENTS.md 角色约束后的 EOS-Research-Agent 和 EOS-Review-Agent
是否能够在真实 EOS 环境中完成：调查 → 分析 → 审核 → 汇总 工作闭环。

## Scope
本 Mission 只验证：
1. Agent 角色有效性
2. Evidence First 执行方式
3. Research / Review 协作质量

不包含：Claude Code 接入、代码修改、架构调整、新 Agent 创建

## Execution Flow
用户任务 → 龙虾(QwenPaw) → EOS-Research-Agent → EOS-Review-Agent → 龙虾汇总最终结果
