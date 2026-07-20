#!/usr/bin/env python3
"""
feishu-ws-listener.py — 飞书长连接事件监听器（官方 SDK 方式）

独立子进程，通过 lark-oapi SDK 建立 WebSocket 长连接，
接收飞书事件并转发给 bot server HTTP 端点。

启动方式：由 feishu-bot-server.py 自动启动
"""

import asyncio
import json
import logging
import os
import sys
import time
import urllib.request
import urllib.error

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WSListener] %(levelname)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("WSListener")

# 从注册表读取环境变量
import subprocess
for var_name in ["FEISHU_APP_ID", "FEISHU_APP_SECRET"]:
    if not os.environ.get(var_name, "").strip():
        try:
            result = subprocess.run(
                ["reg", "query", "HKCU\\Environment", "/v", var_name],
                capture_output=True, text=True, timeout=5
            )
            value = result.stdout.strip().split()[-1]
            os.environ[var_name] = value
        except Exception:
            pass

FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "").strip()
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "").strip()
BOT_SERVER_URL = os.environ.get("WS_FORWARD_URL", "http://127.0.0.1:8888/webhook/event")

if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
    logger.error("FEISHU_APP_ID 或 FEISHU_APP_SECRET 未设置")
    sys.exit(1)

# ══════════════════════════════════════════════════════════
# SDK 导入（首次加载慢，但在子进程中可接受）
# ══════════════════════════════════════════════════════════
logger.info("正在加载 lark-oapi SDK（首次加载约 30 秒）...")
t0 = time.time()

sys.path.insert(0, r'C:\Users\sunz\AppData\Local\QwenPaw\Lib\site-packages')

from lark_oapi.ws import Client as WSClient
from lark_oapi import EventDispatcherHandler
from lark_oapi.core.enum import LogLevel

from lark_oapi.api.im.v1.model.p2_im_message_receive_v1 import P2ImMessageReceiveV1


logger.info(f"SDK 加载完成（耗时 {time.time()-t0:.1f} 秒）")


def forward_event(data: dict):
    """将飞书事件转发给 bot server。"""
    try:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            BOT_SERVER_URL,
            data=payload,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
    except Exception as exc:
        logger.error(f"转发事件失败: {exc}")


def handle_message(event: P2ImMessageReceiveV1):
    """处理 im.message.receive_v1 事件（SDK 已解析为类型对象）。"""
    event_type = event.header.event_type if event.header else "im.message.receive_v1"
    logger.info(f"收到事件: {event_type}")

    msg = event.event.message if event.event else None
    sender = event.event.sender if event.event else None
    if not msg:
        logger.warning("事件无 message 字段")
        return

    chat_id = msg.chat_id or ""
    sender_type = sender.sender_type if sender else "?"
    sender_open_id = sender.sender_id.open_id if sender and sender.sender_id else ""

    content = msg.content or "{}"
    msg_type = msg.message_type or ""

    logger.info(f"  来自: {sender_type} chat={chat_id} open_id={sender_open_id}")
    logger.info(f"  类型: {msg_type} 内容: {content[:200]}")

    # 转发给 bot server
    forward_event({
        "header": {"event_type": event_type},
        "event": {
            "message": {
                "chat_id": chat_id,
                "sender": {"sender_type": sender_type, "sender_id": sender_open_id},
                "content": content,
                "msg_type": msg_type,
            }
        }
    })


def main():
    logger.info(f"WS 监听器启动中...")
    logger.info(f"转发目标: {BOT_SERVER_URL}")

    # 创建事件分发器（长连接模式下不需要加密，传空字符串）
    event_handler = EventDispatcherHandler.builder("", "") \
        .register_p2_im_message_receive_v1(handle_message) \
        .build()

    # 创建 WS 客户端（官方 SDK 方式）
    ws_client = WSClient(
        app_id=FEISHU_APP_ID,
        app_secret=FEISHU_APP_SECRET,
        event_handler=event_handler,
        log_level=LogLevel.INFO,
        auto_reconnect=True,
    )

    logger.info("连接飞书长连接...")
    try:
        ws_client.start()
    except KeyboardInterrupt:
        logger.info("收到中断信号")
    except Exception as exc:
        logger.error(f"WS 客户端异常退出: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
