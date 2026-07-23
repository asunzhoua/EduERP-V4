"""
heartbeat_check.py — EOS 系统健康检测脚本

v2.0 变更：
- 新增 RUNNING Mission 主动反馈
- 新增 Evidence 新增检测
- 通知从 Webhook 切到飞书 API（龙虾 App）

v2.1 变更（Batch 5.2）：
- 新增 Mission 停滞检测（三指标综合判定：Commit / Evidence / State file）
- 新增深度恢复机制（CC 进程检查 + 错误日志扫描 + Recovery Report）

v2.2 变更（Batch 5.1）：
- 新增 Mission 完成检测（check_mission_completion）
- 新增 Decision Gate 检测（check_decision_gates）
- 新增长时间等待检测（check_long_wait）

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
DEEP_RECOVERY_MINUTES = 60  # 深度恢复阈值
CC_PROCESS_NAMES = ["claude", "node"]  # CC 相关进程名
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
# Check 5: Mission 停滞检测（三指标综合判定）
# ──────────────────────────────────────────────


def check_mission_stall() -> tuple[str, str, bool]:
    """Check 5: Mission 停滞检测 — 三指标综合判定。

    检查三个指标的最后活动时间，取最晚的一个：
    1. Last Commit (git log)
    2. Last Evidence (evidence 目录最新文件 mtime)
    3. Mission State (mission.state 文件 mtime)

    超过 STALE_MINUTES → WARNING
    超过 DEEP_RECOVERY_MINUTES → ERROR + 深度恢复报告
    """
    if not os.path.isdir(MISSIONS_DIR):
        return ("OK", ".missions 目录不存在", False)

    now = time.time()
    stall_reports: list[str] = []
    deep_recovery_needed: list[str] = []

    # 获取 Last Commit 时间
    last_commit_time = _get_last_commit_time()

    # 扫描所有 RUNNING mission
    state_files = glob.glob(
        os.path.join(MISSIONS_DIR, "*", "mission.state"),
        recursive=True,
    )

    for sf in state_files:
        try:
            with open(sf, "r", encoding="utf-8") as f:
                state = json.load(f)
        except Exception:
            try:
                with open(sf, "r", encoding="gbk") as f:
                    state = json.load(f)
            except Exception:
                continue

        status = state.get("status", "UNKNOWN")
        if status != "RUNNING":
            continue

        mission_id = state.get("mission_id", os.path.basename(os.path.dirname(sf)))

        # 三指标检测
        indicators = {}

        # 指标 1: Last Commit
        if last_commit_time > 0:
            indicators["commit"] = last_commit_time

        # 指标 2: Last Evidence
        evidence_dir = os.path.join(os.path.dirname(sf), "evidence")
        evidence_time = _get_latest_file_time(evidence_dir)
        if evidence_time > 0:
            indicators["evidence"] = evidence_time

        # 指标 3: Mission State file mtime
        try:
            indicators["state_file"] = os.path.getmtime(sf)
        except OSError:
            pass

        if not indicators:
            stall_reports.append(f"{mission_id}: 无活动时间指标")
            continue

        # 取最晚时间
        latest_activity = max(indicators.values())
        stall_minutes = (now - latest_activity) / 60

        if stall_minutes > DEEP_RECOVERY_MINUTES:
            deep_recovery_needed.append(mission_id)
            # 执行深度恢复诊断
            cc_alive = _check_cc_process()
            last_error = _scan_error_logs()
            report = (
                f"{mission_id}: STALLED {int(stall_minutes)}min "
                f"(CC: {'Alive' if cc_alive else 'Dead'}, "
                f"Error: {last_error})"
            )
            stall_reports.append(report)
            # 创建 MISSION_STALL 提醒（通过后端 API）
            create_mission_stall_reminder(mission_id, stall_minutes)
        elif stall_minutes > STALE_MINUTES:
            stall_reports.append(f"{mission_id}: STALE {int(stall_minutes)}min")
            # 创建 MISSION_STALL 提醒（通过后端 API）
            create_mission_stall_reminder(mission_id, stall_minutes)

    if deep_recovery_needed:
        detail = "; ".join(stall_reports)
        check_id = "deep_recovery"
        if should_notify(check_id, detail):
            msg = "[EOS 深度恢复报告]\n" + "\n".join(stall_reports)
            notified = send_feishu_text(msg)
            if notified:
                mark_notified(check_id, detail)
        return ("ERROR", detail, True)

    if stall_reports:
        detail = "; ".join(stall_reports)
        check_id = "mission_stall"
        if should_notify(check_id, detail):
            notified = send_notification("WARNING", detail, title="Mission 停滞告警")
            if notified:
                mark_notified(check_id, detail)
        return ("WARNING", detail, True)

    return ("OK", "无 RUNNING Mission 停滞", False)


def _get_last_commit_time() -> float:
    """获取仓库最新 commit 的 Unix 时间戳。"""
    repo_dir = os.path.dirname(BASE_DIR)  # backend 的上级是项目根
    # 也尝试从 BASE_DIR 直接作为 repo
    for d in [BASE_DIR, repo_dir, os.path.join(BASE_DIR, "..")]:
        try:
            result = subprocess.run(
                ["git", "log", "-1", "--format=%ct"],
                capture_output=True, text=True, timeout=10,
                cwd=d,
            )
            if result.returncode == 0 and result.stdout.strip():
                return float(result.stdout.strip())
        except Exception:
            continue
    return 0.0


def _get_latest_file_time(directory: str) -> float:
    """获取目录下最新文件的 mtime。"""
    if not os.path.isdir(directory):
        return 0.0
    latest = 0.0
    try:
        for f in os.listdir(directory):
            fpath = os.path.join(directory, f)
            if os.path.isfile(fpath):
                try:
                    mt = os.path.getmtime(fpath)
                    if mt > latest:
                        latest = mt
                except OSError:
                    pass
    except OSError:
        pass
    return latest


def _check_cc_process() -> bool:
    """检查 CC (Claude Code) 进程是否存活。"""
    for proc_name in CC_PROCESS_NAMES:
        try:
            if sys.platform == "win32":
                result = subprocess.run(
                    ["tasklist", "/FI", f"IMAGENAME eq {proc_name}*"],
                    capture_output=True, text=True, timeout=10,
                )
                if proc_name.lower() in result.stdout.lower():
                    return True
            else:
                result = subprocess.run(
                    ["pgrep", "-f", proc_name],
                    capture_output=True, text=True, timeout=10,
                )
                if result.returncode == 0:
                    return True
        except Exception:
            pass
    return False


def _scan_error_logs() -> str:
    """扫描最近的错误日志。"""
    today = _today()
    log_file = os.path.join(LOG_DIR, f"{today}.log")
    if not os.path.exists(log_file):
        return "无"

    try:
        with open(log_file, "r", encoding="utf-8") as f:
            lines = f.readlines()

        # 从末尾往前找最近 50 行中的 ERROR/FATAL
        recent_lines = lines[-50:] if len(lines) > 50 else lines
        errors = [l.strip() for l in recent_lines if "ERROR" in l or "FATAL" in l]

        if errors:
            # 返回最后一条错误
            last_err = errors[-1]
            return last_err[:100]  # 截断
        return "无"
    except Exception:
        return "无"


# ──────────────────────────────────────────────
# Mission 停滞提醒（通过后端 API 创建 Reminder）
# ──────────────────────────────────────────────

BACKEND_API_BASE = os.environ.get("EDUERP_API_URL", "http://localhost:3000")
ADMIN_USER_ID = int(os.environ.get("ADMIN_USER_ID", "1"))  # Admin user ID for reminders


def create_mission_stall_reminder(mission_id: str, stall_minutes: float) -> bool:
    """通过后端 API 创建 MISSION_STALL 类型提醒。

    当 Heartbeat 检测到 Mission 停滞时调用。
    返回 True 表示创建成功，False 表示失败。
    """
    url = f"{BACKEND_API_BASE}/api/v1/reminders"
    payload = {
        "type": "MISSION_STALL",
        "title": f"Mission 停滞告警：{mission_id}",
        "content": (
            f"Mission {mission_id} 已停滞 {stall_minutes:.0f} 分钟（超过 {STALE_MINUTES} 分钟阈值）。"
            f"请检查 CC 进程状态、网络连通性、任务队列。"
        ),
        "targetUserId": ADMIN_USER_ID,
        "targetType": "ADMIN",
        "relatedEntityType": "Mission",
    }

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode("utf-8"))
        ok = data.get("success", False) or data.get("code") == 0
        if ok:
            print(f"  [REMINDER] MISSION_STALL 提醒已创建: {mission_id}")
        else:
            print(f"  [REMINDER] API 返回失败: {data}", file=sys.stderr)
        return ok
    except urllib.error.URLError as e:
        # 后端可能未启动，不视为严重错误
        print(f"  [REMINDER] 后端 API 不可达: {e}", file=sys.stderr)
        return False
    except Exception as e:
        safe = str(e).encode("ascii", errors="replace").decode("ascii")
        print(f"  [REMINDER] 创建失败: {safe}", file=sys.stderr)
        return False


# ──────────────────────────────────────────────
# Check 6: Mission 完成检测
# ──────────────────────────────────────────────


def check_mission_completion() -> tuple[str, str, bool]:
    """Check 6: Mission 完成检测。

    扫描 .missions/ 下所有 Mission：
    - 读取 .md 文件，检查是否所有 Phase 都是 COMPLETED
    - 读取 mission.state，检查 status 是否为 COMPLETED
    - 新完成的 Mission（上次非 COMPLETED，本次 COMPLETED）→ 通知
    """
    if not os.path.isdir(MISSIONS_DIR):
        return ("OK", ".missions 目录不存在", False)

    now = time.time()
    prev_mission_states = _load_state(MISSION_STATE_FILE)
    prev_status_by_id = prev_mission_states.get("status_by_id", {})
    newly_completed: list[str] = []

    # 扫描所有 mission.state 文件
    state_files = glob.glob(
        os.path.join(MISSIONS_DIR, "*", "mission.state"),
        recursive=True,
    )

    for sf in state_files:
        try:
            with open(sf, "r", encoding="utf-8") as f:
                state = json.load(f)
        except Exception:
            try:
                with open(sf, "r", encoding="gbk") as f:
                    state = json.load(f)
            except Exception:
                continue

        mission_id = state.get("mission_id", os.path.basename(os.path.dirname(sf)))
        current_status = state.get("status", "UNKNOWN")
        prev_status = prev_status_by_id.get(mission_id, "UNKNOWN")

        # 检测新完成：上次不是 COMPLETED，本次是 COMPLETED
        if current_status == "COMPLETED" and prev_status != "COMPLETED":
            newly_completed.append(mission_id)

    # 同时扫描 .md 文件（兜底：没有 mission.state 的 Mission）
    md_files = glob.glob(
        os.path.join(MISSIONS_DIR, "*.md"),
        recursive=False,
    )

    for md_file in md_files:
        basename = os.path.basename(md_file)
        mission_id = basename.replace(".md", "")

        # 跳过非 Mission 文件
        if mission_id in ("README", "INDEX", "TEMPLATE"):
            continue

        try:
            with open(md_file, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            try:
                with open(md_file, "r", encoding="gbk") as f:
                    content = f.read()
            except Exception:
                continue

        # 检查是否有 **Status**: COMPLETED
        if "**Status**" in content and "COMPLETED" in content:
            prev_status = prev_status_by_id.get(mission_id, "UNKNOWN")
            # 检查是否所有 Phase 都标记为 ✅ COMPLETED
            has_in_progress = "🔄 IN PROGRESS" in content or "IN PROGRESS" in content
            has_pending = "⏳ PENDING" in content or "PENDING" in content

            if not has_in_progress and not has_pending:
                if prev_status != "COMPLETED":
                    if mission_id not in newly_completed:
                        newly_completed.append(mission_id)

    if newly_completed:
        detail = f"Mission 新完成: {', '.join(newly_completed)}"
        check_id = "mission_completed"
        if should_notify(check_id, detail):
            msg = (
                f"[EOS] Mission 完成通知\n"
                f"已完成: {', '.join(newly_completed)}\n"
                f"时间: {_now()}\n"
                f"下一步: 归档 / 等待新 Mission"
            )
            notified = send_feishu_text(msg)
            if notified:
                mark_notified(check_id, detail)
        else:
            notified = False
        return ("INFO", detail, notified)

    return ("OK", "无新完成的 Mission", False)


# ──────────────────────────────────────────────
# Check 7: Decision Gate 检测
# ──────────────────────────────────────────────


def check_decision_gates() -> tuple[str, str, bool]:
    """Check 7: Decision Gate 检测。

    扫描 RUNNING 状态的 Mission .md 文件：
    - 搜索 "Decision Gate" 相关段落
    - 提取待决策项列表
    - 有待决策项 → DECISION_GATE_PENDING
    """
    if not os.path.isdir(MISSIONS_DIR):
        return ("OK", ".missions 目录不存在", False)

    all_gates: list[dict] = []

    # 扫描所有 .md 文件
    md_files = glob.glob(
        os.path.join(MISSIONS_DIR, "*.md"),
        recursive=False,
    )

    for md_file in md_files:
        basename = os.path.basename(md_file)
        mission_id = basename.replace(".md", "")

        # 跳过非 Mission 文件
        if mission_id in ("README", "INDEX", "TEMPLATE"):
            continue

        try:
            with open(md_file, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            try:
                with open(md_file, "r", encoding="gbk") as f:
                    content = f.read()
            except Exception:
                continue

        # 检查 Mission 是否为 RUNNING 状态
        is_running = "RUNNING" in content or "IN PROGRESS" in content
        if not is_running:
            # 也检查 mission.state
            state_file = os.path.join(MISSIONS_DIR, mission_id, "mission.state")
            if os.path.exists(state_file):
                try:
                    with open(state_file, "r", encoding="utf-8") as f:
                        state = json.load(f)
                    if state.get("status") not in ("RUNNING", "WAITING_DECISION"):
                        continue
                except Exception:
                    pass

        # 搜索 Decision Gate 段落
        if "Decision Gate" not in content and "decision gate" not in content.lower():
            continue

        # 提取 Decision Gate 下的列表项
        lines = content.split("\n")
        gate_items: list[str] = []
        in_gate_section = False

        for line in lines:
            stripped = line.strip()
            # 检测 Decision Gate 标题
            if "Decision Gate" in stripped or "decision gate" in stripped.lower():
                in_gate_section = True
                continue

            # 如果在 Decision Gate 段落中
            if in_gate_section:
                # 遇到新的 ## 标题 → 段落结束
                if stripped.startswith("## ") and "Decision Gate" not in stripped:
                    in_gate_section = False
                    continue

                # 提取列表项（数字开头或 bullet 开头）
                if stripped and (stripped[0].isdigit() or stripped.startswith("-") or stripped.startswith("*")):
                    # 清理标记
                    item = stripped.lstrip("0123456789.-*) ").strip()
                    if item:
                        gate_items.append(item)

        if gate_items:
            all_gates.append({
                "mission_id": mission_id,
                "items": gate_items,
                "count": len(gate_items),
            })

    if all_gates:
        parts = []
        for gate in all_gates:
            parts.append(f"  {gate['mission_id']}: {gate['count']} 项待决策")
            for i, item in enumerate(gate["items"][:5], 1):  # 最多显示 5 项
                parts.append(f"    {i}. {item}")
            if gate["count"] > 5:
                parts.append(f"    ... 还有 {gate['count'] - 5} 项")

        detail = f"Decision Gate 待决策: {len(all_gates)} 个 Mission\n" + "\n".join(parts)
        check_id = "decision_gate"
        # 冷却 1 小时，避免重复通知
        if should_notify(check_id, detail, cooldown=3600):
            msg = (
                f"[EOS] Decision Gate 待决策\n"
                f"Mission: {', '.join(g['mission_id'] for g in all_gates)}\n"
                f"待决策项: {sum(g['count'] for g in all_gates)} 项\n"
                f"下一步: 等待 Owner 决策"
            )
            notified = send_feishu_text(msg)
            if notified:
                mark_notified(check_id, detail)
        else:
            notified = False
        return ("WARNING", detail, notified)

    return ("OK", "无待处理的 Decision Gate", False)


# ──────────────────────────────────────────────
# Check 8: 长时间等待检测
# ──────────────────────────────────────────────


def check_long_wait() -> tuple[str, str, bool]:
    """Check 8: 长时间等待检测。

    检查 WAITING_DECISION 状态的 Mission：
    - 读取 mission.state 中 updated_at
    - 如果 status = WAITING_DECISION 且等待 > 1 小时 → LONG_WAIT_WARNING
    """
    if not os.path.isdir(MISSIONS_DIR):
        return ("OK", ".missions 目录不存在", False)

    now = time.time()
    long_waits: list[dict] = []

    # 扫描所有 mission.state 文件
    state_files = glob.glob(
        os.path.join(MISSIONS_DIR, "*", "mission.state"),
        recursive=True,
    )

    for sf in state_files:
        try:
            with open(sf, "r", encoding="utf-8") as f:
                state = json.load(f)
        except Exception:
            try:
                with open(sf, "r", encoding="gbk") as f:
                    state = json.load(f)
            except Exception:
                continue

        status = state.get("status", "UNKNOWN")
        if status != "WAITING_DECISION":
            continue

        mission_id = state.get("mission_id", os.path.basename(os.path.dirname(sf)))
        updated_at_str = state.get("updated_at", "")

        # 解析 updated_at 时间
        wait_minutes = 0.0
        if updated_at_str:
            try:
                # 尝试 ISO 格式
                updated_dt = datetime.datetime.fromisoformat(
                    updated_at_str.replace("Z", "+00:00")
                )
                updated_ts = updated_dt.timestamp()
                wait_minutes = (now - updated_ts) / 60
            except (ValueError, TypeError):
                # 尝试 Unix 时间戳
                try:
                    updated_ts = float(updated_at_str)
                    wait_minutes = (now - updated_ts) / 60
                except (ValueError, TypeError):
                    # 兜底：使用文件 mtime
                    try:
                        updated_ts = os.path.getmtime(sf)
                        wait_minutes = (now - updated_ts) / 60
                    except OSError:
                        wait_minutes = 0.0
        else:
            # 没有 updated_at，使用文件 mtime
            try:
                updated_ts = os.path.getmtime(sf)
                wait_minutes = (now - updated_ts) / 60
            except OSError:
                wait_minutes = 0.0

        if wait_minutes > 60:  # 超过 1 小时
            hours = int(wait_minutes // 60)
            mins = int(wait_minutes % 60)
            long_waits.append({
                "mission_id": mission_id,
                "hours": hours,
                "minutes": mins,
                "total_minutes": wait_minutes,
            })

    if long_waits:
        parts = []
        for lw in long_waits:
            parts.append(f"  {lw['mission_id']}: 等待 {lw['hours']} 小时 {lw['minutes']} 分钟")

        detail = f"长时间等待决策: {len(long_waits)} 个 Mission\n" + "\n".join(parts)
        check_id = "long_wait"
        # 冷却 1 小时
        if should_notify(check_id, detail, cooldown=3600):
            msg = (
                f"[EOS] 长时间等待提醒\n"
                f"等待决策: {', '.join(lw['mission_id'] for lw in long_waits)}\n"
                f"最长等待: {max(lw['hours'] for lw in long_waits)} 小时 "
                f"{max(lw['minutes'] for lw in long_waits)} 分钟\n"
                f"下一步: 请 Owner 尽快决策"
            )
            notified = send_feishu_text(msg)
            if notified:
                mark_notified(check_id, detail)
        else:
            notified = False
        return ("WARNING", detail, notified)

    return ("OK", "无长时间等待的 Mission", False)


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────


def main() -> int:
    """执行所有检测项并输出日志。"""
    # 清除代理
    for k in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"]:
        os.environ.pop(k, None)

    print("=" * 60)
    print(f"  EOS Heartbeat Check v2.2")
    print(f"  Time:   {_now()}")
    print(f"  PID:    {os.getpid()}")
    print(f"  CWD:    {BASE_DIR}")
    print("=" * 60)

    checks = [
        ("Feishu Board", check_feishu_board),
        ("Runtime State", check_runtime_state),
        ("Evidence", check_evidence),
        ("Liveness", check_liveness),
        ("Mission Stall", check_mission_stall),
        ("Mission Completion", check_mission_completion),
        ("Decision Gate", check_decision_gates),
        ("Long Wait", check_long_wait),
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
