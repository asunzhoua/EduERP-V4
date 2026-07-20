#!/usr/bin/env python3
"""
FEISHU-OFFICIAL-WS-VERIFY-001 / Task 002
官方最小示例 — 严格按照飞书官方 SDK 文档

官方文档：
https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/server-side-sdk/python--sdk/handle-events

功能：
- 读取 FEISHU_APP_ID / FEISHU_APP_SECRET
- 初始化官方 lark-oapi SDK
- 注册 im.message.receive_v1 事件
- 收到事件后打印内容
"""

import os
import subprocess
import sys
import json
import time

# ── 从注册表读取环境变量 ──
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

if not APP_ID or not APP_SECRET:
    print("ERROR: FEISHU_APP_ID 或 FEISHU_APP_SECRET 未设置")
    sys.exit(1)

print(f"APP_ID: {APP_ID[:10]}...")
print(f"APP_SECRET: {APP_SECRET[:5]}...")

# ══════════════════════════════════════════════════════════════
# 官方 SDK 导入（官方示例：import lark_oapi as lark）
# 全量导入约 28 秒，属正常行为
# ══════════════════════════════════════════════════════════════
print("\n正在加载 lark-oapi SDK（全量导入约 28 秒）...")
t0 = time.time()

import lark_oapi as lark

print(f"SDK 加载完成，耗时 {time.time() - t0:.1f} 秒")
print(f"SDK 版本: {getattr(lark, '__version__', 'unknown')}")


# ── 事件处理函数（按官方文档定义） ──
def do_p2_im_message_receive_v1(data: lark.im.v1.P2ImMessageReceiveV1) -> None:
    """处理 im.message.receive_v1 事件"""
    print("\n" + "=" * 60)
    print("[EVENT] im.message.receive_v1 收到!")
    print("=" * 60)

    # 打印事件 header
    if data.header:
        print(f"  event_id:    {data.header.event_id}")
        print(f"  event_type:  {data.header.event_type}")
        print(f"  tenant_key:  {data.header.tenant_key}")
        print(f"  app_id:      {data.header.app_id}")
        print(f"  create_time: {data.header.create_time}")

    # 打印事件数据
    if data.event:
        sender = data.event.sender
        message = data.event.message

        if sender:
            print(f"\n  sender_type: {sender.sender_type}")
            if sender.sender_id:
                print(f"  sender_open_id: {sender.sender_id.open_id}")
                print(f"  sender_user_id: {sender.sender_id.user_id}")
                print(f"  sender_union_id: {sender.sender_id.union_id}")

        if message:
            print(f"\n  chat_id:      {message.chat_id}")
            print(f"  chat_type:    {message.chat_type}")
            print(f"  message_id:   {message.message_id}")
            print(f"  message_type: {message.message_type}")
            print(f"  content:      {message.content}")

            # 解析文本消息内容
            if message.message_type == "text":
                try:
                    content_obj = json.loads(message.content)
                    raw_text = content_obj.get("text", "")
                    print(f"  text:         {raw_text}")
                except json.JSONDecodeError:
                    print(f"  text:         {message.content}")

    print("=" * 60)
    print()


# ══════════════════════════════════════════════════════════════
# 构建事件处理器（按官方文档：builder("", "") 传空字符串）
# ══════════════════════════════════════════════════════════════
event_handler = lark.EventDispatcherHandler.builder("", "") \
    .register_p2_im_message_receive_v1(do_p2_im_message_receive_v1) \
    .build()


# ══════════════════════════════════════════════════════════════
# 启动 WS 客户端（按官方文档：lark.ws.Client(...).start()）
# ══════════════════════════════════════════════════════════════
def main():
    print("\n" + "-" * 60)
    print("启动飞书长连接客户端...")
    print("等待事件中...")
    print("在飞书群 @机器人 发送消息即可触发 im.message.receive_v1")
    print("-" * 60)

    try:
        cli = lark.ws.Client(
            APP_ID,
            APP_SECRET,
            event_handler=event_handler,
            log_level=lark.LogLevel.DEBUG,
        )
        cli.start()
    except KeyboardInterrupt:
        print("\n用户中断")
    except Exception as exc:
        print(f"\n客户端异常退出: {type(exc).__name__}: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
