"""
heartbeat_check.py — EOS 系统健康检测脚本

v2.0 变更：
- 新增 RUNNING Mission 主动反馈
- 新增 Evidence 新增检测
- 通知从 Webhook 切到飞书 API（龙虾 App）

由 Windows Task Scheduler 每 15 分钟调用一次。
"""

from __future__ import annotations

import datetime
import glob
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from typing import Any, Optional

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(BASE_DIR, "tools")
LOG_DIR = os.path.join(BASE_DIR, "logs", "heartbeat")

MISSION_NOTIFY_SCRIPT = os.path.join(TOOLS_DIR, "mission-notify.py")

NOTIFY_STATE_FILE = os.path.join(TOOLS_DIR, "notifications.state")
EVIDENCE_STATE_FILE = os.path.join(TOOLS_DIR, "evidence.state")  # 新增：证据文件跟踪

# Mission 状态跟踪文件（记录每个 Mission 上次扫描时的状态）
MISSION_STATE_FILE = os.path.join(TOOLS_DIR, "mission-status.state")

USERPROFILE = os.environ.get("USERPROFILE", "C:\\Users\\sunz")
MISSIONS_DIR = os.path.join(
    USERPROFILE, ".qwenpaw", "workspaces", "default", ".missions"
)

# 龙虾 App 凭证（保证通知通道可用）
LOBSTER_APP_ID = "your-feishu-app-id"
LOBSTER_APP_SECRET = "your-feishu-app-secret"
CHAT_ID = "oc_6e919481fd56e839c5c8e9d1ba71b25b"

# 飞书 Board 凭证（从环境变量读，跟龙虾 App 不同）
FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "").strip()
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "").strip()

MISSION_BOARD_TOKEN = os.environ.get("MISSION_BOARD_TOKEN", "").strip()
if not MISSION_BOARD_TOKEN:
    report_path = os.path.join(TOOLS_DIR, "bootstrap-report.json")
    if os.path.exists(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                report = json.load(f)
            MISSION_BOARD_TOKEN = (
                report.get("resources", {}).get("mission_board_token", "")
            )
        except Exception:
            pass

SHEET_ID = "40e76d"

STALE_MINUTES = 30
IDLE_HOURS = 4
NOTIFY_COOLDOWN = 900  # 15 分钟冷却（匹配心跳间隔）


# ──────────────────────────────────────────────
# Feishu API 通知（直接 HTTP，不依赖 Webhook）
# ──────────────────────────────────────────────


def _get_lobster_token() -> str:
    """获取飞书 tenant_access_token（使用龙虾 App 凭证，仅用于通知）。"""
    body = json.dumps({
        "app_id": LOBSTER_APP_ID,
        "app_secret": LOBSTER_APP_SECRET,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("tenant_access_token", "")
    except Exception as e:
        safe = str(e).encode("ascii", errors="replace").decode("ascii")
        print(f"  [ERR] 获取飞书 token 失败: {safe}", file=sys.stderr)
        return ""


def _get_board_token() -> str:
    """获取飞书 token（使用环境变量 FEISHU_APP_ID，仅用于 Board 查询）。"""
    if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
        return ""
    body = json.dumps({
        "app_id": FEISHU_APP_ID,
        "app_secret": FEISHU_APP_SECRET,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("tenant_access_token", "")
    except Exception as e:
        safe = str(e).encode("ascii", errors="replace").decode("ascii")
        print(f"  [ERR] 获取 Board token 失败: {safe}", file=sys.stderr)
        return ""


def send_feishu_text(text: str) -> bool:
    """通过飞书 API 发送文本消息到 EOS AI Team 群。"""
    token = _get_lobster_token()
    if not token:
        return False

    body = json.dumps({
        "receive_id": CHAT_ID,
        "msg_type": "text",
        "content": json.dumps({"text": text}, ensure_ascii=False),
    }, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode("utf-8"))
        ok = data.get("code") == 0
        if ok:
            preview = text.replace("\n", " ")[:60]
            print(f"  [NOTIFY] 消息发送成功: {preview}")
        else:
            print(f"  [NOTIFY] 飞书返回: {data.get('msg', '')}", file=sys.stderr)
        return ok
    except Exception as e:
        safe = str(e).encode("ascii", errors="replace").decode("ascii")
        print(f"  [NOTIFY] 发送失败: {safe}", file=sys.stderr)
        return False


def send_notification(severity: str, message: str, title: str | None = None) -> bool:
    """发送通知到群（替换原有的 feishu-notify.py Webhook 方式）。

    现在直接使用飞书 API（龙虾 App）。
    """
    tag = {"INFO": "[INFO]", "WARNING": "[WARNING]", "ERROR": "[ERROR]"}.get(severity, "[NOTE]")
    parts = [f"{tag}"]
    if title:
        parts.append(f"\n{title}")
    parts.append(f"\n{message}")
    text = "".join(parts)
    return send_feishu_text(text)


# ──────────────────────────────────────────────
# Logging helpers
# ──────────────────────────────────────────────


def _now() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _today() -> str:
    return datetime.date.today().isoformat()


def format_log(check_name: str, status: str, detail: str, notified: bool = False) -> str:
    return f"{_now()} | {check_name} | {status} | {detail} | {'notified' if notified else 'silent'}"


def write_log(lines: list[str]) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = os.path.join(LOG_DIR, f"{_today()}.log")
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            for line in lines:
                f.write(line + "\n")
        print(f"  [LOG] Written to {log_file}")
    except OSError as e:
        print(f"  [ERR] Cannot write log: {e}", file=sys.stderr)


# ──────────────────────────────────────────────
# Notification dedup
# ──────────────────────────────────────────────


def _load_state(filepath: str) -> dict[str, Any]:
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_state(filepath: str, state: dict[str, Any]) -> None:
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except OSError as e:
        print(f"  [WARN] Cannot write state: {e}", file=sys.stderr)


def should_notify(check_id: str, current_detail: str) -> bool:
    state = _load_state(NOTIFY_STATE_FILE)
    last = state.get(check_id)
    if last is None:
        return True
    if last.get("detail") == current_detail:
        elapsed = time.time() - last.get("timestamp", 0)
        if elapsed < NOTIFY_COOLDOWN:
            print(f"  [DEDUP] Skipping {check_id}: sent {elapsed:.0f}s ago")
            return False
    return True


def mark_notified(check_id: str, detail: str) -> None:
    state = _load_state(NOTIFY_STATE_FILE)
    state[check_id] = {
        "timestamp": time.time(),
        "detail": detail,
    }
    _save_state(NOTIFY_STATE_FILE, state)


# ──────────────────────────────────────────────
# Check 1: Feishu Board
# ──────────────────────────────────────────────


def check_feishu_board() -> tuple[str, str, bool]:
    """检查飞书 Board 待处理任务。"""
    token = _get_board_token()
    if not token:
        return ("SKIP", "飞书 API 凭证未配置", False)

    import requests

    url = (
        f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/"
        f"{MISSION_BOARD_TOKEN}/values/{SHEET_ID}!A2:M200"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        data = resp.json()

        if data.get("code") != 0:
            return ("ERROR", f"飞书 API 错误: {data.get('msg', 'unknown')}", False)

        values = data.get("data", {}).get("valueRange", {}).get("values", [])
        created_count = 0
        for row in values:
            if len(row) >= 4 and row[3] == "CREATED":
                created_count += 1

        if created_count > 0:
            detail = f"待处理 Mission: {created_count} 个"
            check_id = "feishu_created"
            if should_notify(check_id, detail):
                notified = send_notification("WARNING", detail, title="待处理任务提醒")
                if notified:
                    mark_notified(check_id, detail)
            else:
                notified = False
            return ("WARNING", detail, notified)
        else:
            return ("OK", "Created missions: 0", False)

    except requests.RequestException as e:
        return ("ERROR", f"飞书 API 请求失败: {e}", False)
    except Exception as e:
        return ("ERROR", f"Feishu board exception: {e}", False)


# ──────────────────────────────────────────────
# Check 2: Runtime State（原逻辑 + 新增 RUNNING 主动反馈）
# ──────────────────────────────────────────────


def check_runtime_state() -> tuple[str, str, bool]:
    """扫描 .missions/ 检查状态 + 主动反馈 RUNNING Mission。"""
    if not os.path.isdir(MISSIONS_DIR):
        return ("OK", ".missions 目录不存在（干净环境）", False)

    now = time.time()
    anomalies: list[str] = []
    running_found = False

    # 读取上次保存的 Mission 状态映射
    prev_mission_states = _load_state(MISSION_STATE_FILE)
    prev_status_by_id = prev_mission_states.get("status_by_id", {})
    # 本次扫描的状态
    current_status_by_id = {}

    try:
        state_files = glob.glob(
            os.path.join(MISSIONS_DIR, "*", "mission.state"),
            recursive=True,
        )
    except Exception as e:
        return ("ERROR", f"扫描 .missions 失败: {e}", False)

    if not state_files:
        return ("OK", "无 mission.state 文件（无活跃任务）", False)

    for sf in state_files:
        try:
            with open(sf, "r", encoding="utf-8") as f:
                state = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            # 容错：尝试 GBK 编码（Windows cmd echo 写入的场景）
            try:
                with open(sf, "r", encoding="gbk") as f:
                    state = json.load(f)
            except (json.JSONDecodeError, OSError) as e2:
                mission_dir = os.path.basename(os.path.dirname(sf))
                anomalies.append(f"{mission_dir}: 无法读取状态 ({e2})")
                continue
        except OSError as e:
            mission_dir = os.path.basename(os.path.dirname(sf))
            anomalies.append(f"{mission_dir}: 无法读取状态 ({e})")
            continue

        mission_id = state.get("mission_id", os.path.basename(os.path.dirname(sf)))
        status = state.get("status", "UNKNOWN")
        # 记录当前状态用于后续迁移检测
        current_status_by_id[mission_id] = status
        updated_str = state.get("updated_at", "")
        desc = state.get("name", mission_id)

        # ── 新增：RUNNING 主动反馈 ──
        if status == "RUNNING":
            running_found = True
            detail = f"Mission {mission_id}: 执行中"
            check_id = f"running_{mission_id}"
            if should_notify(check_id, detail):
                msg = (
                    f"[EOS] Mission 执行中\n"
                    f"Mission: {mission_id}\n"
                    f"描述: {desc}\n"
                    f"执行器: Claude Code\n"
                    f"状态: RUNNING"
                )
                notified = send_feishu_text(msg)
                if notified:
                    mark_notified(check_id, detail)
                anomalies.append(f"{mission_id}: RUNNING（已通知）")
            else:
                anomalies.append(f"{mission_id}: RUNNING（冷却中）")

        # ── 原逻辑：STALE 检测 ──
        if status == "RUNNING" and updated_str:
            try:
                updated_dt = datetime.datetime.fromisoformat(updated_str)
                age_seconds = (datetime.datetime.now() - updated_dt).total_seconds()
                if age_seconds > STALE_MINUTES * 60:
                    anomalies.append(f"{mission_id}: STALE（{int(age_seconds//60)}分无更新）")
            except ValueError:
                pass

        # ── 原逻辑：异常状态 ──
        if status in ("PAUSED", "FAILED"):
            anomalies.append(f"{mission_id}: {status}")

    # ── 新增: 状态迁移检测 ──
    # 检测 FAILED（新出现, 非持久状态）
    for mid, curr_status in current_status_by_id.items():
        prev_status = prev_status_by_id.get(mid)
        if curr_status == "FAILED" and prev_status != "FAILED":
            detail = f"Mission {mid}: FAILED"
            check_id = f"failed_{mid}"
            if should_notify(check_id, detail):
                msg = (
                    f"[EOS] Mission 失败\n"
                    f"Mission: {mid}\n"
                    f"状态: FAILED\n"
                    f"需要人工介入处理"
                )
                notified = send_feishu_text(msg)
                if notified:
                    mark_notified(check_id, detail)

        # 检测 COMPLETED（新闭环）
        if curr_status == "COMPLETED" and prev_status != "COMPLETED":
            detail = f"Mission {mid}: COMPLETED"
            check_id = f"completed_{mid}"
            if should_notify(check_id, detail):
                msg = (
                    f"[EOS] Mission 完成\n"
                    f"Mission: {mid}\n"
                    f"状态: COMPLETED\n"
                    f"审核已通过, 转入完成归档"
                )
                notified = send_feishu_text(msg)
                if notified:
                    mark_notified(check_id, detail)

    # 保存当前状态供下次对比
    _save_state(MISSION_STATE_FILE, {
        "status_by_id": current_status_by_id,
        "updated": time.time(),
    })

    if anomalies:
        detail = "; ".join(anomalies)
        # 异常才用 send_notification
        check_id = "runtime_anomalies"
        anomaly_detail = "; ".join(
            a for a in anomalies if "RUNNING" not in a or "STALE" in a
        )
        if anomaly_detail:
            if should_notify(check_id, anomaly_detail):
                notified = send_notification("WARNING", anomaly_detail, title="Mission 状态异常")
                if notified:
                    mark_notified(check_id, anomaly_detail)
            else:
                pass
        return ("WARNING", detail, True)
    else:
        return ("OK", "所有 Mission 状态正常", False)


# ──────────────────────────────────────────────
# Check 3: 新增 — Evidence 文件检测
# ──────────────────────────────────────────────


def check_evidence() -> tuple[str, str, bool]:
    """检测证据文件新增 → 通知 CC 执行完成。"""
    evidence_dirs = glob.glob(
        os.path.join(MISSIONS_DIR, "*", "evidence"),
        recursive=False,
    )

    # 收集所有 evidence 文件路径 + 修改时间
    current_files: dict[str, float] = {}
    for ed in evidence_dirs:
        for f in glob.glob(os.path.join(ed, "*"), recursive=False):
            if os.path.isfile(f):
                try:
                    current_files[f] = os.path.getmtime(f)
                except OSError:
                    pass

    if not current_files:
        return ("OK", "无 evidence 文件", False)

    # 读取上次记录的状态
    prev_state = _load_state(EVIDENCE_STATE_FILE)
    prev_files = prev_state.get("files", {})

    # 找新增文件（上次没有的）
    new_files = []
    for fpath, mtime in current_files.items():
        if fpath not in prev_files:
            new_files.append(fpath)
        elif prev_files[fpath] < mtime:
            new_files.append(fpath)

    # 保存当前状态
    _save_state(EVIDENCE_STATE_FILE, {"files": current_files, "updated": time.time()})

    if new_files:
        # 提取 Mission ID
        mission_ids = set()
        for fpath in new_files:
            parts = fpath.replace("\\", "/").split("/")
            for i, p in enumerate(parts):
                if p == "evidence":
                    if i >= 1:
                        mission_ids.add(parts[i - 1])

        for mid in mission_ids:
            detail = f"Evidence 新增: {mid}"
            check_id = f"evidence_{mid}"
            if should_notify(check_id, detail):
                msg = (
                    f"[EOS] CC 执行完成\n"
                    f"Mission: {mid}\n"
                    f"状态: 等待龙虾审核\n"
                    f"Evidence 已落地"
                )
                notified = send_feishu_text(msg)
                if notified:
                    mark_notified(check_id, detail)

        detail = f"新增 evidence: {', '.join(mission_ids)}"
        return ("INFO", detail, True)

    return ("OK", "无新增 evidence", False)


# ──────────────────────────────────────────────
# Check 4: Liveness（原逻辑，仅改通知方式）
# ──────────────────────────────────────────────


def check_liveness() -> tuple[str, str, bool]:
    """检查系统最新活动时间。"""
    today = _today()
    log_file = os.path.join(LOG_DIR, f"{today}.log")

    if not os.path.exists(log_file):
        return ("OK", "今日无日志（可能是首次运行）", False)

    try:
        mtime = os.path.getmtime(log_file)
        age_hours = (time.time() - mtime) / 3600

        if age_hours >= IDLE_HOURS:
            detail = f"系统空闲 {age_hours:.1f} 小时（无活动）"
            check_id = "system_idle"
            if should_notify(check_id, detail):
                notified = send_notification("INFO", detail, title="系统空闲提醒")
                if notified:
                    mark_notified(check_id, detail)
            else:
                notified = False
            return ("WARNING", detail, notified)
        else:
            return ("OK", f"上次活动 {age_hours:.1f}h 前", False)

    except OSError as e:
        return ("ERROR", f"读取日志文件失败: {e}", False)


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────


def main() -> int:
    """执行所有检测项并输出日志。"""
    # 清除代理
    for k in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"]:
        os.environ.pop(k, None)

    print("=" * 60)
    print(f"  EOS Heartbeat Check v2.0")
    print(f"  Time:   {_now()}")
    print(f"  PID:    {os.getpid()}")
    print(f"  CWD:    {BASE_DIR}")
    print("=" * 60)

    checks = [
        ("Feishu Board", check_feishu_board),
        ("Runtime State", check_runtime_state),
        ("Evidence", check_evidence),
        ("Liveness", check_liveness),
    ]

    results: list[tuple[str, str, str, bool]] = []

    for idx, (name, func) in enumerate(checks, 1):
        print(f"\n[{idx}/{len(checks)}] {name} Check...")
        try:
            status, detail, notified = func()
        except Exception as e:
            status, detail, notified = ("ERROR", f"崩溃: {e}", False)
        results.append((name, status, detail, notified))
        print(f"  → {status}: {detail}")

    print()
    print("=" * 60)
    counts = {"OK": 0, "WARNING": 0, "ERROR": 0, "SKIP": 0, "INFO": 0}
    has_issue = False
    for _, status, _, _ in results:
        upper = status.upper()
        if upper in counts:
            counts[upper] += 1
        if upper in ("WARNING", "ERROR"):
            has_issue = True

    summary_parts = [f"{k}={v}" for k, v in counts.items() if v > 0]
    summary = ", ".join(summary_parts)
    print(f"  Summary: {summary}")
    if has_issue:
        print("  Overall: !! ISSUES FOUND !!")
    else:
        print("  Overall: ++ ALL OK ++")
    print("=" * 60)

    log_lines: list[str] = []
    log_lines.append(f"# Heartbeat Check v2.0 - {_today()}")
    log_lines.append(f"# Started: {_now()}")
    log_lines.append("")
    for name, status, detail, notified in results:
        log_lines.append(format_log(name, status, detail, notified))
    log_lines.append("")
    log_lines.append(
        format_log("Summary", "ISSUES" if has_issue else "ALL_OK", summary)
    )
    write_log(log_lines)

    return 1 if has_issue else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except BaseException as e:
        safe_msg = str(e).encode("ascii", errors="replace").decode("ascii")
        print(f"FATAL: Unhandled exception: {safe_msg}", file=sys.stderr)
        log_lines = [
            format_log("FATAL", "ERROR", f"Unhandled exception: {safe_msg}"),
        ]
        write_log(log_lines)
        sys.exit(1)
