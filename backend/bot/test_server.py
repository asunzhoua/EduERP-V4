#!/usr/bin/env python3
"""Self-contained test for the Feishu Bot Server (Phase 4.1)."""

import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

# ── Config ──
PORT = 8890
BASE = f"http://127.0.0.1:{PORT}"
SERVER_SCRIPT = os.path.join(os.path.dirname(__file__), "feishu-bot-server.py")


def req(method, path, body=None):
    """Make an HTTP request and return (status_code, data_dict)."""
    url = f"{BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            text = resp.read().decode("utf-8")
            return resp.status, json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8") if e.fp else ""
        try:
            return e.code, json.loads(text) if text else {}
        except Exception:
            return e.code, {"raw": text}


def main():
    # ── Start server ──
    proc = subprocess.Popen(
        [sys.executable, SERVER_SCRIPT, f"--port={PORT}"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    print(f"Server PID={proc.pid}, waiting for startup ...")
    time.sleep(3)

    # ── Test 1: Health ──
    code, data = req("GET", "/health")
    ok1 = code == 200 and data.get("status") == "ok"
    print(f"\n{'='*50}")
    print(f"[Test 1] GET /health")
    print(f"   Status: {code}")
    print(f"   Body:   {json.dumps(data, ensure_ascii=False)}")
    print(f"   Result: {'PASS' if ok1 else 'FAIL'}")

    # ── Test 2: Challenge ──
    code, data = req("POST", "/webhook/event", {"challenge": "test123"})
    ok2 = code == 200 and data.get("challenge") == "test123"
    print(f"\n{'='*50}")
    print(f"[Test 2] POST /webhook/event (challenge)")
    print(f"   Status: {code}")
    print(f"   Body:   {json.dumps(data, ensure_ascii=False)}")
    print(f"   Result: {'PASS' if ok2 else 'FAIL'}")

    # ── Test 3: Status command (simulated Feishu event) ──
    payload = {
        "event": {
            "message": {
                "chat_id": "mock_chat",
                "content": json.dumps({"text": "status"}, ensure_ascii=False),
                "msg_type": "text",
            },
            "sender": {
                "sender_id": {"user_id": "mock_user"},
            },
        }
    }
    code, data = req("POST", "/webhook/event", payload)
    ok3 = code == 200
    print(f"\n{'='*50}")
    print(f"[Test 3] POST /webhook/event (status command)")
    print(f"   Status: {code}")
    print(f"   Body:   {json.dumps(data, ensure_ascii=False)[:600]}")
    print(f"   Result: {'PASS' if ok3 else 'FAIL'}")

    # ── Test 4: 404 ──
    code, data = req("GET", "/nonexistent")
    ok4 = code == 404
    print(f"\n{'='*50}")
    print(f"[Test 4] GET /nonexistent (404)")
    print(f"   Status: {code}")
    print(f"   Result: {'PASS' if ok4 else 'FAIL'}")

    # ── Summary ──
    print(f"\n{'='*50}")
    passed = sum([ok1, ok2, ok3, ok4])
    total = 4
    print(f"Test Summary: {passed}/{total} passed")
    if passed == total:
        print("ALL PASSED!")
    else:
        print(f"{total - passed} test(s) failed")

    # ── Cleanup ──
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
    print(f"\nServer stopped (PID={proc.pid})")


if __name__ == "__main__":
    main()
