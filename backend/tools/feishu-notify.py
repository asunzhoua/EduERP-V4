#!/usr/bin/env python3
"""
飞书 Webhook 通知脚本
========================
将消息发送到飞书群聊。

用法:
    python feishu-notify.py send --message "xxx" [--severity INFO|WARNING|ERROR] [--title "xxx"]

环境变量:
    FEISHU_WEBHOOK_URL  飞书机器人 Webhook 地址（必填）

Severity 级别:
    INFO     ℹ️
    WARNING  ⚠️
    ERROR    🚨
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error


SEVERITY_EMOJI = {
    "INFO": "\u2139\ufe0f",      # ℹ️
    "WARNING": "\u26a0\ufe0f",   # ⚠️
    "ERROR": "\U0001f6a8",       # 🚨
}

SEVERITY_LEVELS = {"INFO", "WARNING", "ERROR"}
DEFAULT_SEVERITY = "INFO"


def get_webhook_url() -> str:
    """从环境变量获取 Webhook URL，找不到时报错退出。"""
    url = os.environ.get("FEISHU_WEBHOOK_URL")
    if not url:
        print("Error: 环境变量 FEISHU_WEBHOOK_URL 未设置", file=sys.stderr)
        sys.exit(1)
    return url


def build_message_text(message: str, severity: str, title: str | None) -> str:
    """构建飞书消息文本，包含 emoji 前缀和可选标题。"""
    emoji = SEVERITY_EMOJI.get(severity, "")
    parts = [f"{emoji} [{severity}]"]

    if title:
        parts.append(f"\n**{title}**")

    parts.append(f"\n{message}")
    return "".join(parts)


def send_notification(webhook_url: str, text: str) -> None:
    """发送文本消息到飞书群。"""
    payload = json.dumps({
        "msg_type": "text",
        "content": {
            "text": text,
        },
    }, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body)
            if result.get("code") == 0:
                print(f"[OK] 通知发送成功: {result.get('msg', 'ok')}")
            else:
                print(f"[WARN] 飞书返回异常: {result}", file=sys.stderr)
                sys.exit(1)
    except urllib.error.HTTPError as e:
        print(f"Error: HTTP {e.code} {e.reason}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Error: 网络请求失败 - {e.reason}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: 响应解析失败 - {e}", file=sys.stderr)
        sys.exit(1)


def cmd_send(args: argparse.Namespace) -> None:
    """处理 send 子命令。"""
    severity = args.severity.upper()
    if severity not in SEVERITY_LEVELS:
        print(f"Error: 无效的 severity '{args.severity}'，可选: {', '.join(sorted(SEVERITY_LEVELS))}", file=sys.stderr)
        sys.exit(1)

    webhook_url = get_webhook_url()
    text = build_message_text(args.message, severity, args.title)
    send_notification(webhook_url, text)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="飞书 Webhook 通知工具",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # send 子命令
    send_parser = subparsers.add_parser("send", help="发送文本通知到飞书群")
    send_parser.add_argument(
        "--message", "-m",
        required=True,
        help="通知消息内容",
    )
    send_parser.add_argument(
        "--severity", "-s",
        default=DEFAULT_SEVERITY,
        choices=sorted(SEVERITY_LEVELS),
        help=f"严重级别（默认: {DEFAULT_SEVERITY}）",
    )
    send_parser.add_argument(
        "--title", "-t",
        default=None,
        help="消息标题（可选，加粗显示）",
    )

    args = parser.parse_args()

    if args.command == "send":
        cmd_send(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
