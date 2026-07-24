# PROJECT_STATE — EduERP-V4 v0.1 MVP + EOS Core v1.0
## 2026-07-21

## Current Phase
微信双端联调准备（Phase 0：环境准备）
外贸站服务器资产登记（EOS 真实运行测试）

## Completed
- GitHub 版本固化（Commit d3c3fdb，分支 master）
- SSH 推送链路配置完成
- 后端 API：Auth / Contract / Lesson / Attendance / Student self-service
- 小程序页面：教师端（班级/学生/课时录入）+ 家长端（首页/合同/课时历史）
- 响应格式修复：request.js + app.js 的 res.data.success → res.data.code === 0
- 测试：75 suites / 935 tests ALL PASS
- 证据文档 docs/MVP-2026-07-20.md
- EOS Core v1.0 文件体系（PROJECT_STATE / MISSION_QUEUE / DECISION_LOG / EVIDENCE_LOG / RULES / TEMPLATES）
- 外贸站服务器 SSH 入口审计完成（SERVER_ACCESS_AUDIT.md）
- EOS 第一条真实运行记录（CC 通过 paramiko SSH 执行服务器探测）

## In Progress
- 微信开发者工具安装完成（v2.01.2510290），已重新启动
- 等待用户确认开发者工具是否显示了登录二维码或项目界面

## Blocked
- 开发者工具登录状态待确认（上轮用户登入后我杀进程重开了）

## Risks
- 小程序字段映射不一致
- 数据库无 migration 机制
- 构建有 27 个 TS 错误（不影响运行时）
- 外贸站 SSH 密码认证 + root 直连存在暴力破解风险

## Evidence
- docs/MVP-2026-07-20.md
- Git commit d3c3fdb
- SERVER_ACCESS_AUDIT.md
- EOS/*（核心文件体系）
