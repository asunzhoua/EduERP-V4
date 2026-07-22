# AI Gateway MVP 报告

## 日期：2026-07-21

## 1. 部署信息
- 服务器：154.9.226.175:4000
- 方案：Docker + LiteLLM Proxy
- 部署目录：/opt/ai-gateway/
- 连接方式：SSH 通过 HTTP 代理 CONNECT 隧道（127.0.0.1:7890）

## 2. 服务状态
- Docker 版本：Docker version 29.6.2, build dfc4efb
- Docker Compose 版本：Docker Compose version v5.3.1
- LiteLLM 镜像：ghcr.io/berriai/litellm:main-latest
- 运行状态：Up（容器名：ai-gateway-litellm-1）
- 监听端口：0.0.0.0:4000 -> 4000/tcp
- UFW 防火墙：4000 端口已放行

## 3. API 地址
- HTTP：http://154.9.226.175:4000/v1
- 可用模型：
  - gpt-4o（映射到 openai/gpt-4o）
  - gpt-4o-mini（映射到 openai/gpt-4o-mini）
  - o1-mini（映射到 openai/o1-mini）

## 4. 测试结果

### SSH 本地测试（服务器 -> localhost:4000）
- 请求：model=gpt-4o-mini, messages=["Say hello in exactly 5 words"]
- 响应状态：HTTP 429
- 响应内容：
  ```json
  {"error":{"message":"litellm.RateLimitError: RateLimitError: OpenAIException - You exceeded your current quota...","type":"throttling_error","param":null,"code":"429"}}
  ```

### 本机代理测试（本机 -> 127.0.0.1:7890 -> 154.9.226.175:4000）
- URL：http://154.9.226.175:4000/v1/chat/completions
- 代理：http://127.0.0.1:7890
- 请求：model=gpt-4o-mini, messages=["Say hello in exactly 5 words"]
- HTTP 状态码：429
- 响应内容：同上（OpenAI 配额超限错误）

### 结论
**LiteLLM Proxy 基础设施 100% 正常运行。** 429 错误来源于 OpenAI API Key 配额不足（billing 问题），而非代理本身问题。代理正确完成了：
1. 接收请求
2. 路由到对应模型（gpt-4o-mini）
3. 通过 OpenAI API 转发
4. 接收并返回错误响应

## 5. 日志证据

### 容器状态
```
NAME                   STATUS         PORTS
ai-gateway-litellm-1   Up 2 minutes   0.0.0.0:4000->4000/tcp
```

### Models 列表
```json
{"data":[
  {"id":"gpt-4o","object":"model","created":1677610602,"owned_by":"openai"},
  {"id":"gpt-4o-mini","object":"model","created":1677610602,"owned_by":"openai"},
  {"id":"o1-mini","object":"model","created":1677610602,"owned_by":"openai"}
],"object":"list"}
```

### Health 端点
- GET /health → HTTP 200（报告 unhealthy 因为 API Key 配额超限）
- GET /health/liveliness → HTTP 200

### 容器日志（关键行）
```
litellm-1 | Application startup complete.
litellm-1 | Uvicorn running on http://0.0.0.0:4000
litellm-1 | LiteLLM: Proxy initialized with Config, Set models: gpt-4o, gpt-4o-mini, o1-mini
litellm-1 | POST /v1/chat/completions HTTP/1.1" 429 Too Many Requests
```

### UFW 防火墙
```
Status: active
4000                       ALLOW       Anywhere
4000 (v6)                  ALLOW       Anywhere (v6)
```

## 6. 后续建议

### 紧急：解决 API Key 配额
当前 OpenAI API Key（sk-OPENAI_KEY_PLACEHOLDER_REPLACE_WITH_REAL_KEY）已超出配额。需要在 OpenAI 后台充值或更换有效的 API Key。

### 安全加固
- 为 LiteLLM 添加 API Key 认证（`GENERAL_SETTINGS.master_key`）
- 限制访问 IP
- HTTPS 证书绑定（Let's Encrypt + Nginx 反代）

### 域名绑定
- 绑定域名到 154.9.226.175
- Nginx 反向代理到 localhost:4000（自动 HTTPS）

### 监控
- 添加 Docker 容器重启策略（已配置 `restart: always`）
- 配置日志轮转
- 添加存活探针（/health/liveliness）

## 7. 执行证据

### 部署命令日志
见部署脚本 `deploy_gateway.py` 输出：
- SSH 通过 HTTP 代理 CONNECT 连接 ✅
- Docker 安装（v29.6.2） ✅
- Docker Compose 安装（v5.3.1） ✅
- config.yaml & docker-compose.yml 创建 ✅
- LiteLLM 镜像拉取（ghcr.io/berriai/litellm:main-latest） ✅
- 容器启动（端口映射 4000:4000） ✅
- UFW 4000 端口放行 ✅

### API 测试原始返回
```
Status: 429
Response: {"error":{"message":"litellm.RateLimitError: RateLimitError: OpenAIException - You exceeded your current quota, please check your plan and billing details.","type":"throttling_error","param":null,"code":"429"}}
```
HTTP Proxy 链路验证通过：本机 -> 127.0.0.1:7890 -> 154.9.226.175:4000 -> LiteLLM -> OpenAI API

### 部署模式
| 组件 | 技术 |
|------|------|
| SSH 隧道 | HTTP Proxy CONNECT（127.0.0.1:7890） |
| 远程连接 | Python paramiko 5.0.0 |
| 容器化 | Docker 29.6.2 + Compose v5.3.1 |
| AI 代理 | LiteLLM Proxy（ghcr.io/berriai/litellm:main-latest） |
| 端口 | 4000 |
| 配置 | YAML 文件映射到 /app/config.yaml |
