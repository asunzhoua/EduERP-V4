#!/usr/bin/env python3
"""
EOS Mission 状态通知脚本
通过龙虾 App 飞书 API 发送消息到 EOS AI Team 群

用法：
    python mission-notify.py <状态> <Mission ID> [消息内容]

状态：CREATED | RUNNING | REVIEWING | COMPLETED | FAILED
"""

import json
import os
import sys
import urllib.request

APP_ID = "your-feishu-app-id"
APP_SECRET = "your-feishu-app-secret"
CHAT_ID = "oc_6e919481fd56e839c5c8e9d1ba71b25b"

STATUS_EMOJI = {
    "CREATED": "📋",
    "RUNNING": "🔄",
    "REVIEWING": "🔍",
    "COMPLETED": "✅",
    "FAILED": "❌",
}


def get_token():
    body = json.dumps({"app_id": APP_ID, "app_secret": APP_SECRET}).encode()
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    return data.get("tenant_access_token", "")


def send_message(token, text):
    body = json.dumps({
        "receive_id": CHAT_ID,
        "msg_type": "text",
        "content": json.dumps({"text": text}, ensure_ascii=False),
    }, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    return data


def main():
    if len(sys.argv) < 3:
        print(f"用法: {sys.argv[0]} <STATUS> <MISSION_ID> [消息]")
        sys.exit(1)

    status = sys.argv[1].upper()
    mission_id = sys.argv[2]
    extra_msg = sys.argv[3] if len(sys.argv) > 3 else ""

    emoji = STATUS_EMOJI.get(status, "📌")
    text = f"{emoji} EOS Mission 状态\n"
    text += f"Mission: {mission_id}\n"
    text += f"状态: {status}\n"
    if extra_msg:
        text += f"{extra_msg}\n"
    text += f"时间: {__import__('datetime').datetime.now().strftime('%H:%M:%S')}"

    token = get_token()
    result = send_message(token, text)

    if result.get("code") == 0:
        print(f"[OK] {status} 通知发送成功")
    else:
        print(f"[FAIL] {result}")


if __name__ == "__main__":
    # 清除代理
    for k in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"]:
        os.environ.pop(k, None)
    main()
