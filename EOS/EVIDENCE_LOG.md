# EVIDENCE_LOG — EOS 执行证据记录

## Mission: EOS-CORE-INIT-2026-0721
Date: 2026-07-20
Changes: 创建 EOS Core 目录结构（8 个文件）
Tests: 75 suites / 935 tests ALL PASS（未改变后端代码）
Runtime: NestJS @ localhost:3000
Result: EOS Core v1.0 基础文件建立完成

## Mission: M-2026-07-20-001（响应格式修复）
Date: 2026-07-20
Changes: utils/request.js + app.js 响应判断修复
- res.data.success → res.data.code === 0
- 增加 res.data 空安全检查
Tests: 语法检查通过（node -c）
Runtime: 小程序代码
Result: 修复完成，待开发者工具验证

## Mission: M-2026-07-20-002（Git 版本固化）
Date: 2026-07-20
Changes: 
- Commit d3c3fdb — MVP 双端闭环版本
- docs/MVP-2026-07-20.md — 证据文档
- .gitignore 增加 *.bak *.log
- 清除 5 处硬编码飞书 App Secret
Tests: 935 ALL PASS
Git: SSH 推送成功，main + master 分支
Result: 版本锚点建立完成

## Mission: M-2026-07-19-001（JWT 安全加固）
Date: 2026-07-19
Changes: .env JWT_SECRET 替换为 64 字节随机 hex
Tests: 58 tests PASS（identity/auth + teaching/contract）
Result: 完成

## Mission: EOS-CORE-INIT-2026-0721-SERVER-AUDIT（外贸站 SSH 审计）
Date: 2026-07-21
Changes: 
- 通过 paramiko + HTTP proxy SSH 连接 154.9.226.175
- 采集 21 条系统命令信息
- 生成 SERVER_ACCESS_AUDIT.md
Status: SSH PASS
Environment: Ubuntu 22.04.5 LTS, 4 vCPU, 3.8G RAM, 20G+49G 磁盘
Docker: 未安装
Result: 资产登记完成，EOS 第一条真实运行记录

## Mission: AI-GATEWAY-MVP-2026-0721（AI 中转部署）
Date: 2026-07-21
Changes:
- 美国服务器 154.9.226.175 安装 Docker 29.6.2 + Compose v5.3.1
- 创建 /opt/ai-gateway/ 部署目录
- LiteLLM 容器运行，端口 4000
- 注册模型：gpt-4o / gpt-4o-mini / o1-mini
- UFW 放行 4000 端口
- 代理链路验证通过（本机 → HTTP代理 → 服务器 → OpenAI）
Status: INFRA ✅ / API KEY ❌（OpenAI 配额超限 429）
Result: 中转基础设施就绪，需充值或更换 API Key
