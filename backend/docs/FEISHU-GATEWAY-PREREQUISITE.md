# Feishu Gateway Prerequisite Checklist

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **状态**: 前置条件清单（设计，不实施）  
> **依据**: EOS-AI-ASSISTANT-ARCHITECTURE.md + 系统审计  

---

## 1. 必须新增组件

### 1.1 飞书 Event Subscription

| 属性 | 值 |
|:-----|:-----|
| **用途** | 接收飞书群消息事件，作为双向入口的基础 |
| **需要权限** | `im:message`（接收消息）+ `im:chat`（读取群信息） |
| **权限申请** | 飞书开发者后台 → 权限管理 → 添加 → 管理员审批 |
| **配置位置** | 飞书开发者后台 → 事件与回调 → 添加事件 → `im.message.receive_v1` |
| **回调地址** | 需要公网可达的 HTTPS URL |
| **实现方式** | Event 服务器监听飞书 POST 回调 |
| **验证方式** | 飞书 Challenge 机制（返回 `{"challenge":"..."}`） |
| **工作量估计** | 30分钟（权限申请）+ 2小时（配置） |
| **依赖** | Event 服务器就绪 |

**注意事项**:
- 飞书要求回调地址为 HTTPS（开发可用 ngrok 代理）
- 需要配置 Verification Token 验证回调真实性
- 事件推送有重试机制（最多3次，指数退避）

---

### 1.2 事件接收服务器

| 属性 | 值 |
|:-----|:-----|
| **用途** | 接收飞书 Webhook Event 并处理 |
| **技术选型** | Flask（轻量）/ FastAPI（高性能） |
| **部署方式** | 开发: ngrok → 本地 Flask；生产: 云服务器 |
| **核心功能** | 1. Challenge 验证 2. Token 校验 3. 消息解析 4. 路由分发 |
| **工作量估计** | 4小时（开发）+ 1小时（ngrok 配置测试） |
| **依赖** | Python 3.10+（已有） |

**端点设计**:
```
POST /feishu/event
  Headers: X-Request-ID, Content-Type: application/json
  Body: {encrypt, event, challenge, token, type}
  Response (Challenge): {"challenge": "xxx"}
  Response (Event): 200 OK
```

---

### 1.3 消息验证

| 属性 | 值 |
|:-----|:-----|
| **用途** | 确认消息来自飞书而非伪造 |
| **验证方式** | 飞书 Webhook Verification Token + Encrypt Key |
| **实现** | 对比请求体中的 `token` 字段与配置的 Verification Token |
| **可选增强** | AES 解密（配置 Encrypt Key 后飞书会加密消息体） |
| **工作量估计** | 1小时（集成 Token 校验） |
| **风险** | 低（标准模式） |

**验证流程**:
```
飞书 POST → 提取 token → 与配置对比 → 匹配 → 处理消息
                                    不匹配 → 401 拒绝
```

---

### 1.4 用户身份验证

| 属性 | 值 |
|:-----|:-----|
| **用途** | 确认发送者有权限操作 EOS 系统 |
| **验证方式** | 飞书 Open ID / User ID → 白名单检查 |
| **白名单** | 仅允许指定用户执行控制操作 |
| **查询实现** | 只读查询全员允许；控制操作仅白名单 |
| **工作量估计** | 1小时（白名单配置 + Open ID 提取） |

**权限分层**:
| 角色 | 允许操作 | 验证方式 |
|:------|:---------|:---------|
| Owner | 所有操作（创建/控制/查询） | 飞书 Open ID 匹配 |
| Member | 只读查询 | 无需验证 |

---

### 1.5 命令解析（GPT 翻译层）

| 属性 | 值 |
|:-----|:-----|
| **用途** | 自然语言 → Mission Draft |
| **实现方式** | GPT API 翻译，仅生成 Draft（不执行） |
| **输入** | 飞书群消息文本 |
| **输出** | Mission Draft JSON（需 Lobster 审核） |
| **工作量估计** | 8小时（GPT 提示词 + JSON Schema 定义） |
| **原则** | GPT 只做翻译，不做执行决策 |

**工作流**:
```
用户: "帮我查一下今天有没有待处理的 mission"
    → Event 服务器接收
    → GPT API 翻译意图
    → Mission Board 查询（只读）
    → 返回结果到群

用户: "创建一个新任务，检查后端服务状态"
    → Event 服务器接收
    → GPT API 生成 Draft JSON
    → Lobster 审核
    → 人工确认（飞书按钮或回复确认）
    → Pump Runner 执行
```

---

## 2. 必须禁止（架构边界）

### 2.1 GPT 边界

| 操作 | 允许/禁止 | 理由 |
|:-----|:---------|:------|
| 查询 Mission Board | ✅ 允许 | 只读 |
| 查询 Runtime 状态 | ✅ 允许 | 只读 |
| 生成 Mission Draft | ✅ 允许 | 需审核后执行 |
| 格式转换 | ✅ 允许 | 自然语言↔JSON |
| 调用 Claude Code | ❌ 禁止 | 越权，绕过 Pump Runner |
| 修改 Runtime 文件 | ❌ 禁止 | 违反 Runtime SOT |
| 修改 mission.state | ❌ 禁止 | Pump Runner 唯一写入 |
| 启动 Pump Runner | ❌ 禁止 | 无人审核则不可执行 |
| 修改飞书 Board | ❌ 禁止 | 只读 Control Plane |
| 执行 Shell 命令 | ❌ 禁止 | 无隔离沙箱 |

### 2.2 Event 服务器边界

| 操作 | 允许/禁止 |
|:-----|:---------|
| 接收飞书消息 | ✅ 允许 |
| 校验 Token | ✅ 允许 |
| 提取消息内容 | ✅ 允许 |
| 调用 GPT API | ✅ 允许 |
| 查询飞书 Board（只读） | ✅ 允许 |
| 修改 Runtime | ❌ 禁止 |
| 直接执行命令 | ❌ 禁止 |
| 绕过 Lobster 审核 | ❌ 禁止 |

---

## 3. 不改变的架构边界

```
飞书群
    │
    ▼ (HTTPS Event Callback)
Event Server (Flask/ngrok)
    │
    ▼ (GPT API)
GPT 翻译层 ─── 自然语言 → Mission Draft
    │
    ▼ (JSON Draft)
Lobster 审核 ─── 人工确认 / 自动调度
    │
    ▼
Pump Runner ─── 执行
    │
    ▼
Claude Code ─── 编码
```

### 三层隔离保持不变

| 层 | 当前 | 将来 |
|:---|:-----|:------|
| Entry | 无 | Feishu → Event Server → GPT |
| Control | Lobster | Lobster（不变） |
| Execution | Pump Runner → CC | Pump Runner → CC（不变） |

### 严格遵守的原则
1. **GPT 永远不接触 Runtime** — 只能查 Board，不能写文件
2. **Event 服务器永远不执行命令** — 只做路由和翻译
3. **所有执行必须经过 Lobster 审核** — 即使是机器审核
4. **飞书=Control Plane** — 不成为 Runtime Source of Truth

---

## 4. 实施顺序

| 步骤 | 事项 | 工作量 | 可并行 |
|:-----|:-----|:-------|:-------|
| 1 | 申请 `im:message` + `im:chat` 权限 | 15分钟 | — |
| 2 | 重新发布飞书应用版本 | 5分钟 | — |
| 3 | 开发 Event 服务器（Flask + Challenge） | 4小时 | — |
| 4 | 配置 ngrok + 飞书回调地址 | 1小时 | ⚡ 可与3并行 |
| 5 | 实现 Token 验证 | 1小时 | ⚡ 可与3并行 |
| 6 | 实现 GPT 翻译（自然语言→Draft） | 8小时 | 需5完成 |
| 7 | 集成 Lobster 审核接口 | 4小时 | 需6完成 |
| 8 | 完整闭环验证 | 4小时 | 需7完成 |

**总计**: 约 25 人时

---

## 5. 架构边界合理性验证

| 验证项 | 是否合理 | 理由 |
|:-------|:---------|:------|
| GPT 只做翻译不做执行 | ✅ 合理 | 避免 LLM 幻觉导致误操作 |
| Event 服务器只路由不执行 | ✅ 合理 | 保持攻击面最小 |
| Mission Draft 必须审核 | ✅ 合理 | 防止错误任务下发 |
| 飞书不直接接触 Runtime | ✅ 合理 | 已验证的架构隔离 |
| 三层隔离保持不变 | ✅ 合理 | 已通过 28/28 任务验证 |
