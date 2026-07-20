#!/usr/bin/env python3
"""Pump Runner v1.0 — Mission lifecycle executor for EOS AI Team.

Usage:
    python pump_runner.py start <mission_id>
    python pump_runner.py status <mission_id>
    python pump_runner.py resume <mission_id>
    python pump_runner.py abort <mission_id>
"""
import json, os, sys, datetime, glob, subprocess, time, hashlib, shutil


MISSIONS_DIR = os.environ.get(
    "EOS_MISSIONS_DIR",
    r"C:\Users\sunz\.qwenpaw\workspaces\default\.missions",
)

# ── Find claude CLI executable ──
CLAUDE_CMD = "claude"
try:
    proc = subprocess.run(["where", "claude"], capture_output=True, text=True, timeout=5)
    if proc.returncode == 0 and proc.stdout.strip():
        CLAUDE_CMD = proc.stdout.strip().splitlines()[0]
except Exception:
    pass
_FALLBACK_PATHS = [
    os.path.expanduser(r"~\AppData\Roaming\npm\claude.cmd"),
    os.path.expanduser(r"~\AppData\Roaming\npm\claude"),
    r"C:\Users\sunz\AppData\Roaming\npm\claude.cmd",
]
for p in _FALLBACK_PATHS:
    if os.path.isfile(p):
        CLAUDE_CMD = p
        break


def log(level, msg, **kw):
    ts = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    extra = " ".join(f"{k}={v}" for k, v in kw.items())
    print(f'{{"ts":"{ts}","level":"{level}","msg":{json.dumps(msg)},"extra":{json.dumps(extra)}}}')


def load_mission(mission_id):
    path = os.path.join(MISSIONS_DIR, mission_id, "mission.state")
    if not os.path.isfile(path):
        log("FATAL", f"Mission state not found", path=path)
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        log("FATAL", f"Failed to read mission state", error=str(e))
        return None


def save_mission(state):
    mission_id = state.get("mission_id", "unknown")
    d = os.path.join(MISSIONS_DIR, mission_id)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, "mission.state")
    tmp = path + ".tmp"
    bak = path + ".bak"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        if os.path.isfile(path):
            shutil.copy2(path, bak)
        os.replace(tmp, path)
        log("INFO", f"State saved", mission_id=mission_id, status=state.get("status"))
        return True
    except (IOError, OSError) as e:
        log("FATAL", f"Failed to save mission state", error=str(e))
        return False


def update_status(state, new_status):
    state["status"] = new_status
    state["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    return save_mission(state)


def execute_task(task, state):
    log("INFO", "Task dispatch", task_id=task["id"], run=1)
    task["status"] = "RUNNING"
    task.setdefault("retries", 0)
    task.setdefault("consecutive_failures", 0)
    save_mission(state)

    mission_id = state.get("mission_id", "unknown")
    task_id = task["id"]
    ev_dir = os.path.join(MISSIONS_DIR, mission_id, "evidence", str(task_id))
    os.makedirs(ev_dir, exist_ok=True)

    # Build prompt from task description
    raw_desc = task.get("description", "")
    if not raw_desc:
        log("ERROR", "Task has no description", task_id=task_id)
        task["status"] = "FAILED"
        return False

    # Build prompt from task description.
    # CC in --print mode: MUST use exact format "Run this command using Bash tool: <command>"
    # Wrappers/prefixes confuse CC — keep it minimal and imperative.
    prompt = "Run this command using Bash tool: " + raw_desc

    # Determine project root (2 levels up from backend/tools/)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    log("INFO", "Task executing via CC", task_id=task_id, project=project_root)

    try:
        # Clear proxy env vars (CC rejects malformed proxy URLs like `127.0.0.1:7890` without scheme)
        clean_env = {**os.environ}
        for key in list(clean_env.keys()):
            if key.lower() in ("http_proxy", "https_proxy", "no_proxy", "all_proxy"):
                del clean_env[key]
        proc = subprocess.run(
            [CLAUDE_CMD, "-p", prompt, "--dangerously-skip-permissions", "--output-format", "text"],
            capture_output=True, text=True, timeout=300,
            cwd=project_root,
            env=clean_env,
            errors="replace",
        )
        exit_code = proc.returncode
        stdout = proc.stdout or ""
        stderr = proc.stderr or ""

        # Write evidence
        run_num = task.get("run_count", 0) + 1
        task["run_count"] = run_num

        stdout_path = os.path.join(ev_dir, f"run-{run_num:03d}.stdout.log")
        stderr_path = os.path.join(ev_dir, f"run-{run_num:03d}.stderr.log")
        meta_path = os.path.join(ev_dir, f"run-{run_num:03d}.meta.json")

        with open(stdout_path, "w", encoding="utf-8") as f:
            f.write(stdout[:100000]) if len(stdout) > 100000 else f.write(stdout)
        with open(stderr_path, "w", encoding="utf-8") as f:
            f.write(stderr[:100000]) if len(stderr) > 100000 else f.write(stderr)

        meta = {
            "task_id": task_id,
            "run_number": run_num,
            "exit_code": exit_code,
            "stdout_size": len(stdout),
            "stderr_size": len(stderr),
            "started_at": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        }
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        if exit_code == 0:
            log("INFO", "Task completed via CC", task_id=task_id, exit_code=exit_code)
            task["status"] = "COMPLETED"
            task["consecutive_failures"] = 0
            return True
        else:
            log("ERROR", "Task failed via CC", task_id=task_id, exit_code=exit_code)
            log("ERROR", "CC stderr", task_id=task_id, stderr=stderr[:500])
            task["status"] = "FAILED"
            return False

    except subprocess.TimeoutExpired:
        log("ERROR", "CC subprocess timed out (300s)", task_id=task_id)
        task["status"] = "FAILED"
        return False
    except FileNotFoundError:
        log("ERROR", "claude CLI not found", task_id=task_id, tried=CLAUDE_CMD)
        task["status"] = "FAILED"
        return False
    except Exception as exc:
        log("ERROR", "CC subprocess failed", task_id=task_id, error=str(exc))
        task["status"] = "FAILED"
        return False


def run_mission(state):
    mission_id = state.get("mission_id", "unknown")
    tasks = state.get("tasks", [])

    if state.get("status") in ("COMPLETED", "FAILED"):
        log("WARN", "Mission already in terminal state", status=state["status"])
        return state["status"]

    log("INFO", "Mission started", mission_id=mission_id)
    if not update_status(state, "RUNNING"):
        return "FAILED"

    for task in tasks:
        if task.get("status") in ("COMPLETED", "SKIPPED"):
            continue
        if not execute_task(task, state):
            log("ERROR", "Task failed unrecoverable", task_id=task["id"])
            update_status(state, "FAILED")
            return "FAILED"

    log("INFO", "Mission completed", mission_id=mission_id)
    update_status(state, "COMPLETED")
    return "COMPLETED"


def cli_start(args):
    if not args:
        return print("Usage: pump_runner.py start <mission_id>")
    state = load_mission(args[0])
    if not state:
        return
    result = run_mission(state)
    print(f"Result: {result}")


def cli_status(args):
    if not args:
        return print("Usage: pump_runner.py status <mission_id>")
    state = load_mission(args[0])
    if not state:
        return
    print(json.dumps(state, ensure_ascii=False, indent=2))


def cli_resume(args):
    if not args:
        return print("Usage: pump_runner.py resume <mission_id>")
    state = load_mission(args[0])
    if not state:
        return
    if state.get("status") not in ("RUNNING", "PAUSED", "RETRYING", "FAILED"):
        print(f"Mission status is {state.get('status')}, no need to resume")
        return
    for task in state.get("tasks", []):
        if task.get("status") in ("RUNNING", "RETRYING"):
            task["status"] = "CREATED"
            task["retries"] = 0
    run_mission(state)


def cli_abort(args):
    if not args:
        return print("Usage: pump_runner.py abort <mission_id>")
    state = load_mission(args[0])
    if not state:
        return
    update_status(state, "FAILED")
    print(f"Mission {args[0]} aborted (FAILED)")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return
    cmd = sys.argv[1]
    args = sys.argv[2:]

    cmds = {"start": cli_start, "status": cli_status, "resume": cli_resume, "abort": cli_abort}
    fn = cmds.get(cmd)
    if not fn:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        return
    fn(args)


if __name__ == "__main__":
    main()
