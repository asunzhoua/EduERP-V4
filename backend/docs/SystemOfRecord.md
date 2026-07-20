# System of Record

Version: 1.0
Date: 2026-07-18
Status: Active

定义 EOS AI 系统中各类型数据的真实来源，解决多系统间的状态冲突。

## Runtime State

Source: .missions/{mission-id}/mission.state
Owner: Pump Runner
Description: Mission 的运行时状态（CREATED/RUNNING/PAUSED/FAILED/COMPLETED）。
飞书 Mission Board 的状态仅为该状态的展示副本。
冲突时以 .missions/ 为准。

## Mission Definition

Source: .missions/{mission-id}/mission.data.json
Owner: Orchestrator (Lobster)
Description: Mission 的定义、任务列表、配置参数。
飞书不创建 Mission，只管理 Mission Board 展示。

## Execution Evidence

Source: .missions/{mission-id}/evidence/{task-id}/
Owner: Pump Runner
Description: 每次 Claude Code CLI 调用的 stdout/stderr/meta。
飞书 Evidence/ 只保存汇总报告和审计结论。
原始证据不删除，飞书报告 90 天滚动清理。

## Human Documentation

Source: Feishu Workspace
Owner: Orchestrator (Lobster)
Description: 审计报告、架构文档、运营记录、知识沉淀。
这些文档的权威版本在飞书，本地备份作为参考。

## Governance Rules

Source: qwenpaw-eos-governance repo (GitHub)
Owner: Orchestrator (Lobster)
Description: P0-P2 治理规则、执行协议、系统事实。
GitHub 仓库是唯一权威来源，飞书 Governance/ 为展示副本。

## Conflict Resolution

当多个来源状态不一致时：
1. .missions/ 目录 > 飞书 Mission Board
2. GitHub 仓库 > 飞书 Governance/
3. 原始日志 > 汇总报告
4. Orchestrator 审计结论 > 自动报告

验证：不影响 pump runner 状态即可。
cd /d "C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4" && python pump-runner.py status PUMP-STABILITY-8H
