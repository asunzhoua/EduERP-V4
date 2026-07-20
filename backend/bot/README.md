# Feishu Bot Server — EOS Bot

EOS 系统的飞书机器人服务器，接收飞书群消息并回复系统状态。

## 启动方式

```bash
python feishu-bot-server.py --port 8888
```

默认端口 8888，可通过 `--port` 参数或环境变量 `PORT` 设置。

## ngrok 映射（开发用）

```bash
ngrok http 8888
```

将 ngrok 提供的 URL 配置到飞书 Event Subscription 中。

## 飞书 Event Subscription 配置

1. 飞书开发者后台 → 应用 → 事件与回调
2. 添加事件 `im.message.receive_v1`
3. 回调地址填写 ngrok URL + `/webhook/event`
4. 添加权限：`im:message` `im:chat`
5. 发布新版本

## 环境变量

| 变量 | 必填 | 说明 |
|:-----|:-----|:------|
| FEISHU_APP_ID | 是 | 飞书应用 App ID |
| FEISHU_APP_SECRET | 是 | 飞书应用 App Secret |
| PORT | 否 | 服务器端口（默认 8888） |

## 命令列表

| 命令 | 说明 |
|:-----|:------|
| status / 状态 | 查询 EOS 系统状态 |

## 日志

- 路径：`backend/logs/bot/EOSBot.log`
- 格式：`时间 | 级别 | 事件内容`
- 每日切分，保留 30 天

## 架构边界约束

- ❌ 不调用 Claude Code
- ❌ 不修改 Runtime（mission.state 只读）
- ❌ 不启动 Pump Runner
- ❌ 不生成 Mission
- ✅ 只查询系统状态
