#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FEISHU-OFFICIAL-MESSAGE-REPLY-VERIFY-001
官方最小回复验证

基于飞书官方文档 + 官方 SDK 示例：
- 参考: https://github.com/larksuite/oapi-sdk-python-demo

实现：
1. WS 长连接接收 im.message.receive_v1
2. 收到消息后通过官方 SDK 发送文本回复
3. 不扩展任何其他功能
"""

import json
import logging
import os
import subprocess
import sys
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
LOG_FILE = os.path.join(os.path.dirname(__file__), "feishu_reply_test.log")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("feishu-reply-test")

log.info("=" * 60)
log.info("Feishu Official Reply Test")
log.info(f"APP_ID: {APP_ID[:10]}...")

# ── 加载 SDK ──
t0 = time.time()
import lark_oapi as lark
log.info(f"SDK 加载完成，耗时 {time.time()-t0:.1f}s")

# ── 创建 API 客户端（官方示例 client.py 模式） ──
client = lark.Client.builder() \
    .app_id(APP_ID) \
    .app_secret(APP_SECRET) \
    .log_level(lark.LogLevel.DEBUG) \
    .build()
log.info("API 客户端创建完成")


def reply_text(chat_id: str, text: str) -> bool:
    """使用官方 SDK 发送文本消息"""
    from lark_oapi.api.im.v1 import (
        CreateMessageRequest,
        CreateMessageRequestBody,
    )

    content = json.dumps({"text": text})

    request = CreateMessageRequest.builder() \
        .receive_id_type("chat_id") \
        .request_body(CreateMessageRequestBody.builder()
                      .receive_id(chat_id)
                      .msg_type("text")
                      .content(content)
                      .build()) \
        .build()

    response = client.im.v1.message.create(request)

    if response.success():
        log.info(f"回复成功: chat_id={chat_id}, text={text[:50]}")
        log.debug(f"response: code={response.code}, msg={response.msg}")
        return True
    else:
        log.error(f"回复失败: code={response.code}, msg={response.msg}, log_id={response.get_log_id()}")
        return False


# ── 事件处理 ──
def do_p2_im_message_receive_v1(data: lark.im.v1.P2ImMessageReceiveV1) -> None:
    """处理接收消息事件"""
    log.info("=" * 60)
    log.info("[EVENT] im.message.receive_v1")
    log.info("=" * 60)

    # header
    if data.header:
        log.info(f"  event_id:    {data.header.event_id}")
        log.info(f"  event_type:  {data.header.event_type}")

    if not data.event:
        log.warning("  ❌ 无事件数据")
        return

    # sender
    sender = data.event.sender
    if sender:
        log.info(f"  sender_type:  {sender.sender_type}")
        if sender.sender_id:
            log.info(f"  sender.open_id:  {sender.sender_id.open_id}")
            log.info(f"  sender.union_id: {sender.sender_id.union_id}")

    # message
    message = data.event.message
    if message:
        chat_id = message.chat_id or "unknown"
        chat_type = message.chat_type or "unknown"
        msg_type = message.message_type or "unknown"
        content = message.content or ""

        log.info(f"  ═══════════════════════")
        log.info(f"  chat_id:   {chat_id}")
        log.info(f"  chat_type: {chat_type}")
        log.info(f"  ═══════════════════════")
        log.info(f"  message_type: {msg_type}")
        log.info(f"  content:      {content}")

        # 解析文本内容
        if msg_type == "text" and content:
            try:
                content_obj = json.loads(content)
                raw_text = content_obj.get("text", "")
                log.info(f"  raw_text:     {raw_text}")
            except json.JSONDecodeError:
                log.info(f"  raw_text:     {content}")

    # 回复固定文本
    if message:
        reply_text(chat_id, "收到消息 - 官方回复测试通过 ✅")

    log.info("=" * 60)


# ── 主程序 ──
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
        log.error(f"异常: {type(exc).__name__}: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
