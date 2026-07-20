#!/usr/bin/env python3
"""Start ngrok tunnel for EOS Bot Server."""
import os
import sys
import time

# Set env vars for bot
os.environ["FEISHU_APP_ID"] = "cli_aad065c7f678dcee"
os.environ["FEISHU_APP_SECRET"] = "rAon59TJXeaWaZiUUHGymgRYd8LmjQr0"

from pyngrok import ngrok

print("Downloading/starting ngrok...", flush=True)
ngrok.kill()
tunnel = ngrok.connect(8888, "http")

url = tunnel.public_url
print(f"\n{'='*60}")
print(f"  NGROK URL: {url}")
print(f"  回调地址:  {url}/webhook/event")
print(f"  Dashboard: http://127.0.0.1:4040")
print(f"  将此地址填入飞书开发者后台 → 事件与回调")
print(f"{'='*60}\n")

# Keep process alive
try:
    while True:
        time.sleep(60)
        # Check tunnels are still active
        if not ngrok.get_tunnels():
            print("Tunnel lost, reconnecting...")
            tunnel = ngrok.connect(8888, "http")
            print(f"New URL: {tunnel.public_url}")
except KeyboardInterrupt:
    print("\nShutting down ngrok...")
    ngrok.kill()
