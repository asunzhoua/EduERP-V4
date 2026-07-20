#!/usr/bin/env python3
"""Start localtunnel and bot server."""
import os
import subprocess
import sys
import time
import urllib.request

BASE = r"C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4"

# 1. Kill existing
subprocess.run(["taskkill", "/F", "/FI", "IMAGENAME eq node.exe"], capture_output=True)

# 2. Kill old bot server on 8888
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.connect(("127.0.0.1", 8888))
    # Port in use - kill it
    result = subprocess.run(
        ['powershell', '-Command', 'netstat -ano | findstr ":8888" | findstr LISTENING'],
        capture_output=True, text=True
    )
    for line in result.stdout.splitlines():
        parts = line.strip().split()
        if len(parts) >= 5:
            pid = parts[4]
            subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
    s.close()
except:
    pass
finally:
    s.close()

time.sleep(1)

# 3. Start bot server
os.environ["FEISHU_APP_ID"] = "cli_aad065c7f678dcee"
os.environ["FEISHU_APP_SECRET"] = "rAon59TJXeaWaZiUUHGymgRYd8LmjQr0"

bot = subprocess.Popen(
    [sys.executable, os.path.join(BASE, "backend/bot/feishu-bot-server.py"), "--port", "8888"],
    cwd=BASE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
)
print(f"Bot server started: PID={bot.pid}")
time.sleep(2)

# 4. Start localtunnel and capture URL
log_file = os.path.join(BASE, "backend/logs/lt_url.txt")
with open(log_file, "w") as f:
    tunnel = subprocess.Popen(
        ["lt", "--port", "8888"],
        cwd=BASE, stdout=f, stderr=subprocess.STDOUT
    )

print(f"Localtunnel started: PID={tunnel.pid}")
time.sleep(5)

# 5. Read the URL from log
with open(log_file) as f:
    content = f.read().strip()
    
url = None
for line in content.split("\n"):
    if "your url is:" in line:
        url = line.split("your url is:")[-1].strip()
        break

if url:
    print(f"\n{'='*60}")
    print(f"  NGROK替代隧道已启动!")
    print(f"  公网URL: {url}")
    print(f"  飞书回调: {url}/webhook/event")
    print(f"  把这个地址填到飞书开发者后台 → 事件与回调")
    print(f"{'='*60}")
else:
    print(f"URL not found in output:")
    print(content[:500])

# Keep running
print(f"\nPress Ctrl+C to stop all services...")
try:
    while True:
        time.sleep(10)
except KeyboardInterrupt:
    bot.terminate()
    tunnel.terminate()
    print("Services stopped.")
