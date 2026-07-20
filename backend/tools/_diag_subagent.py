#!/usr/bin/env python3
"""Diagnose spawn_subagent timeout root cause."""
import subprocess
import sys
import time
import os

RESULTS = []

def test(name, cmd, timeout=10):
    t0 = time.time()
    try:
        r = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}
        )
        elapsed = time.time() - t0
        passed = r.returncode == 0
        output = r.stdout.strip()[:80] if r.stdout else "(no stdout)"
        stderr = r.stderr.strip()[:80] if r.stderr else ""
        RESULTS.append((name, passed, elapsed, output, stderr))
    except subprocess.TimeoutExpired:
        RESULTS.append((name, False, time.time()-t0, "TIMEOUT", ""))
    except Exception as e:
        RESULTS.append((name, False, time.time()-t0, str(e)[:80], ""))

# Test 1: Basic Python
test("1. basic python", [sys.executable, "-c", "print('ok')"])

# Test 2: Read small file AGENTS.md
test("2. read small file", [
    sys.executable, "-c",
    "open(r'C:\\Users\\sunz\\.qwenpaw\\workspaces\\default\\AGENTS.md').read(); print('ok')"
])

# Test 3: Read large file MEMORY.md  
test("3. read large file", [
    sys.executable, "-c",
    "d=open(r'C:\\Users\\sunz\\.qwenpaw\\workspaces\\default\\MEMORY.md').read(); print(f'ok {len(d)}b')"
])

# Test 4: Multiple file reads (like subagent does)
test("4. multi file read", [
    sys.executable, "-c", """
a=open(r'C:\\Users\\sunz\\.qwenpaw\\workspaces\\default\\AGENTS.md').read()
b=open(r'C:\\Users\\sunz\\.qwenpaw\\workspaces\\default\\HEARTBEAT.md').read()
c=open(r'C:\\Users\\sunz\\.qwenpaw\\workspaces\\default\\MEMORY.md').read()
print(f'ok {len(a)+len(b)+len(c)}b total')
"""
], timeout=15)

# Test 5: Requests library
test("5. requests import", [
    sys.executable, "-c", "import requests; print('ok')"
])

# Test 6: Fork mode simulation (start a subprocess that takes time)
test("6. sleep 3s", [
    sys.executable, "-c", "import time; time.sleep(3); print('ok')"
], timeout=10)

# Test 7: Network request (Feishu API)
test("7. feishu api", [
    sys.executable, "-c",
    "import requests; r=requests.get('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', timeout=5); print(f'ok {r.status_code}')"
], timeout=10)

# Test 8: Long running file operations like subagent does (read+write docs)
test("8. doc generation sim", [
    sys.executable, "-c",
    """
import os, json
# simulate reading multiple docs
docs_dir = r'C:\\Users\\sunz\\Desktop\\AI\\EduERP-V4\\EduERP-V4\\backend\\docs'
files = os.listdir(docs_dir)
content = ''
for f in sorted(files)[:5]:
    fp = os.path.join(docs_dir, f)
    if os.path.isfile(fp) and f.endswith('.md'):
        content += open(fp).read()[:2000]
print(f'ok read {len(files)} files, {len(content)}b')
"""
], timeout=15)

print("=" * 60)
print(f"  spawn_subagent Timeout Root Cause Diagnosis")
print(f"  Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"  Python: {sys.version}")
print("=" * 60)
for name, passed, elapsed, output, stderr in RESULTS:
    status = "PASS" if passed else "FAIL"
    extra = f" | stderr: {stderr}" if stderr else ""
    print(f"  [{status}] {name}: {elapsed:.1f}s -> {output}{extra}")
print("=" * 60)
