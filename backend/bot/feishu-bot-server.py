#!/usr/bin/env python3
"""
feishu-bot-server.py — EOS Feishu Bot Server (Phase 4.2)

Standard-library only HTTP server for Feishu event subscription.
Receives Feishu messages, processes commands, replies via Feishu API.

Architecture constraints:
  [OK] Receive messages -> parse -> process -> reply
  [OK] send_message async (non-blocking webhook response)
  [OK] send_feishu_notification (urllib.request, no extra dependencies)
  [NO] No AI/LLM calls
  [NO] No Claude Code
  [NO] No Runtime modification (except create_mission writes .missions/)
  [NO] No Pump Runner

Control-plane commands (via Feishu chat):
  - status / 状态      → get_system_status()
  - missions / 任务列表  → get_missions_list()
  - create mission: ... → create_mission()
"""

import argparse
import datetime
import glob
import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from logging.handlers import TimedRotatingFileHandler
from socketserver import ThreadingMixIn

# Fix stdout encoding for emoji on Windows GBK terminals
if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8",
                       buffering=1, closefd=False)

# ── Paths ──────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
LOG_DIR = os.path.join(BASE_DIR, "logs", "bot")
HEARTBEAT_LOG_DIR = os.path.join(BASE_DIR, "logs", "heartbeat")
MISSIONS_DIR = os.path.join(
    os.environ.get("USERPROFILE", "C:\\Users\\sunz"),
    ".qwenpaw", "workspaces", "default", ".missions",
)

# ── Feishu credentials (from environment) ──────────────────
FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "").strip()
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "").strip()
FEISHU_WEBHOOK_URL = os.environ.get("FEISHU_WEBHOOK_URL", "").strip()

# ── Mission status emoji mapping ───────────────────────────
MISSION_STATUS_EMOJI = {
    "COMPLETED": "✅",
    "RUNNING": "🔄",
    "FAILED": "❌",
    "PAUSED": "⏸",
    "CREATED": "📋",
    "PENDING": "⏳",
}

# ── Global token cache ─────────────────────────────────────
_token_cache: dict = {"token": None, "expires_at": 0.0}
_token_lock = threading.Lock()

# ── Global event_id dedup cache (P0) ───────────────────────
_processed_events: dict = {}  # event_id -> timestamp
_processed_events_lock = threading.Lock()
MAX_EVENT_CACHE = 1000

# ── Global sent message_ids set (P1 self-message filter) ───
_sent_message_ids: set = set()
_sent_message_ids_lock = threading.Lock()
MAX_SENT_IDS = 500

# ── Logging event type constants ───────────────────────────
CHALLENGE        = "CHALLENGE"
MESSAGE_RECEIVED = "MESSAGE_RECEIVED"
STATUS_REPLY     = "STATUS_REPLY"
MISSION_CREATED  = "MISSION_CREATED"
TOKEN_REFRESH    = "TOKEN_REFRESH"
TOKEN_FAILED     = "TOKEN_FAILED"
NOTIFICATION     = "NOTIFICATION"
ERROR            = "ERROR"
SERVER_START     = "SERVER_START"
LOG_ENTRY        = "ENTRY"
FIRST_PROCESS    = "FIRST_PROCESS"
DUPLICATE_EVENT  = "DUPLICATE_EVENT_IGNORED"
SELF_MESSAGE     = "SELF_MESSAGE_IGNORED"
EMPTY_COMMAND            = "EMPTY_COMMAND_IGNORED"
COMMAND_MISSION_DETAIL   = "COMMAND_MISSION_DETAIL"
COMMAND_MISSION_FILTER   = "COMMAND_MISSION_FILTER"


# =========================================================================
# Logger Setup
# =========================================================================

def setup_logger():
    """Configure rotating file logger + console output."""
    logger = logging.getLogger("EOSBot")
    logger.setLevel(logging.INFO)

    # File handler — midnight rotation, 7-day retention
    os.makedirs(LOG_DIR, exist_ok=True)
    fh = TimedRotatingFileHandler(
        os.path.join(LOG_DIR, "EOSBot.log"),
        when="midnight",
        interval=1,
        backupCount=7,
        encoding="utf-8",
    )
    fh.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
    ))
    logger.addHandler(fh)

    # Console handler
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
    ))
    logger.addHandler(ch)

    return logger


logger = setup_logger()


# =========================================================================
# Token Management
# =========================================================================

def get_tenant_token():
    """Return a valid tenant_access_token (cached / auto-refreshed)."""
    if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
        return None

    now = time.time()
    with _token_lock:
        if _token_cache["token"] and _token_cache["expires_at"] > now + 60:
            return _token_cache["token"]

    # ── Refresh token ──
    logger.info(f"{TOKEN_REFRESH} Refreshing tenant_access_token...")
    try:
        import urllib.request
        import urllib.error
        body = json.dumps({
            "app_id": FEISHU_APP_ID,
            "app_secret": FEISHU_APP_SECRET,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        logger.error(f"{TOKEN_FAILED} HTTP request failed: {exc}")
        return None

    token = data.get("tenant_access_token")
    if token:
        expires_in = data.get("expire", 7200)
        with _token_lock:
            _token_cache["token"] = token
            _token_cache["expires_at"] = now + expires_in - 60
        logger.info(f"{TOKEN_REFRESH} Token refreshed, expires in {expires_in}s")
        return token

    logger.error(f"{TOKEN_FAILED} API response: {data}")
    return None


# =========================================================================
# Feishu Messaging (send_message via API)
# =========================================================================

def send_message(chat_id, text):
    """Send a plain-text message to a Feishu chat. Retries once on 99991663."""
    token = get_tenant_token()
    if not token:
        logger.warning(f"send_message: token unavailable, cannot reply to {chat_id}")
        return False

    import urllib.request
    import urllib.error

    url = "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id"
    payload = {
        "receive_id": chat_id,
        "msg_type": "text",
        "content": json.dumps({"text": text}, ensure_ascii=False),
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        req = urllib.request.Request(url, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        code = data.get("code", -1)
    except Exception as exc:
        logger.error(f"{ERROR} send_message HTTP failed: {exc}")
        return False

    if code == 0:
        message_id = data.get("data", {}).get("message_id", "")
        if message_id:
            with _sent_message_ids_lock:
                _sent_message_ids.add(message_id)
                if len(_sent_message_ids) > MAX_SENT_IDS:
                    _sent_message_ids = set(list(_sent_message_ids)[-250:])
        logger.info(f"{STATUS_REPLY} Message sent to chat={chat_id} message_id={message_id}")
        return True

    # Token expired -> clear cache & retry once
    if code == 99991663:
        logger.warning(f"{TOKEN_FAILED} Token expired (99991663), clearing cache & retrying...")
        with _token_lock:
            _token_cache["token"] = None
            _token_cache["expires_at"] = 0.0
        return send_message(chat_id, text)  # one retry

    logger.error(f"{ERROR} send_message failed: code={code} body={data}")
    return False


# =========================================================================
# Feishu Notification (webhook, no dependency on feishu-notify.py subprocess)
# =========================================================================

def send_feishu_notification(message, severity="INFO", title=None):
    """Send a notification via Feishu webhook (urllib.request, no extra deps).

    Args:
        message:  Notification body text.
        severity: One of INFO/WARNING/ERROR (controls emoji prefix).
        title:    Optional bold title line.

    Returns:
        True on success, False on failure.
    """
    if not FEISHU_WEBHOOK_URL:
        logger.warning(f"{NOTIFICATION} FEISHU_WEBHOOK_URL not set, notification skipped")
        return False

    import urllib.request
    import urllib.error

    emoji_map = {"INFO": "\u2139\ufe0f", "WARNING": "\u26a0\ufe0f", "ERROR": "\U0001f6a8"}
    emoji = emoji_map.get(severity, "\u2139\ufe0f")

    text_parts = [f"{emoji} [{severity}]"]
    if title:
        text_parts.append(f"\n**{title}**")
    text_parts.append(f"\n{message}")

    payload = json.dumps({
        "msg_type": "text",
        "content": {
            "text": "".join(text_parts),
        },
    }, ensure_ascii=False).encode("utf-8")

    try:
        req = urllib.request.Request(
            FEISHU_WEBHOOK_URL,
            data=payload,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
        if resp_data.get("code") == 0:
            logger.info(f"{NOTIFICATION} Sent {severity}: {message[:60]}...")
            return True
        else:
            logger.warning(f"{NOTIFICATION} Feishu returned: {resp_data}")
            return False
    except urllib.error.HTTPError as e:
        logger.error(f"{NOTIFICATION} HTTP {e.code}: {e.reason}")
        return False
    except urllib.error.URLError as e:
        logger.error(f"{NOTIFICATION} Network error: {e.reason}")
        return False
    except json.JSONDecodeError as e:
        logger.error(f"{NOTIFICATION} Response parse error: {e}")
        return False
    except Exception as exc:
        logger.error(f"{NOTIFICATION} Unexpected error: {exc}")
        return False


# =========================================================================
# System Status (enhanced — reads real data)
# =========================================================================

def _read_heartbeat_summary():
    """Read the last Summary line from today's heartbeat log.

    Returns (timestamp, status, detail) or (None, None, None) on failure.
    """
    try:
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        log_path = os.path.join(HEARTBEAT_LOG_DIR, f"{today}.log")
        if not os.path.isfile(log_path):
            return None, None, None

        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        # Find last Summary line
        summary_line = None
        for line in reversed(lines):
            line = line.strip()
            if "Summary" in line and "|" in line:
                summary_line = line
                break

        if not summary_line:
            return None, None, None

        # Parse: 2026-07-18 15:06:50 | Summary | ALL_OK | OK=2, SKIP=1
        parts = [p.strip() for p in summary_line.split("|")]
        timestamp = parts[0] if len(parts) > 0 else None
        status = parts[2] if len(parts) > 2 else "UNKNOWN"
        detail = parts[3] if len(parts) > 3 else ""
        return timestamp, status, detail
    except Exception as exc:
        logger.warning(f"_read_heartbeat_summary failed: {exc}")
        return None, None, None


def _check_process(process_name):
    """Check if a Windows process is running via tasklist.

    Returns:
        "RUNNING" if found, "STOPPED" if not found,
        "无法获取" on error.
    """
    try:
        proc = subprocess.run(
            ["tasklist", "/FI", f"IMAGENAME eq {process_name}", "/NH"],
            capture_output=True, text=True, timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW
            if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
        )
        if process_name.lower() in proc.stdout.lower():
            return "RUNNING"
        return "STOPPED"
    except FileNotFoundError:
        # tasklist not available (non-Windows)
        return "N/A"
    except subprocess.TimeoutExpired:
        return "超时"
    except Exception as exc:
        logger.warning(f"_check_process({process_name}) failed: {exc}")
        return "无法获取"


def _get_mission_status_counts():
    """Scan .missions/ directory and return (counts_dict, latest_mission_info).

    Returns:
        (counts, latest) where counts has CREATED/RUNNING/COMPLETED/FAILED/PAUSED counts,
        and latest is (mission_id, status, updated_at) or None.
    """
    counts = {"CREATED": 0, "RUNNING": 0, "COMPLETED": 0, "FAILED": 0, "PAUSED": 0}
    latest = None
    latest_time = ""

    try:
        if not os.path.isdir(MISSIONS_DIR):
            return counts, None

        state_files = glob.glob(os.path.join(MISSIONS_DIR, "*", "mission.state"))
        for sf in state_files:
            try:
                with open(sf, "r", encoding="utf-8") as f:
                    st = json.load(f)
                status = st.get("status", "UNKNOWN")
                if status in counts:
                    counts[status] += 1
                # Track the latest by updated_at
                updated = st.get("updated_at", "")
                if updated and updated > latest_time:
                    latest_time = updated
                    latest = (st.get("mission_id", "?"), status, updated)
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Cannot read {sf}: {e}")
                continue
    except Exception as exc:
        logger.warning(f"_get_mission_status_counts failed: {exc}")

    return counts, latest


def get_system_status():
    """Build a formatted system-status report string (with emoji).

    All I/O is wrapped in try/except. A single failure never crashes.
    """
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = ["📊 EOS AI 状态\n"]

    # ── System ──
    lines.append("系统:")
    lines.append(f"  状态: ONLINE")

    # ── Pump Runner ──
    try:
        # Check for pump-runner or heartbeat_check process
        pump_status = _check_process("python.exe")
        # More specific: look for heartbeat_check in tasklist output
        try:
            proc = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq python.exe", "/NH"],
                capture_output=True, text=True, timeout=10,
                creationflags=subprocess.CREATE_NO_WINDOW
                if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
            )
            if "heartbeat_check" in proc.stdout.lower() or "pump" in proc.stdout.lower():
                pump_status = "RUNNING"
            elif "python" in proc.stdout.lower():
                pump_status = "IDLE"
            else:
                pump_status = "N/A"
        except Exception:
            pump_status = "N/A"
        lines.append(f"\nPump Runner:")
        lines.append(f"  状态: {pump_status}")
    except Exception:
        lines.append(f"\nPump Runner:")
        lines.append(f"  状态: N/A")

    # ── Claude Code ──
    cc_status = _check_process("claude.exe")
    lines.append(f"\nClaude Code:")
    lines.append(f"  进程: {cc_status}")

    # ── Current Mission ──
    counts, latest = _get_mission_status_counts()
    if latest:
        mid, mstatus, mtime = latest
        lines.append(f"\n当前 Mission:")
        lines.append(f"  {mid} ({mstatus})")
    else:
        lines.append(f"\n当前 Mission:")
        lines.append(f"  无")

    # ── Heartbeat ──
    hb_ts, hb_status, hb_detail = _read_heartbeat_summary()
    lines.append(f"\nHeartbeat:")
    if hb_ts and hb_status:
        lines.append(f"  最近检测: {hb_ts}")
        if hb_status == "ALL_OK":
            lines.append(f"  状态: ✅ OK ({hb_detail})")
        else:
            lines.append(f"  状态: ⚠️ {hb_status} ({hb_detail})")
    else:
        lines.append(f"  状态: N/A (无日志)")

    # ── Latest Evidence ──
    # Scan evidence files if any running/completed mission
    evd_text = "无"
    try:
        if os.path.isdir(MISSIONS_DIR):
            for sf in sorted(glob.glob(os.path.join(MISSIONS_DIR, "*", "mission.state")),
                             reverse=True):
                try:
                    with open(sf, "r", encoding="utf-8") as f:
                        st = json.load(f)
                    mid = st.get("mission_id", "")
                    evd_dir = os.path.join(os.path.dirname(sf), "evidence")
                    if os.path.isdir(evd_dir):
                        evd_files = [f for f in os.listdir(evd_dir)
                                     if f.endswith((".md", ".json", ".txt"))]
                        if evd_files:
                            evd_text = f"{mid}: {', '.join(sorted(evd_files)[:3])}"
                            break
                except Exception:
                    continue
    except Exception:
        pass
    lines.append(f"\n最新 Evidence:")
    lines.append(f"  {evd_text}")

    lines.append(f"\n---\n检查时间: {now_str}")
    return "\n".join(lines)


# =========================================================================
# Missions List
# =========================================================================

def get_missions_list(status_filter: str = None):
    """Scan .missions/ directory and return a formatted list of recent missions.

    Args:
        status_filter: Optional status to filter by (e.g. "running", "completed").
                       None = show summary of all missions.
    Returns:
        Formatted string.
    """

    STATUS_MAP = {
        "running": "RUNNING", "completed": "COMPLETED", "failed": "FAILED",
        "paused": "PAUSED", "created": "CREATED", "pending": "PENDING",
    }
    try:
        if not os.path.isdir(MISSIONS_DIR):
            return "📋 暂无 Mission 记录（.missions 目录不存在）"

        state_files = glob.glob(os.path.join(MISSIONS_DIR, "*", "mission.state"))
        if not state_files:
            return "📋 暂无 Mission 记录"

        missions = []
        for sf in state_files:
            try:
                with open(sf, "r", encoding="utf-8") as f:
                    st = json.load(f)
                mission_id = st.get("mission_id", os.path.basename(os.path.dirname(sf)))
                name = st.get("name", "")
                status = st.get("status", "UNKNOWN")
                executor = st.get("executor", "")
                created_at = st.get("created_at", "")
                updated_at = st.get("updated_at", "")

                # Determine sort key
                sort_key = updated_at or created_at or ""
                missions.append({
                    "id": mission_id,
                    "name": name,
                    "status": status,
                    "executor": executor,
                    "created_at": created_at,
                    "updated_at": updated_at,
                    "sort_key": sort_key,
                })
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Skipping unreadable mission state: {sf} ({e})")
                continue

        # Sort by sort_key descending
        missions.sort(key=lambda m: m["sort_key"], reverse=True)

        # ── Filter by status if requested ──
        if status_filter is not None:
            mapped = STATUS_MAP.get(status_filter.lower())
            if mapped is None:
                return "Unknown status filter. Available: running/completed/failed/paused/created/pending"
            filtered = [m for m in missions if m["status"] == mapped]
            if not filtered:
                return f"No {status_filter} missions found."
            lines = [f"Missions [{status_filter}]:\n"]
            for m in filtered[:20]:
                status_emoji = MISSION_STATUS_EMOJI.get(m["status"], "\u2753")
                lines.append(f"- {m['id']}: {m['name']}")
            return "\n".join(lines)

        # ── Summary mode (no filter) ──
        lines = ["📋 Missions 列表\n"]
        lines.append(f"最近 {min(5, len(missions))} 条:\n")

        for m in missions[:5]:
            status_emoji = MISSION_STATUS_EMOJI.get(m["status"], "❓")
            lines.append(f"{m['id']}: {m['name']}")
            lines.append(f"  状态: {status_emoji} {m['status']}")
            if m["executor"]:
                lines.append(f"  执行: {m['executor']}")
            if m["created_at"]:
                lines.append(f"  创建: {m['created_at']}")
            if m["status"] == "COMPLETED":
                lines.append(f"  结果: ✅ SUCCESS")
            lines.append("")

        # Summary line
        total = len(missions)
        c_created = sum(1 for m in missions if m["status"] == "CREATED")
        c_running = sum(1 for m in missions if m["status"] == "RUNNING")
        c_completed = sum(1 for m in missions if m["status"] == "COMPLETED")
        c_failed = sum(1 for m in missions if m["status"] == "FAILED")
        c_paused = sum(1 for m in missions if m["status"] == "PAUSED")
        lines.append(f"---\n总计: {total} | CREATED: {c_created} | RUNNING: {c_running} "
                     f"| COMPLETED: {c_completed} | FAILED: {c_failed} | PAUSED: {c_paused}")

        return "\n".join(lines)

    except Exception as exc:
        logger.error(f"get_missions_list failed: {exc}")
        return f"❌ 读取 Mission 列表失败: {exc}"


# =========================================================================
# Create Mission
# =========================================================================

def _generate_mission_id():
    """Generate the next Mission ID: M-YYYY-MM-DD-XXX.

    Scans .missions/ directory to find the highest existing sequence number
    for today, then increments by 1.
    """
    today_prefix = datetime.datetime.now().strftime("M-%Y-%m-%d-")
    max_seq = 0

    try:
        if os.path.isdir(MISSIONS_DIR):
            for dirname in os.listdir(MISSIONS_DIR):
                if dirname.startswith(today_prefix):
                    seq_str = dirname[len(today_prefix):]
                    try:
                        seq = int(seq_str)
                        if seq > max_seq:
                            max_seq = seq
                    except ValueError:
                        continue
    except Exception:
        pass

    return f"{today_prefix}{max_seq + 1:03d}"


def create_mission(text, creator_id):
    """Create a new mission draft (CREATED status, no auto-start).

    Args:
        text: Raw command text (e.g. "create mission: 修复Bug priority: P0")
        creator_id: Feishu user_id of the creator.

    Returns:
        (success_bool, result_message)
    """
    try:
        # Parse command text
        # Expected format: "create mission: <description>"
        # Optional: "priority: P0/P1/P2"
        description = ""
        priority = "P1"

        # Remove "create mission:" prefix
        match = re.search(r"create mission\s*:\s*(.*)", text, re.IGNORECASE)
        if match:
            remainder = match.group(1).strip()
        else:
            # Fallback: use the whole text after "create mission"
            remainder = text.replace("create mission", "", 1).strip()
            if remainder.startswith(":"):
                remainder = remainder[1:].strip()

        if not remainder:
            return False, "请提供任务描述，例如: create mission: 实现用户登录功能"

        # Extract priority if specified
        prio_match = re.search(r"priority\s*:\s*(P[0-2])", remainder, re.IGNORECASE)
        if prio_match:
            priority = prio_match.group(1).upper()
            # Remove priority part from description
            remainder = re.sub(r"priority\s*:\s*P[0-2]\s*", "", remainder, flags=re.IGNORECASE).strip()

        description = remainder.strip()
        if not description:
            return False, "请提供任务描述"

        # Generate Mission ID
        mission_id = _generate_mission_id()

        now_iso = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

        # Build mission state
        mission_state = {
            "mission_id": mission_id,
            "name": description[:80],  # Truncate long names
            "description": description,
            "status": "CREATED",
            "priority": priority,
            "owner": creator_id,
            "executor": "Claude Code",
            "created_at": now_iso,
            "updated_at": now_iso,
            "tasks": [
                {
                    "id": 1,
                    "description": description,
                    "status": "CREATED",
                }
            ],
        }

        # Create directory
        mission_dir = os.path.join(MISSIONS_DIR, mission_id)
        os.makedirs(mission_dir, exist_ok=True)

        # Write mission.state
        state_path = os.path.join(mission_dir, "mission.state")
        with open(state_path, "w", encoding="utf-8") as f:
            json.dump(mission_state, f, ensure_ascii=False, indent=2)

        # Verify write
        if not os.path.isfile(state_path):
            return False, f"❌ Mission 文件写入失败: {state_path}"

        with open(state_path, "r", encoding="utf-8") as f:
            verify = json.load(f)
        if verify.get("mission_id") != mission_id:
            return False, "❌ Mission 文件写入校验失败"

        logger.info(f"{MISSION_CREATED} Created {mission_id} by {creator_id}: {description[:60]}")

        # Send notification
        send_feishu_notification(
            message=f"Mission {mission_id} CREATED\nStatus: CREATED\nCreator: {creator_id}\nDescription: {description[:120]}",
            severity="INFO",
            title=f"Mission {mission_id} 已创建",
        )

        return True, (
            f"✅ Mission 创建成功\n"
            f"  ID: {mission_id}\n"
            f"  描述: {description}\n"
            f"  优先级: {priority}\n"
            f"  状态: CREATED\n"
            f"  文件: {state_path}"
        )

    except OSError as exc:
        logger.error(f"{ERROR} create_mission directory/file error: {exc}")
        return False, f"❌ 文件操作失败: {exc}"
    except Exception as exc:
        logger.error(f"{ERROR} create_mission failed: {exc}")
        return False, f"❌ 创建 Mission 失败: {exc}"


def get_mission_detail(mission_id: str) -> str:
    """Return detailed info for a given mission ID."""
    try:
        safe_id = os.path.basename(mission_id)
        mission_dir = os.path.join(MISSIONS_DIR, safe_id)
        state_path = os.path.join(mission_dir, "mission.state")
        with open(state_path, "r", encoding="utf-8") as f:
            state = json.load(f)
    except FileNotFoundError:
        return f"Mission {mission_id} not found"
    except json.JSONDecodeError:
        return f"Invalid mission state for {mission_id}"
    except Exception as e:
        return f"Error reading mission {mission_id}: {e}"

    status = state.get("status", "N/A")
    status_emoji = MISSION_STATUS_EMOJI.get(status, "\u2753")
    lines = []
    lines.append(f"Mission: {state.get('mission_id', safe_id)}")
    lines.append(f"Title: {state.get('title', 'N/A')}")
    lines.append(f"Status: {status_emoji} {status}")
    lines.append(f"Priority: {state.get('priority', 'N/A')}")
    lines.append(f"Executor: {state.get('executor', 'N/A')}")
    lines.append(f"Created: {state.get('created_at', 'N/A')}")
    lines.append(f"Updated: {state.get('updated_at', 'N/A')}")

    tasks = state.get("tasks", [])
    if tasks:
        lines.append("")
        lines.append("Tasks:")
        for i, t in enumerate(tasks, 1):
            desc = t.get("description", t.get("task", "N/A"))
            t_status = t.get("status", "N/A")
            lines.append(f"  {i}. {desc} [{t_status}]")

    evidence_dir = os.path.join(mission_dir, "evidence")
    if os.path.isdir(evidence_dir):
        files = [f for f in os.listdir(evidence_dir) if os.path.isfile(os.path.join(evidence_dir, f))]
        if files:
            lines.append("")
            lines.append("Evidence:")
            for f in files:
                lines.append(f"  - {f}")

    logger.info(f"{COMMAND_MISSION_DETAIL} mission_id={mission_id} status={status}")
    return "\n".join(lines)


# =========================================================================
# Webhook Event Router
# =========================================================================

def handle_webhook_event(body_bytes):
    """Dispatch an incoming Feishu webhook payload. Returns (response_dict, http_status)."""
    try:
        data = json.loads(body_bytes)
    except json.JSONDecodeError:
        body_preview = (body_bytes.decode("utf-8", errors="replace")[:500]
                        if isinstance(body_bytes, bytes) else str(body_bytes)[:500])
        logger.error(f"{LOG_ENTRY} JSON decode failed, body(500)={body_preview}")
        return {"error": "invalid json"}, 400

    # Challenge handshake
    if "challenge" in data:
        chal = data["challenge"]
        token = data.get("token", "")
        typ = data.get("type", "")
        logger.info(f"{CHALLENGE} challenge={chal} token={token} type={typ}")
        return {"challenge": chal}, 200

    # ── P0: event_id idempotency ───────────────────────────────
    event_id = (data.get("header", {}).get("event_id", "")
                or data.get("event_id", ""))
    if event_id:
        with _processed_events_lock:
            if event_id in _processed_events:
                logger.info(f"{DUPLICATE_EVENT} event_id={event_id}")
                return {"ok": True, "duplicate": True}, 200
            _processed_events[event_id] = time.time()
            if len(_processed_events) > MAX_EVENT_CACHE:
                sorted_items = sorted(
                    _processed_events.items(), key=lambda x: x[1]
                )
                for eid, _ in sorted_items[:200]:
                    del _processed_events[eid]
        logger.info(f"{FIRST_PROCESS} event_id={event_id}")
    # ── End P0 ─────────────────────────────────────────────────

    # im.message.receive_v1
    event = data.get("event", {})
    event_type = data.get("event_type", "")
    header_info = data.get("header", {})
    if event_type == "im.message.receive_v1":
        logger.info(f"{MESSAGE_RECEIVED} event_type={event_type} "
                     f"event_id={header_info.get('event_id','')} "
                     f"token={header_info.get('token','')} "
                     f"app_id={header_info.get('app_id','')}")

    message = event.get("message", {})
    # Feishu API uses "message_type" (not "msg_type")
    msg_type = message.get("message_type", message.get("msg_type", ""))

    if msg_type == "text":
        chat_id = message.get("chat_id", "")
        sender = event.get("sender", {})
        sender_id = sender.get("sender_id", {}).get("user_id", "")
        message_id = message.get("message_id", "")

        # P1: self-message filter (check message_id against sent messages)
        with _sent_message_ids_lock:
            if message_id in _sent_message_ids:
                logger.info(f"{SELF_MESSAGE} chat_id={chat_id} message_id={message_id}")
                return {"ok": True, "ignored": True}, 200

        content_raw = message.get("content", "{}")

        try:
            if isinstance(content_raw, str):
                content = json.loads(content_raw)
            else:
                content = content_raw  # already parsed
            raw_text = content.get("text", "").strip()
        except (json.JSONDecodeError, TypeError, AttributeError):
            raw_text = ""

        # Remove @_user_\d+ mention prefix
        normalized_text = re.sub(r'@_user_\d+\s*', '', raw_text).strip()
        text_lower = normalized_text.lower()

        logger.info(f"{MESSAGE_RECEIVED} from={sender_id} chat={chat_id} raw_message={raw_text!r} normalized_message={normalized_text!r}")

        # P2: empty message silent ignore
        if not normalized_text:
            logger.info(f"{EMPTY_COMMAND} chat={chat_id}")
            return {"ok": True, "ignored": True}, 200

        # ── Known commands (priority: exact match > startswith) ──
        if text_lower in ("status", "状态"):
            logger.info(f"COMMAND_MATCHED from={sender_id} chat={chat_id} command={text_lower!r}")
            status_text = get_system_status()
            send_message(chat_id, status_text)
            return {"ok": True}, 200

        if text_lower in ("missions", "任务列表") or text_lower == "list":
            logger.info(f"COMMAND_MATCHED from={sender_id} chat={chat_id} command={text_lower!r}")
            missions_text = get_missions_list()
            send_message(chat_id, missions_text)
            return {"ok": True}, 200

        if normalized_text.startswith("mission "):
            mission_id = normalized_text[8:].strip()
            logger.info(f"{COMMAND_MISSION_DETAIL} from={sender_id} chat={chat_id} mission={mission_id!r}")
            detail_text = get_mission_detail(mission_id)
            send_message(chat_id, detail_text)
            return {"ok": True}, 200

        if text_lower.startswith("任务 "):
            mission_id = normalized_text[3:].strip()
            logger.info(f"{COMMAND_MISSION_DETAIL} from={sender_id} chat={chat_id} mission={mission_id!r}")
            detail_text = get_mission_detail(mission_id)
            send_message(chat_id, detail_text)
            return {"ok": True}, 200

        if text_lower.startswith("missions "):
            filter_val = normalized_text[9:].strip()
            logger.info(f"{COMMAND_MISSION_FILTER} from={sender_id} chat={chat_id} filter={filter_val!r}")
            missions_text = get_missions_list(filter_val)
            send_message(chat_id, missions_text)
            return {"ok": True}, 200

        if text_lower.startswith("create mission"):
            logger.info(f"COMMAND_MATCHED from={sender_id} chat={chat_id} command={text_lower!r}")
            success, result = create_mission(raw_text, sender_id)
            send_message(chat_id, result)
            return {"ok": True, "mission_created": success}, 200

        if text_lower.startswith("跑 ") or text_lower.startswith("run "):
            parts = normalized_text.split(None, 1)
            if len(parts) >= 2:
                run_arg = parts[1].strip()
                # Accept both mission ID or number
                if run_arg.startswith("M-"):
                    mission_id = run_arg
                else:
                    # Map number to mission ID (existing logic)
                    try:
                        num = int(run_arg.split()[0]) if " " in run_arg else int(run_arg)
                        mission_map = {
                            1: "M-2026-07-18-001", 2: "M-2026-07-18-002",
                            3: "M-2026-07-19-001", 4: "M-2026-07-19-002",
                            5: "M-2026-07-19-003", 6: "M-2026-07-19-004",
                        }
                        mission_id = mission_map.get(num, f"M-2026-07-20-{num:03d}")
                    except ValueError:
                        mission_id = run_arg
                logger.info(f"COMMAND_RUN from={sender_id} chat={chat_id} mission_id={mission_id!r}")
                try:
                    runner_script = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tools", "pump_runner.py")
                    proc = subprocess.run(
                        [sys.executable, runner_script, "start", mission_id],
                        capture_output=True, text=True, timeout=120,
                        cwd=os.path.dirname(os.path.dirname(__file__))
                    )
                    output = proc.stdout + proc.stderr
                    send_message(chat_id, f"🚀 Pump Runner 启动 {mission_id}\n{output[:1500]}")
                except subprocess.TimeoutExpired:
                    send_message(chat_id, f"⏱️ Pump Runner 超时 (120s)，Mission {mission_id} 已开始，请稍后查看状态")
                except Exception as e:
                    send_message(chat_id, f"❌ Pump Runner 启动失败: {e}")
            else:
                send_message(chat_id, "用法: run <mission_id> 或 跑 <mission_id>")
            return {"ok": True}, 200

        # Everything else -> show help
        help_text = (
            "可用命令:\n"
            "  状态 / status — 查看系统状态\n"
            "  任务列表 / missions — 查看任务列表\n"
            "  missions running / missions completed — 按状态筛选任务\n"
            "  mission M-xxx / 任务 M-xxx — 查看 Mission 详情\n"
            "  run <id> / 跑 <id> — 执行 Mission\n"
            "  create mission: <描述> — 创建新任务"
        )
        send_message(chat_id, help_text)
        return {"ok": True, "replied_with_help": True}, 200

    return {"ok": True, "ignored": True}, 200


# =========================================================================
# HTTP Server
# =========================================================================

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """HTTP server that handles each request in a separate thread."""
    daemon_threads = True
    allow_reuse_address = True


class BotHandler(BaseHTTPRequestHandler):
    """Request handler for the EOS Bot HTTP server."""

    # Suppress default per-request logging
    def log_message(self, fmt, *args):
        pass

    # -- helpers --

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # -- GET --

    def do_GET(self):
        if self.path == "/health":
            self._send_json({
                "status": "ok",
                "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "pid": os.getpid(),
            })
        else:
            self._send_json({"error": "not found"}, 404)

    # -- POST --

    def do_POST(self):
        # ── Entry log ──
        now_iso = datetime.datetime.now().isoformat()
        logger.info(f"{LOG_ENTRY} POST {self.path} at {now_iso}")
        logger.debug(f"{LOG_ENTRY} headers: {dict(self.headers)}")

        if self.path == "/webhook/event":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            body_text = body.decode("utf-8", errors="replace")
            logger.debug(f"{LOG_ENTRY} body({len(body)}): {body_text[:2000]}")
            resp_data, status = handle_webhook_event(body)
            self._send_json(resp_data, status)
        else:
            self._send_json({"error": "not found"}, 404)


# =========================================================================
# WS Client Subprocess Management
# =========================================================================

_ws_process: "subprocess.Popen | None" = None
_ws_monitor_thread: threading.Thread | None = None


def _start_ws_client():
    """Start feishu-ws-client.py as a subprocess."""
    global _ws_process
    
    # ── Kill existing WS Worker if alive ──
    if _ws_process and _ws_process.poll() is None:
        logger.info("WS Worker already running, stopping first...")
        _stop_ws_client()
    
    # ── Scan tasklist for orphaned WS workers (from old Bot Server instances) ──
    try:
        proc = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq python.exe", "/NH", "/FO", "CSV"],
            capture_output=True, text=True, timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
        )
        ws_script_name = "feishu_ws_worker.py"
        for line in proc.stdout.splitlines():
            if ws_script_name in line.lower():
                # Extract PID from CSV: "python.exe","1234","Console","1","123,456 K"
                parts = [p.strip(' "') for p in line.split(',')]
                if len(parts) >= 2:
                    orphan_pid = parts[1]
                    if orphan_pid.isdigit() and (_ws_process is None or orphan_pid != str(_ws_process.pid)):
                        logger.info(f"Killing orphaned WS Worker (PID {orphan_pid})")
                        subprocess.run(
                            ["taskkill", "/PID", orphan_pid, "/F"],
                            capture_output=True, timeout=5,
                            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
                        )
    except Exception as exc:
        logger.warning(f"Failed to scan/kill orphaned WS workers: {exc}")
    
    ws_script = os.path.join(os.path.dirname(__file__), "feishu_ws_worker.py")
    if not os.path.exists(ws_script):
        logger.warning(f"WS client script not found: {ws_script}")
        return

    FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "").strip()
    FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "").strip()
    if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
        logger.warning("FEISHU_APP_ID/FEISHU_APP_SECRET not set, WS client not started")
        return

    logger.info("Starting Feishu WS Client subprocess (long-connection)...")
    try:
        _ws_process = subprocess.Popen(
            [sys.executable, ws_script],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env={**os.environ},
            bufsize=1,
        )
        logger.info(f"WS Client started (PID: {_ws_process.pid})")
    except Exception as exc:
        logger.error(f"Failed to start WS client: {exc}")
        _ws_process = None


def _monitor_ws_client():
    """Monitor WS client output in background thread."""
    global _ws_process
    while _ws_process:
        try:
            line = _ws_process.stdout.readline()
            if not line:
                break
            line = line.decode("utf-8", errors="replace").rstrip()
            if line:
                print(f"[WSClient] {line}", flush=True)
        except Exception:
            break
    logger.warning("WS Client subprocess has exited")


def _stop_ws_client():
    """Terminate the WS client subprocess."""
    global _ws_process
    if _ws_process:
        logger.info("Stopping WS Client subprocess...")
        try:
            _ws_process.terminate()
            _ws_process.wait(timeout=5)
        except Exception:
            try:
                _ws_process.kill()
                _ws_process.wait(timeout=3)
            except Exception:
                pass
        _ws_process = None
        logger.info("WS Client stopped")


# =========================================================================
# Entry Point
# =========================================================================

def main():
    parser = argparse.ArgumentParser(description="EOS Feishu Bot Server")
    parser.add_argument("--port", type=int, default=None,
                        help="Listen port (default: 8888 or PORT env)")
    parser.add_argument("--no-ws", action="store_true",
                        help="Skip starting WS client subprocess")
    args = parser.parse_args()

    port = args.port or int(os.environ.get("PORT", "8888"))
    token_status = "configured" if FEISHU_APP_ID and FEISHU_APP_SECRET else "not configured"
    webhook_status = "configured" if FEISHU_WEBHOOK_URL else "not configured"

    # Start WS client subprocess (long-connection mode)
    if not args.no_ws:
        _start_ws_client()
        if _ws_process:
            global _ws_monitor_thread
            _ws_monitor_thread = threading.Thread(target=_monitor_ws_client, daemon=True)
            _ws_monitor_thread.start()
            logger.info(f"WS Worker PID: {_ws_process.pid}")
        else:
            logger.warning("WS Worker did not start")

    server = ThreadingHTTPServer(("0.0.0.0", port), BotHandler)

    start_msg = (f"EOS Bot Server v4.2 running on port {port} | "
                 f"Token: {token_status} | Webhook: {webhook_status}")
    logger.info(f"{SERVER_START} {start_msg}")
    print(start_msg, flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info(f"{SERVER_START} Server shutting down (SIGINT)")
        server.server_close()
        _stop_ws_client()
        print("\nServer stopped.", flush=True)


if __name__ == "__main__":
    main()
