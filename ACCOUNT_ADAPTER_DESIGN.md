# ACCOUNT_ADAPTER_DESIGN.md — AI Gateway 账号适配可行性研究
## 日期：2026-07-21

## 1. 研究背景

当前已部署 AI Gateway（LiteLLM Proxy @ 154.9.226.175:4000），
需要评估将模型提供商账号接入统一 Gateway 的可行方案。

核心问题：国内客户端如何通过自建 Gateway，使用不同提供商的账号访问 AI 模型。

---

## 2. 支持的授权方式

### 2.1 Provider API Key（当前主流方式）

| 提供商 | 认证方式 | Key 格式 | 备注 |
|--------|----------|----------|------|
| OpenAI | API Key | sk-xxxxxxxx | 最通用 |
| Anthropic | API Key | sk-ant-xxxx | Claude 系列 |
| Google AI | API Key | AIzaSyxxx | Gemini |
| Azure OpenAI | Key / Entra ID OAuth | 资源名+key | 企业级 |
| DeepSeek | API Key | sk-xxx | 国产 |
| 通义千问 | API Key | sk-xxx | 阿里系 |
| 智谱 GLM | API Key | xxxxxx | 清华系 |
| 其他国产 | API Key | 各平台格式 | 均支持 Key |

结论：**API Key 是 AI 行业通用的认证方式。没有主流提供商支持 ChatGPT OAuth 或 Codex 授权给第三方 Gateway。**

### 2.2 ChatGPT OAuth / 账号共享（不可行）

- OpenAI 不提供 OAuth 授权 API 访问
- ChatGPT Plus/Pro 订阅账号无法通过 API 调用
- 模拟 ChatGPT 登录的行为违反 OpenAI ToS
- 结论：**不支持，也不应支持。**

### 2.3 Codex / Copilot OAuth（不可行）

- GitHub Copilot 使用 OAuth device flow 验证 Copilot 订阅
- Copilot 的 API 端点与通用 OpenAI API 不同
- 存在严格的风控（需要 IDE 插件签名）
- 结论：**不支持，且违反 GitHub ToS。**

### 2.4 Azure OAuth / 企业级（部分可行）

- Azure OpenAI 支持 OAuth 2.0 via Entra ID
- 需要企业 Azure 订阅
- 适用于企业场景，个人用户不适用

### 2.5 国产平台 OAuth（部分可行）

- 部分国产平台（百度千帆、阿里 DashScope）提供 OAuth 接入
- 主要用于平台生态，不对接第三方 Gateway
- 仍以 API Key 为主要方式

---

## 3. 可调用接口

### 3.1 OpenAI 兼容接口（已验证）

当前 Gateway 已验证可用的模型接口：

| 模型 | LiteLLM 模型名 | 后端 | 状态 |
|------|---------------|------|------|
| GPT-4o | openai/gpt-4o | OpenAI | ✅ |
| GPT-4o-mini | openai/gpt-4o-mini | OpenAI | ✅ |
| o1-mini | openai/o1-mini | OpenAI | ✅ |
| 理论上 Claude 3 | anthropic/claude-3-* | Anthropic | 需 Key |
| 理论上 Gemini | gemini/gemini-pro | Google | 需 Key |

### 3.2 LiteLLM 原生支持（80+ 提供商）

LiteLLM 支持包括但不限于：
- OpenAI / Azure OpenAI
- Anthropic / AWS Bedrock / GCP Vertex
- Cohere / Mistral / Together AI
- DeepSeek / 通义千问 / 智谱 GLM / 文心一言 / 讯飞星火
- Ollama（本地模型）
- 完整列表：https://docs.litellm.ai/docs/providers

### 3.3 One API 兼容（备选 Gateway）

One API 支持类似范围的提供商，且内置：
- 用户管理（注册/登录/分组）
- 令牌管理（过期时间/额度/IP限制）
- 兑换码充值
- 多机部署

---

## 4. Token 生命周期

### 4.1 当前三层 Token 模型

```
Provider Key (OpenAI sk-xxx)
    ↓ 管理员配置
Gateway Virtual Key (LiteLLM sk-xxx)
    ↓ 分配给用户
Client Token (存客户端本地)
```

### 4.2 Token 流转过程

```
用户客户端
    ↓ 请求携带 Client Token
Gateway (校验 Token 有效)
    ↓ 映射到 Provider Key
提供商 API (计费)
    ↓ 返回结果
Gateway (扣减额度)
    ↓
用户客户端
```

### 4.3 生命周期阶段

| 阶段 | 操作 | 责任方 |
|------|------|--------|
| 创建 | 管理员添加 Provider Key 到 Gateway | 管理员 |
| 分配 | 创建 Virtual Key，绑定模型/额度/IP | 管理员 |
| 使用 | 用户通过 Virtual Key 调用 API | 用户 |
| 计费 | Gateway 记录每次调用的 token 消耗 | Gateway |
| 轮换 | Provider Key 到期/额度用完，更换新 Key | 管理员 |
| 回收 | Virtual Key 过期/额度用完，自动失效 | Gateway |

### 4.4 Key 轮换策略

- Provider Key 轮换：直接改配置，重启 LiteLLM 或 hot reload
- Virtual Key 管理：LiteLLM 支持 API 创建/删除/更新 Virtual Key
- One API 支持：渠道（Provider Key）和令牌（Virtual Key）分离管理

---

## 5. 与 LiteLLM / One API 集成方式

### 5.1 当前架构（LiteLLM）

```
LiteLLM Proxy
    ├── config.yaml（Provider Keys）
    ├── Virtual Keys（用户 Token）
    └── Admin UI（管理界面）
```

### 5.2 集成方案对比

| 方案 | 复杂度 | 优点 | 缺点 |
|------|--------|------|------|
| **A: LiteLLM Virtual Keys** | 低 | 已有部署，直接使用 | 无用户管理界面 |
| **B: LiteLLM + OIDC Auth** | 中 | 支持外部身份认证 | 需要额外 IdP 服务 |
| **C: 替换为 One API** | 中 | 完整用户/令牌管理 | 需要重新部署 |
| **D: LiteLLM + One API 串联** | 高 | 兼顾 Gateway 和管理 | 两层维护成本 |
| **E: 自建 Account Adapter 插件** | 高 | 完全可控 | 开发成本高 |

### 5.3 推荐方案分析

**方案 C（One API）** 是当前阶段最平衡的方案：

- 开箱即用的用户管理（注册/登录/分组/额度）
- 完整的渠道管理（多 Provider Key 轮询）
- 令牌管理（过期/额度/IP/模型限制）
- 国产平台友好（内置 DashScope/GLM/文心等）
- 管理界面完整（非 Headless）

**迁移成本**：
- One API 使用 Go 编写，单二进制部署
- Docker 部署即可，端口错开（建议 4001）
- 可与 LiteLLM 并存过渡，数据迁移需脚本

### 5.4 LiteLLM Virtual Keys 配置示例（当前可用）

```yaml
# LiteLLM config.yaml
general_settings:
  master_key: "sk-admin-key"  # 管理 Key
  database_url: "postgresql://..."  # 持久化

model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: ${OPENAI_API_KEY}
```

创建 Virtual Key：
```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer sk-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"models": ["gpt-4o-mini"], "max_budget": 10.0}'
```

---

## 6. 风险点

### 6.1 安全风险

| 风险 | 级别 | 说明 |
|------|------|------|
| Provider Key 泄露 | P0 | 所有 Key 存储在 Gateway 配置中 |
| Token 盗用 | P1 | 用户 Token 泄露后可被他人使用 |
| 配额耗尽 | P1 | 无上限限制时，单用户可耗尽所有额度 |
| IP 白名单绕过 | P2 | 如果未配置 IP 限制 |

### 6.2 运营风险

| 风险 | 级别 | 说明 |
|------|------|------|
| Key 过期未换 | P0 | Provider Key 到期后所有服务中断 |
| 费用超支 | P1 | 无预算控制时可能产生意外账单 |
| 供应商限流 | P2 | 高并发场景下 Provider 限流 |
| 数据合规 | P2 | 通过境内 Gateway 转发境外 API 的合规性 |

### 6.3 架构风险

| 风险 | 级别 | 说明 |
|------|------|------|
| 单点故障 | P1 | Gateway 宕机后所有客户端不可用 |
| 延迟增加 | P2 | 多一跳代理增加响应时间 |
| 兼容性 | P2 | LiteLLM 版本更新可能改变行为 |

### 6.4 BYOK（自带 Key）风险

允许用户自己带 Key 接入时：
- 用户需要提供 API Key 给 Gateway（信任问题）
- Key 在传输和存储过程中可能泄露
- 用户 Key 额度无法监控（不经过 Gateway 计费）

---

## 7. 推荐实现路线

### 第一阶段：完善现有 LiteLLM（1-2 天）

当前 Gateway 已部署运行的后续步骤：

1. **修复 API Key 配额** — 充 OpenAI 余额或换有效 Key
2. **配置 master_key** — 为 LiteLLM 添加管理认证
3. **创建 Virtual Keys** — 为每个用户生成独立 Token
4. **配置预算限制** — 防止超支

验证：用户使用 Virtual Key 调用 http://154.9.226.175:4000/v1

### 第二阶段：评估 One API 替换（3-5 天）

如果需要对多用户场景有更好的管理能力：

1. 在现有服务器部署 One API（端口 4001）
2. 配置 Provider Channel（OpenAI Key）
3. 创建用户和 Token
4. 验证 API 兼容性
5. 与 LiteLLM 并行运行，对比稳定性

验证：One API + 用户 Token 成功调用模型

### 第三阶段：BYOK 支持（5-10 天）

如果用户需要自带 Key 接入：

1. 开发 Key 提交接口（用户输入自己的 API Key）
2. 实现 Key 加密存储（AES-256/HSM）
3. 实现动态路由（根据请求中的 Key 路由到不同提供商）
4. 实现 Key 健康检测（定期检查 Key 有效性和余额）
5. 实现 Key 统计（调用次数、消耗 Token）

验证：用户提交自己的 OpenAI Key → Gateway 成功转发 → 用户自己的配额扣费

### 第四阶段：国产模型扩增（按需）

如果国内用户需要低延迟国产模型：

1. 配置 One API 或 LiteLLM 的国产渠道
2. 添加 DeepSeek / 通义千问 / 智谱 GLM 等 Provider Key
3. 实现模型自动选择（按延迟/价格/可用性）

---

## 结论

**短期内（当前阻塞）：** 只需充 OpenAI 余额，当前 LiteLLM 即可正常工作。
**中期（用户管理需求）：** LiteLLM Virtual Keys 够用，不急需 One API。
**长期（BYOK 需求）：** 需要自建 Account Adapter 或在 LiteLLM/One API 基础上扩展。

**关键事实**：ChatGPT OAuth / Codex 授权不能用于 API Gateway。
所有主流 AI 提供商均使用 API Key 认证。
"账号适配"的实际含义是 **多 Key 管理 + Virtual Key 分发**，而不是 OAuth 接入。

---

## 附录：数据来源

- LiteLLM 文档：https://docs.litellm.ai/docs/
- One API：https://github.com/songquanpeng/one-api
- OpenAI API 文档：https://platform.openai.com/docs/
- 当前服务器已部署：LiteLLM Proxy @ 154.9.226.175:4000
- 当前状态：基础设施就绪，API Key 配额不足阻塞验证
