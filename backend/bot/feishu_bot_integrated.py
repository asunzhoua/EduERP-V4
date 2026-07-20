#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FEISHU-OFFICIAL-WS-VERIFY-001 / Task 005
集成版 Bot Server — WS 长连接 + Webhook 通知 + 命令响应

基于飞书官方 lark-oapi SDK（长连接模式）
- 收到 im.message.receive_v1 事件 → 解析消息 → 处理命令
- 支持 status 命令响应
- Webhook 通知层保持
"""

import json
import logging
import os
import subprocess
import sys
import threading
import time

# ── 环境变量 ──
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

APP_ID = os.environ.get("FEISHU_APP_ID", "").strip()
APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "").strip()

# ── 日志 ──
LOG_FILE = os.path.join(os.path.dirname(__file__), "feishu_bot_integrated.log")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("feishu-bot")

log.info("=" * 60)
log.info("Feishu Bot Integrated Server 启动中...")
log.info(f"APP_ID: {APP_ID[:10]}...")

# ── 加载 SDK（官方全量导入，约17s） ──
t0 = time.time()
import lark_oapi as lark
log.info(f"SDK 加载完成，耗时 {time.time()-t0:.1f}s")


def send_feishu_message(chat_id: str, text: str):
    """通过 API 发送消息到群聊"""
    # 获取 token
    try:
        import urllib.request
        resp = json.loads(urllib.request.urlopen(urllib.request.Request(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            json.dumps({"app_id": APP_ID, "app_secret": APP_SECRET}).encode(),
            {"Content-Type": "application/json"}, method="POST"
        ), timeout=10).read())
        token = resp.get("tenant_access_token", "")
    except Exception as e:
        log.error(f"获取 token 失败: {e}")
        return False

    # 发送消息
    body = {
        "receive_id": chat_id,
        "msg_type": "text",
        "content": json.dumps({"text": text})
    }
    try:
        req = urllib.request.Request(
            f"https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
            json.dumps(body).encode(),
            {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {token}"
            },
            method="POST"
        )
        resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
        if resp.get("code") == 0:
            log.info(f"消息发送成功: {text[:50]}")
            return True
        else:
            log.error(f"消息发送失败: {resp}")
            return False
    except Exception as e:
        log.error(f"发送消息异常: {e}")
        return False


def handle_status_command(message, sender, chat_id, chat_type):
    """处理 status 命令"""
    response = (
        "🤖 Ai协作团队 Bot 状态\n"
        "═══════════════════\n"
        f"✅ 事件: im.message.receive_v1\n"
        f"✅ SDK: lark-oapi v1.0.34\n"
        f"✅ 连接: 长连接\n"
        f"✅ 版本: v1.0.4\n"
        f"📎 chat_type: {chat_type}\n"
        f"📎 chat_id: {chat_id}\n"
        "═══════════════════\n"
        "🎉 闭环打通成功！"
    )
    send_feishu_message(chat_id, response)
    log.info(f"已回复 status 到 {chat_id}")


# ── 事件处理 ──
def do_p2_im_message_receive_v1(data: lark.im.v1.P2ImMessageReceiveV1) -> None:
    """处理 im.message.receive_v1 事件"""
    log.info("=" * 60)
    log.info("[EVENT] im.message.receive_v1 收到!")

    event_id = data.header.event_id if data.header else "unknown"
    log.info(f"  event_id: {event_id}")

    if not data.event:
        log.info("  无事件数据")
        return

    sender = data.event.sender
    message = data.event.message

    if sender:
        log.info(f"  sender_type: {sender.sender_type}")
        if sender.sender_id:
            log.info(f"  sender_open_id: {sender.sender_id.open_id}")

    if message:
        chat_id = message.chat_id or "unknown"
        chat_type = message.chat_type or "unknown"
        message_type = message.message_type or "unknown"
        content = message.content or ""

        log.info(f"  chat_id: {chat_id}")
        log.info(f"  chat_type: {chat_type}")
        log.info(f"  message_type: {message_type}")
        log.info(f"  content: {content[:200]}")

        # 解析文本消息
        if message_type == "text":
            try:
                content_obj = json.loads(content)
                raw_text = content_obj.get("text", "")
            except json.JSONDecodeError:
                raw_text = content

            log.info(f"  text: {raw_text}")

            # 任何消息都回复 status（验证阶段）
            handle_status_command(message, sender, chat_id, chat_type)

    log.info("=" * 60)


# ── 构建并启动 WS 客户端 ──
def main():
    event_handler = lark.EventDispatcherHandler.builder("", "") \
        .register_p2_im_message_receive_v1(do_p2_im_message_receive_v1) \
        .build()

    log.info("启动 WS 长连接客户端...")
    try:
        cli = lark.ws.Client(
            APP_ID,
            APP_SECRET,
            event_handler=event_handler,
            log_level=lark.LogLevel.DEBUG,
        )
        cli.start()
    except KeyboardInterrupt:
        log.info("用户中断")
    except Exception as exc:
        log.error(f"客户端异常: {type(exc).__name__}: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
