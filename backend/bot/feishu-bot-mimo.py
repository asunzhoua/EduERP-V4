#!/usr/bin/env python3
"""
feishu-bot-mimo.py — Mimo 飞书 Bot（lark-oapi WS 长连接模式）

独立 Bot 进程，通过 lark-oapi SDK 建立 WebSocket 长连接，
接收飞书消息事件，检查是否 @ 了当前机器人，如被 @ 则回复 "Mimo online"。

启动方式：直接运行 python feishu-bot-mimo.py
凭证来源：自动从 Mimo 的 agent.json 读取
"""

import asyncio
import json
import logging
import os
import sys
import time
from logging.handlers import TimedRotatingFileHandler

# ─────────────────────────────────────────────
# 日志配置：文件 + 控制台
# ─────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(SCRIPT_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

log_handler = TimedRotatingFileHandler(
    os.path.join(LOG_DIR, "mimo-bot.log"),
    when="midnight",
    backupCount=7,
    encoding="utf-8",
)
log_handler.setFormatter(logging.Formatter(
    "%(asctime)s [MimoBot] %(levelname)s %(message)s"
))

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter(
    "%(asctime)s [MimoBot] %(levelname)s %(message)s"
))

logger = logging.getLogger("MimoBot")
logger.setLevel(logging.INFO)
logger.addHandler(log_handler)
logger.addHandler(console_handler)

# ─────────────────────────────────────────────
# 从 agent.json 读取飞书凭证
# ─────────────────────────────────────────────
AGENT_JSON_PATH = os.path.join(
    os.path.expanduser("~"), ".qwenpaw", "workspaces", "mimo", "agent.json"
)


def load_credentials():
    """从 agent.json 读取飞书 app_id 和 app_secret。"""
    if not os.path.exists(AGENT_JSON_PATH):
        logger.error(f"agent.json 不存在: {AGENT_JSON_PATH}")
        sys.exit(1)

    with open(AGENT_JSON_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    feishu = config.get("channels", {}).get("feishu", {})
    app_id = feishu.get("app_id", "").strip()
    app_secret = feishu.get("app_secret", "").strip()

    if not app_id or not app_secret:
        logger.error("agent.json 中未找到飞书 app_id 或 app_secret")
        sys.exit(1)

    return app_id, app_secret


FEISHU_APP_ID, FEISHU_APP_SECRET = load_credentials()
logger.info(f"已加载 Mimo 飞书凭证: app_id={FEISHU_APP_ID[:10]}...")


# ─────────────────────────────────────────────
# SDK 导入（首次加载约 30 秒，仅在子进程中执行）
# ─────────────────────────────────────────────
logger.info("正在加载 lark-oapi SDK（首次加载约 30 秒）...")
t0 = time.time()

sys.path.insert(0, r'C:\Users\sunz\AppData\Local\QwenPaw\Lib\site-packages')

from lark_oapi.ws import Client as WSClient
from lark_oapi import EventDispatcherHandler
from lark_oapi import Client as ApiClient
from lark_oapi.core.enum import LogLevel
from lark_oapi.api.im.v1.model.p2_im_message_receive_v1 import P2ImMessageReceiveV1
from lark_oapi.api.im.v1.model.create_message_request import CreateMessageRequest
from lark_oapi.api.im.v1.model.create_message_request_body import CreateMessageRequestBody

logger.info(f"SDK 加载完成（耗时 {time.time()-t0:.1f} 秒）")

# ─────────────────────────────────────────────
# API 客户端（用于发送回复消息）
# ─────────────────────────────────────────────
api_client = ApiClient.builder() \
    .app_id(FEISHU_APP_ID) \
    .app_secret(FEISHU_APP_SECRET) \
    .build()


def reply_to_message(chat_id: str, message_id: str, text: str) -> bool:
    """
    使用飞书 API 回复消息。

    通过发送消息到 chat 来回复（使用 chat_id 作为 receive_id），
    确保回复出现在正确的会话中。
    """
    try:
        content = json.dumps({"text": text}, ensure_ascii=False)
        request = CreateMessageRequest.builder() \
            .receive_id_type("chat_id") \
            .request_body(CreateMessageRequestBody.builder() \
                .receive_id(chat_id) \
                .msg_type("text") \
                .content(content) \
                .build()) \
            .build()

        response = api_client.im.v1.message.create(request)
        if response.success():
            logger.info(f"回复成功: message_id={message_id} chat_id={chat_id} text='{text}'")
            return True
        else:
            logger.error(f"回复失败: code={response.code} msg={response.msg}")
            return False
    except Exception as exc:
        logger.error(f"回复异常: {exc}")
        return False


def is_bot_mentioned(mentions) -> bool:
    """检查 mentions 列表中是否包含当前 Bot。"""
    if not mentions:
        return False
    for mention in mentions:
        try:
            # SDK 可能返回对象或 dict
            if isinstance(mention, dict):
                mention_id = mention.get('id') or mention.get('key') or mention.get('mention_id')
            else:
                mention_id = getattr(mention, 'id', None) or getattr(mention, 'key', None) or getattr(mention, 'mention_id', None)
            if mention_id is not None:
                logger.info(f"  发现 @提及: id={mention_id}")
                return True
        except Exception as exc:
            logger.warning(f"  IS_BOT_MENTIONED exception: {exc}")
            continue
    return False


def handle_message(event: P2ImMessageReceiveV1):
    """处理 im.message.receive_v1 事件——检查 @ 并回复。"""
    event_type = event.header.event_type if event.header else "im.message.receive_v1"
    logger.info(f"收到事件: {event_type}")

    msg = event.event.message if event.event else None
    sender = event.event.sender if event.event else None
    if not msg:
        logger.warning("事件无 message 字段")
        return

    message_id = msg.message_id or ""
    chat_id = msg.chat_id or ""
    mentions = msg.mentions or []
    sender_open_id = sender.sender_id.open_id if sender and sender.sender_id else ""
    sender_type = sender.sender_type if sender else "?"

    content = msg.content or "{}"
    msg_type = msg.message_type or ""

    logger.info(f"  message_id={message_id} chat_id={chat_id}")
    logger.info(f"  来自: {sender_type} open_id={sender_open_id}")
    logger.info(f"  类型: {msg_type} 内容: {content[:200]}")

    # 检查是否被 @
    if not is_bot_mentioned(mentions):
        logger.info("消息未被提及，跳过回复")
        return

    # 被 @了，回复 "Mimo online"
    logger.info("✅ 被 @ 了，回复 'Mimo online'")
    reply_to_message(chat_id, message_id, "Mimo online")


def main():
    logger.info("=" * 60)
    logger.info("Mimo 飞书 Bot 启动中...")
    logger.info(f"凭证来源: {AGENT_JSON_PATH}")
    logger.info("=" * 60)

    # 创建事件分发器
    event_handler = EventDispatcherHandler.builder("", "") \
        .register_p2_im_message_receive_v1(handle_message) \
        .build()

    # 创建 WS 客户端
    ws_client = WSClient(
        app_id=FEISHU_APP_ID,
        app_secret=FEISHU_APP_SECRET,
        event_handler=event_handler,
        log_level=LogLevel.INFO,
        auto_reconnect=True,
    )

    logger.info("正在连接飞书 WebSocket 长连接...")
    try:
        ws_client.start()
    except KeyboardInterrupt:
        logger.info("收到中断信号，Bot 停止")
    except Exception as exc:
        logger.error(f"WS 客户端异常退出: {exc}")
        sys.exit(1)
    finally:
        logger.info("Mimo 飞书 Bot 已停止")


if __name__ == "__main__":
    main()
