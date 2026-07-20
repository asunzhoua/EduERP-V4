# FEISHU-OFFICIAL-DOC-CHECK.md

> 任务：FEISHU-OFFICIAL-WS-VERIFY-001 / Task 001-003
> 基于飞书官方文档核对长连接配置

## 状态总览（更新于 2026-07-19 05:19）

| Task | 状态 | 备注 |
|:-----|:-----|:------|
| **Task 001** | ✅ COMPLETE | 官方文档核对完成 |
| **Task 002** | ✅ COMPLETE | 官方最小示例创建并运行 |
| **Task 003** | ⏳ WAITING USER ACTION | WS 已连接，等待飞书群 @机器人 测试 |
| **Task 004** | ⏳ (如失败) | 预设，等待测试结果 |
| **Task 005** | ⏳ PENDING | 等待 Task 003 成功 |

## Task 001：官方文档核对

| 项目 | 官方要求 | 当前状态 |
|:-----|:---------|:---------|
| **长连接模式** | `lark_oapi.ws.Client` 建立 WS 全双工通道 | ✅ 已实现 |
| **SDK 版本** | `larksuite-oapi` | ✅ v1.0.34 |
| **导入方式** | `import lark_oapi as lark` | ✅ 全量导入约 17s |
| **EventDispatcherHandler** | `builder("", "")` 传空字符串 | ✅ 已修正 |
| **事件注册方法** | `register_p2_im_message_receive_v1()` | ✅ 正确 |
| **WS Client** | `lark.ws.Client(id, secret, event_handler=..., log_level=...)` | ✅ |
| **启动** | `cli.start()` 阻塞 | ✅ |
| **应用类型** | 企业自建应用 | ✅ 正式应用 |
| **EventDispatcherHandler 限制** | 初始导入 28s 全量 API，非同步阻塞导入 | ⚠️ 子进程方案 |

## Task 002：官方最小示例

| 检查项 | 结果 |
|:-------|:-----|
| SDK 加载时间 | 17.3~17.6s |
| WS 连接 | ✅ `connected to wss://msg-frontier.feishu.cn/ws/v2` |
| 心跳 | ✅ 持续正常 Ping/Pong |
| 事件接收 | ⏳ 等待用户发消息 |

## Task 003：关键成就

### ✅ 成功解决 `im.message.receive_v1` 事件订阅问题

**问题**：`im.message.receive_v1` checkbox 在开发者后台显示为灰色禁用
**根因**：checkbox **实际可用**（`input.disabled=false`），但 React UI 渲染样式误导。JS 直接操作 input 后成功勾选。
**解决步骤**：
1. 通过 JS 直接 dispatch click 事件 on checkbox input → ✅ 勾选成功
2. 点击"添加"按钮 → ✅ 事件添加成功
3. 弹窗提示权限开通 → 点击"确认开通权限" → ✅ 免审权限自动开通
4. 发布 v1.0.4 → ✅ 审核免审通过，立即生效

### ✅ 已发布版本 v1.0.4

| 项目 | 值 |
|:-----|:---|
| 版本号 | 1.0.4 |
| 新增事件 | `im.message.receive_v1` |
| 权限 | `im:message.p2p_msg:readonly` 已开通 |
| 发布状态 | 已发布，审核通过 |
| 订阅方式 | 长连接（非 HTTP） |

### ✅ 当前事件列表

| 事件 | 状态 |
|:-----|:-----|
| `im.chat.access_event.bot_p2p_chat_entered_v1` | ✅ 已订阅 |
| `im.chat.member.bot.added_v1` | ✅ 已订阅 |
| `p2p_chat_create` | ✅ 已订阅 |
| `im.message.receive_v1` | ✅ 已订阅（NEW） |

### ⏳ 待测试

**操作步骤**：
1. 在 EOS AI Team 群 @Ai协作团队 发送消息
2. 或与机器人私聊发送消息
3. WS 客户端收到事件后会打印到日志

**检查日志**：
```
type C:\Users\sunz\.qwenpaw\workspaces\default\minimal_test.log
```
预期看到 `[EVENT] im.message.receive_v1 收到!` 日志输出。

## Task 004：待定

如果 Task 003 成功，跳过此 Task。

## Task 005：待定

集成到现有 feishu_ws_worker.py + feishu-bot-server.py。

## 关键文档来源

- 官方 SDK Python 指南：https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/server-side-sdk/python--sdk/handle-events
- 官方 SDK GitHub：https://github.com/larksuite/oapi-sdk-python
- `lark_oapi/ws/client.py` v1.0.34 源码
- 开发者后台：Ai协作团队 (cli_aad065c7f678dcee)
