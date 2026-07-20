#!/usr/bin/env python3
"""pump-runner.py - Non-AI mission scheduler.

Executes mission tasks sequentially via `claude -p`, saving evidence and state.
Only uses the Python standard library.

Usage:
    python pump-runner.py start mission.json
    python pump-runner.py status <mission-id>
    python pump-runner.py abort  <mission-id>
    python pump-runner.py resume <mission-id>
"""

import argparse
import json
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import os

MISSIONS_DIR = Path(".missions")
MAX_CONSECUTIVE_FAILURES = 2
TASK_TIMEOUT = 3600  # seconds per task

NPM_PATH = r"C:\Users\sunz\AppData\Roaming\npm"

# -- Globals ----------------------------------------------------------------

_abort_requested = False


def _handle_sigint(sig, frame):
    global _abort_requested
    if _abort_requested:
        # Second Ctrl+C -> hard exit
        print("\n!!! Forced exit.", file=sys.stderr, flush=True)
        sys.exit(1)
    _abort_requested = True
    print("\n[!] Ctrl+C - finishing current task, then saving state...", flush=True)


signal.signal(signal.SIGINT, _handle_sigint)


# -- Helpers ----------------------------------------------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dir(mid: str) -> Path:
    return MISSIONS_DIR / mid


def _state_path(mid: str) -> Path:
    return _dir(mid) / "mission.state"


def _data_path(mid: str) -> Path:
    return _dir(mid) / "mission.data.json"


def _evidence_dir(mid: str, task_id: str) -> Path:
    return _dir(mid) / "evidence" / task_id


def load_state(mid: str) -> dict | None:
    p = _state_path(mid)
    if not p.exists():
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save_state(state: dict) -> None:
    d = _dir(state["id"])
    d.mkdir(parents=True, exist_ok=True)
    with open(d / "mission.state", "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)


def save_mission_data(mid: str, data: dict) -> None:
    d = _dir(mid)
    d.mkdir(parents=True, exist_ok=True)
    with open(d / "mission.data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_mission_data(mid: str) -> dict | None:
    p = _data_path(mid)
    if not p.exists():
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def build_state(mission: dict) -> dict:
    """Create fresh state from mission.json."""
    return {
        "id": mission["id"],
        "name": mission.get("name", mission["id"]),
        "status": "RUNNING",
        "started_at": now_iso(),
        "updated_at": now_iso(),
        "tasks": [
            {
                "id": t["id"],
                "label": t.get("label", t["id"]),
                "prompt": t["prompt"],
                "status": "PENDING",
                "retries": 0,
                "consecutive_failures": 0,
                "started_at": None,
                "finished_at": None,
                "exit_code": None,
            }
            for t in mission["tasks"]
        ],
    }


# -- Task execution ---------------------------------------------------------

def _build_env() -> dict[str, str]:
    """Build subprocess environment with npm PATH and proxy variables."""
    env = dict(os.environ)
    path = env.get("PATH", "")
    if NPM_PATH not in path:
        env["PATH"] = f"{NPM_PATH};{path}"
    print(f"  [env] PATH = {env['PATH'][:200]}...", flush=True)

    # Ensure http_proxy and https_proxy have a scheme prefix.
    # Claude Code CLI rejects proxy URLs without a scheme.
    for var in ("http_proxy", "https_proxy"):
        val = env.get(var) or env.get(var.upper())
        if val and not val.startswith(("http://", "https://", "socks://", "socks5://")):
            env[var] = f"http://{val}"
            print(f"  [env] Fixed {var}: appended http:// scheme", flush=True)

    return env


def execute_task(state: dict, idx: int) -> bool:
    """Run one task via `claude -p`. Returns True on success."""
    task = state["tasks"][idx]
    mid = state["id"]

    edir = _evidence_dir(mid, task["id"])
    edir.mkdir(parents=True, exist_ok=True)

    task["status"] = "RUNNING"
    task["started_at"] = now_iso()
    state["updated_at"] = now_iso()
    save_state(state)

    label = task["label"]
    print(f"  > [{label}] executing...", flush=True)

    stdout_path = edir / "stdout.log"
    stderr_path = edir / "stderr.log"

    try:
        with open(stdout_path, "w", encoding="utf-8") as out_f, \
             open(stderr_path, "w", encoding="utf-8") as err_f:
            # shell=True required: `claude` is a .cmd file on Windows,
            # not a .exe, so CreateProcess can't find it without the shell.
            cmd = f'claude -p "{task["prompt"]}"'
            proc = subprocess.run(
                cmd,
                stdout=out_f,
                stderr=err_f,
                timeout=TASK_TIMEOUT,
                env=_build_env(),
                shell=True,
            )

        task["exit_code"] = proc.returncode
        task["finished_at"] = now_iso()

        if proc.returncode == 0:
            task["status"] = "COMPLETED"
            task["consecutive_failures"] = 0
            state["updated_at"] = now_iso()
            save_state(state)
            print(f"  OK [{label}] completed", flush=True)
            return True

        # Non-zero exit
        task["consecutive_failures"] += 1
        task["retries"] += 1
        task["status"] = "FAILED"
        state["updated_at"] = now_iso()
        save_state(state)
        print(
            f"  FAIL [{label}] (exit={proc.returncode}, "
            f"consecutive_failures={task['consecutive_failures']})",
            flush=True,
        )
        return False

    except FileNotFoundError:
        task["finished_at"] = now_iso()
        task["consecutive_failures"] += 1
        task["retries"] += 1
        task["status"] = "FAILED"
        task["exit_code"] = -1
        state["updated_at"] = now_iso()
        save_state(state)
        print(
            f"  FAIL [{label}] 'claude' command not found on PATH",
            flush=True,
        )
        return False

    except subprocess.TimeoutExpired:
        task["finished_at"] = now_iso()
        task["consecutive_failures"] += 1
        task["retries"] += 1
        task["status"] = "FAILED"
        task["exit_code"] = -1
        state["updated_at"] = now_iso()
        save_state(state)
        print(f"  FAIL [{label}] timed out ({TASK_TIMEOUT}s)", flush=True)
        return False


# -- Mission runner ---------------------------------------------------------

def run_mission(state: dict) -> None:
    """Walk through tasks, retrying on failure, pausing on repeated failure."""
    for i, task in enumerate(state["tasks"]):
        # -- Abort check --
        if _abort_requested:
            _pause_remaining(state, i, reason="ABORTED")
            print(f"[ABORT] Mission {state['id']} stopped at task '{task['label']}'", flush=True)
            return

        # -- Skip already-done tasks (resume scenario) --
        if task["status"] == "COMPLETED":
            print(f"  -- [{task['label']}] already completed, skipping", flush=True)
            continue

        # -- Execute with retry loop --
        while not _abort_requested:
            ok = execute_task(state, i)

            if ok:
                break

            # Task failed
            if task["consecutive_failures"] >= MAX_CONSECUTIVE_FAILURES:
                _pause_remaining(state, i, reason="PAUSED")
                print(
                    f"[PAUSE] Mission {state['id']} PAUSED -- "
                    f"{MAX_CONSECUTIVE_FAILURES} consecutive failures on "
                    f"'{task['label']}'",
                    flush=True,
                )
                print(
                    f"  Resume with:  python pump-runner.py resume {state['id']}",
                    flush=True,
                )
                return

            print(f"  [RETRY] '{task['label']}'...", flush=True)
            time.sleep(2)

    # All tasks done
    if not _abort_requested:
        state["status"] = "COMPLETED"
        state["updated_at"] = now_iso()
        save_state(state)
        print(f"\n*** Mission {state['id']} completed! ***", flush=True)


def _pause_remaining(state: dict, current_idx: int, reason: str) -> None:
    """Set mission status and mark remaining PENDING tasks as PAUSED."""
    task = state["tasks"][current_idx]
    if reason == "ABORTED":
        state["status"] = "ABORTED"
    else:
        state["status"] = "PAUSED"
        task["status"] = "PAUSED"
    state["updated_at"] = now_iso()
    for t in state["tasks"][current_idx + 1 :]:
        if t["status"] in ("PENDING",):
            t["status"] = "PAUSED"
    save_state(state)


# -- CLI commands -----------------------------------------------------------

def cmd_start(args: argparse.Namespace) -> None:
    path = Path(args.mission)
    if not path.exists():
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        mission = json.load(f)

    mid = mission["id"]
    existing = load_state(mid)
    if existing and existing["status"] == "RUNNING":
        print(
            f"Error: mission {mid} is already RUNNING. "
            f"Abort or wait, then resume.",
            file=sys.stderr,
        )
        sys.exit(1)

    state = build_state(mission)
    save_state(state)
    save_mission_data(mid, mission)

    n = len(state["tasks"])
    print(f">>> Mission {mid} started -- {n} task{'s' if n != 1 else ''}", flush=True)
    run_mission(state)


def cmd_resume(args: argparse.Namespace) -> None:
    state = load_state(args.id)
    if not state:
        print(f"Error: mission {args.id} not found in {MISSIONS_DIR}/", file=sys.stderr)
        sys.exit(1)

    if state["status"] not in ("PAUSED", "ABORTED"):
        print(
            f"Error: mission {args.id} is {state['status']} -- "
            f"can only resume PAUSED or ABORTED missions",
            file=sys.stderr,
        )
        sys.exit(1)

    # Reset paused tasks back to PENDING with fresh failure counters
    for t in state["tasks"]:
        if t["status"] == "PAUSED":
            t["status"] = "PENDING"
            t["consecutive_failures"] = 0

    state["status"] = "RUNNING"
    state["updated_at"] = now_iso()
    save_state(state)

    print(f"[RESUME] Mission {args.id} resumed", flush=True)
    run_mission(state)


def cmd_abort(args: argparse.Namespace) -> None:
    state = load_state(args.id)
    if not state:
        print(f"Error: mission {args.id} not found", file=sys.stderr)
        sys.exit(1)

    if state["status"] in ("COMPLETED", "ABORTED"):
        print(f"Mission {args.id} is already {state['status']}.", file=sys.stderr)
        sys.exit(1)

    state["status"] = "ABORTED"
    state["updated_at"] = now_iso()
    save_state(state)
    print(f"[ABORT] Mission {args.id} aborted", flush=True)


def cmd_status(args: argparse.Namespace) -> None:
    state = load_state(args.id)
    if not state:
        print(f"Error: mission {args.id} not found", file=sys.stderr)
        sys.exit(1)

    done = sum(1 for t in state["tasks"] if t["status"] == "COMPLETED")
    failed = sum(1 for t in state["tasks"] if t["status"] == "FAILED")
    total = len(state["tasks"])

    tag = {
        "RUNNING": "[RUN]",
        "PAUSED": "[PAUSED]",
        "COMPLETED": "[DONE]",
        "ABORTED": "[ABORTED]",
    }.get(state["status"], "[?]")

    print(f"{tag}  Mission: {state['id']}")
    print(f"   Name:     {state['name']}")
    print(f"   Status:   {state['status']}")
    print(f"   Progress: {done}/{total} completed, {failed} failed")
    print(f"   Started:  {state['started_at']}")
    print(f"   Updated:  {state['updated_at']}")
    print()

    for t in state["tasks"]:
        ti = {
            "PENDING": "o ",
            "RUNNING": "* ",
            "COMPLETED": "OK",
            "FAILED": "X ",
            "PAUSED": "--",
        }.get(t["status"], "? ")
        retry_str = f"  (retries: {t['retries']})" if t["retries"] else ""
        extra = ""
        if t["exit_code"] is not None and t["status"] == "FAILED":
            extra = f"  exit={t['exit_code']}"
        print(f"   {ti} {t['label']}{retry_str}{extra}")


# -- Entry point ------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="pump-runner",
        description="Non-AI mission scheduler - runs tasks via `claude -p`",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_start = sub.add_parser("start", help="Start a new mission from a JSON file")
    p_start.add_argument("mission", help="Path to mission.json")

    p_status = sub.add_parser("status", help="Show mission status")
    p_status.add_argument("id", help="Mission ID")

    p_abort = sub.add_parser("abort", help="Abort a running/paused mission")
    p_abort.add_argument("id", help="Mission ID")

    p_resume = sub.add_parser("resume", help="Resume a paused/aborted mission")
    p_resume.add_argument("id", help="Mission ID")

    args = parser.parse_args()

    dispatch = {
        "start": cmd_start,
        "status": cmd_status,
        "abort": cmd_abort,
        "resume": cmd_resume,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
