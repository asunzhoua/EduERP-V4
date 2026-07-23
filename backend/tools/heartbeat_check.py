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

v2.3 变更（Batch 5.4）：
- 新增 Mission 状态同步检测（check_mission_state_sync）
- 当 mission.state 与 .md 文件 Status 不一致时，以 .md 为准自动修复
- 新增 _extract_status_from_md() 辅助函数

v2.4 变更（Batch 5.1 — Heartbeat Statistics）：
- 新增 get_mission_completion_rate() — Mission 完成率统计
- 新增 get_batch_duration() — Batch 耗时统计
- 新增 get_decision_wait_time() — Decision 等待统计
- 新增 check_eos_statistics() — 整合统计检测项

v2.5 变更（Batch 4.1 — Mission Priority & Auto-Sorting）：
- 新增 PRIORITY_ORDER — 优先级排序常量（P0 > P1 > P2 > P3）
- 新增 get_mission_priority() — 获取单个 Mission 优先级
- 新增 sort_missions_by_priority() — 按优先级+创建时间排序所有待执行 Mission
- 新增 get_next_mission() — 获取下一个将执行的 Mission
- 新增 check_mission_priority_queue() — Check 11: 优先级队列展示
- 新增 PROJECT_MISSIONS_DIR — 项目级 .missions 目录（mission.state 物理存储位置）

v2.6 变更（Batch 4.2 — Batch Duration Tracking & Timeout Alerts）：
- 新增 BATCH_TIMEOUT_MINUTES — 超时阈值常量（120 分钟）
- 新增 get_batch_duration_stats() — 跨 Mission Batch 耗时统计报表（avg/max/min/total）
- 新增 check_batch_timeout() — 独立超时告警检测函数
- 新增 record_batch_start() — 记录 Batch 开始时间到 mission.state
- 新增 record_batch_end() — 记录 Batch 结束时间 + 计算耗时
- 新增 check_batch_duration_statistics() — Check 12: 耗时统计报表
- 增强 get_batch_duration() — 支持 batch_completed_at / batch_duration_minutes
- 增强 check_eos_statistics() — 集成耗时统计报表输出

v2.7 变更（Batch 4.3 — Automatic Daily Report Generation）：
- 新增 DAILY_REPORTS_DIR — 日报输出目录常量
- 新增 collect_daily_completed() — 收集指定日期完成的 Mission/Task
- 新增 get_daily_commits() — 获取指定日期的 git commits
- 新增 get_daily_evidence() — 获取指定日期新增的 Evidence 文件
- 新增 get_test_status() — 获取当前测试状态
- 新增 get_build_status() — 获取当前构建状态
- 新增 generate_daily_report() — 生成日报并写入文件
- 新增 --daily-report 命令行参数 — 支持生成今日/指定日期日报

v2.8 变更（Batch 4.4 — Evidence Auto-Classification & Indexing）：
- 新增 EVIDENCE_INDEX_FILE — Evidence 索引文件路径常量
- 新增 EVIDENCE_TYPE_KEYWORDS — 分类关键词映射常量
- 新增 classify_evidence(evidence_file) — 根据 Evidence 内容自动分类
- 新增 generate_evidence_index() — 生成 Evidence 索引文件（.missions/EVIDENCE-INDEX.md）
- 新增 get_evidence_statistics() — 获取 Evidence 统计（总量/类型/Mission/近7天）
- 新增 --evidence-index 命令行参数 — 生成 Evidence 索引
- 新增 --evidence-stats 命令行参数 — 输出 Evidence 统计

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

# 项目级 .missions 目录（mission.state 物理存储位置）
# BASE_DIR = backend/, 项目根 = backend/../, .missions 在项目根下
PROJECT_MISSIONS_DIR = os.path.join(os.path.dirname(BASE_DIR), ".missions")

# Mission 优先级定义（P0 最高，P3 最低）
PRIORITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
PRIORITY_LABELS = {
    "P0": "紧急（系统故障/安全漏洞）",
    "P1": "高（核心功能阻塞）",
    "P2": "中（功能完善）",
    "P3": "低（优化改进）",
}

# Batch 超时阈值（分钟）— Batch 4.2 新增
BATCH_TIMEOUT_MINUTES = 120  # 2 小时

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
                # 统一使用 offset-naive（去除时区信息）
                if updated_dt.tzinfo is not None:
                    updated_dt = updated_dt.replace(tzinfo=None)
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
        if should_notify(check_id, detail):
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
        if should_notify(check_id, detail):
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
# Check 9: Mission 状态同步（mission.state ↔ .md）
# ──────────────────────────────────────────────


def _extract_status_from_md(md_path: str) -> Optional[str]:
    """从 .md 文件头部提取 **Status** 字段值。

    支持格式: **Status**: RUNNING / COMPLETED / FAILED / PAUSED / WAITING_DECISION
    返回 None 表示未找到或无法解析。
    """
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            # 只读前 20 行，Status 通常在文件头部
            for line in f:
                if "**Status**" in line:
                    # 提取冒号后的值
                    parts = line.split(":", 1)
                    if len(parts) == 2:
                        status = parts[1].strip()
                        # 清理可能的 Markdown 格式残留
                        status = status.strip("*").strip()
                        if status:
                            return status
                    break
                # 超过 20 行还没找到就放弃
                if f.tell() > 2000:
                    break
    except Exception:
        try:
            with open(md_path, "r", encoding="gbk") as f:
                for line in f:
                    if "**Status**" in line:
                        parts = line.split(":", 1)
                        if len(parts) == 2:
                            status = parts[1].strip().strip("*").strip()
                            if status:
                                return status
                        break
                    if f.tell() > 2000:
                        break
        except Exception:
            pass
    return None


def check_mission_state_sync() -> tuple[str, str, bool]:
    """Check 9: Mission 状态同步检测。

    当 mission.state 中的 status 与 .md 文件头部 Status 字段不一致时，
    以 .md 文件为准自动修复 mission.state。

    规则:
    - .md 文件是 Source of Truth（人工/Orchestrator 直接维护）
    - mission.state 是机器可读缓存（可能被遗漏更新）
    - 不一致时以 .md 为准更新 mission.state
    - 记录同步动作到日志
    """
    if not os.path.isdir(MISSIONS_DIR):
        return ("OK", ".missions 目录不存在", False)

    synced: list[str] = []
    errors: list[str] = []

    # 扫描所有 mission.state 文件
    state_files = glob.glob(
        os.path.join(MISSIONS_DIR, "*", "mission.state"),
        recursive=True,
    )

    for sf in state_files:
        mission_dir = os.path.dirname(sf)
        mission_id = os.path.basename(mission_dir)

        # 读取 mission.state
        try:
            with open(sf, "r", encoding="utf-8") as f:
                state = json.load(f)
        except Exception:
            try:
                with open(sf, "r", encoding="gbk") as f:
                    state = json.load(f)
            except Exception:
                errors.append(f"{mission_id}: mission.state 读取失败")
                continue

        state_status = state.get("status", "UNKNOWN")

        # 查找对应的 .md 文件
        md_path = os.path.join(MISSIONS_DIR, f"{mission_id}.md")
        if not os.path.exists(md_path):
            # 没有 .md 文件，跳过（不作为错误）
            continue

        # 从 .md 提取 Status
        md_status = _extract_status_from_md(md_path)
        if md_status is None:
            # .md 中没有 Status 字段，跳过
            continue

        # 比较
        if state_status != md_status:
            # 以 .md 为准更新 mission.state
            old_status = state_status
            state["status"] = md_status
            state["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
            state["sync_source"] = "md_file_auto_sync"

            try:
                with open(sf, "w", encoding="utf-8") as f:
                    json.dump(state, f, ensure_ascii=False, indent=2)
                synced.append(f"{mission_id}: {old_status} → {md_status}")
                print(f"  [SYNC] {mission_id}: {old_status} → {md_status}")
            except OSError as e:
                errors.append(f"{mission_id}: 写入失败 ({e})")

    # 输出结果
    if errors:
        detail = f"同步 {len(synced)} 项, 错误 {len(errors)} 项: {'; '.join(errors)}"
        return ("WARNING", detail, False)

    if synced:
        detail = f"自动同步 {len(synced)} 项: {'; '.join(synced)}"
        check_id = "state_sync"
        sync_detail = "; ".join(synced)
        if should_notify(check_id, sync_detail):
            msg = (
                f"[EOS] Mission 状态自动同步\n"
                f"同步项: {len(synced)}\n"
                f"详情: {'; '.join(synced)}\n"
                f"规则: 以 .md 文件为准"
            )
            notified = send_feishu_text(msg)
            if notified:
                mark_notified(check_id, sync_detail)
        else:
            notified = False
        return ("INFO", detail, notified)

    return ("OK", "所有 mission.state 与 .md 状态一致", False)


# ──────────────────────────────────────────────
# EOS Statistics (Batch 5.1 — v2.4)
# ──────────────────────────────────────────────


def get_mission_completion_rate() -> dict:
    """统计 Mission 完成率。

    扫描 .missions/ 下所有 mission.state 文件，统计各状态数量。
    返回 dict: {total, completed, running, failed, created, paused, rate}
    """
    if not os.path.isdir(MISSIONS_DIR):
        return {"total": 0, "completed": 0, "running": 0, "failed": 0,
                "created": 0, "paused": 0, "rate": 0.0}

    counts = {"COMPLETED": 0, "RUNNING": 0, "FAILED": 0, "CREATED": 0, "PAUSED": 0}

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
        if status in counts:
            counts[status] += 1

    total = sum(counts.values())
    rate = (counts["COMPLETED"] / total * 100) if total > 0 else 0.0

    return {
        "total": total,
        "completed": counts["COMPLETED"],
        "running": counts["RUNNING"],
        "failed": counts["FAILED"],
        "created": counts["CREATED"],
        "paused": counts["PAUSED"],
        "rate": round(rate, 1),
    }


def get_batch_duration() -> dict:
    """计算当前 Active Mission 的 Batch 耗时。

    从 mission.state 读取 batch_started_at，计算已耗时分钟数。
    返回 dict: {mission_id, batch_started_at, elapsed_minutes, has_warning}
    """
    if not os.path.isdir(MISSIONS_DIR):
        return {"mission_id": None, "batch_started_at": None,
                "elapsed_minutes": 0, "has_warning": False}

    # 查找 RUNNING 的 mission
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

        if state.get("status") != "RUNNING":
            continue

        mission_id = state.get("mission_id", os.path.basename(os.path.dirname(sf)))
        batch_started_at = state.get("batch_started_at")

        if not batch_started_at:
            return {"mission_id": mission_id, "batch_started_at": None,
                    "elapsed_minutes": 0, "has_warning": False}

        try:
            started = datetime.datetime.fromisoformat(batch_started_at)
            if started.tzinfo is None:
                started = started.replace(tzinfo=datetime.timezone.utc)
            now = datetime.datetime.now(datetime.timezone.utc)
            elapsed = (now - started).total_seconds() / 60

            # 超过 120 分钟且无新 commit → 警告
            has_warning = elapsed > 120

            return {
                "mission_id": mission_id,
                "batch_started_at": batch_started_at,
                "elapsed_minutes": round(elapsed, 1),
                "has_warning": has_warning,
            }
        except (ValueError, TypeError):
            return {"mission_id": mission_id, "batch_started_at": None,
                    "elapsed_minutes": 0, "has_warning": False}

    return {"mission_id": None, "batch_started_at": None,
            "elapsed_minutes": 0, "has_warning": False}


def get_decision_wait_time() -> dict:
    """计算 Decision Gate 等待时间。

    从 mission.state 读取 pending_decision_gates 和 updated_at。
    返回 dict: {mission_id, pending_count, gates, wait_hours, has_warning}
    """
    if not os.path.isdir(MISSIONS_DIR):
        return {"mission_id": None, "pending_count": 0, "gates": [],
                "wait_hours": 0, "has_warning": False}

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

        if state.get("status") != "RUNNING":
            continue

        mission_id = state.get("mission_id", os.path.basename(os.path.dirname(sf)))
        gates = state.get("pending_decision_gates", [])
        updated_at = state.get("updated_at", "")

        if not gates:
            return {"mission_id": mission_id, "pending_count": 0, "gates": [],
                    "wait_hours": 0, "has_warning": False}

        wait_hours = 0
        has_warning = False

        if updated_at:
            try:
                updated = datetime.datetime.fromisoformat(updated_at)
                if updated.tzinfo is None:
                    updated = updated.replace(tzinfo=datetime.timezone.utc)
                now = datetime.datetime.now(datetime.timezone.utc)
                wait_hours = round((now - updated).total_seconds() / 3600, 1)
                has_warning = wait_hours > 24
            except (ValueError, TypeError):
                pass

        return {
            "mission_id": mission_id,
            "pending_count": len(gates),
            "gates": gates,
            "wait_hours": wait_hours,
            "has_warning": has_warning,
        }

    return {"mission_id": None, "pending_count": 0, "gates": [],
            "wait_hours": 0, "has_warning": False}


def check_eos_statistics() -> tuple[str, str, bool]:
    """Check 10: EOS 统计能力（Batch 5.1 新增）。

    整合 Mission 完成率、Batch 耗时、Decision 等待统计。
    始终返回 OK（统计信息不触发告警，仅输出）。
    告警由 Batch 耗时和 Decision 等待的子条件触发。
    """
    # Mission 完成率
    completion = get_mission_completion_rate()
    print(f"  Mission 完成率: {completion['completed']}/{completion['total']} ({completion['rate']}%)")

    # Batch 耗时
    batch_dur = get_batch_duration()
    if batch_dur["mission_id"]:
        if batch_dur["batch_started_at"]:
            print(f"  当前 Batch 耗时: {batch_dur['elapsed_minutes']:.0f} 分钟")
        else:
            print(f"  当前 Batch 耗时: — (无 batch_started_at)")
    else:
        print(f"  当前 Batch 耗时: — (无 Active Mission)")

    # Decision 等待
    decision = get_decision_wait_time()
    if decision["mission_id"] and decision["pending_count"] > 0:
        print(f"  Decision 等待: {decision['pending_count']} 项, 最长 {decision['wait_hours']:.1f} 小时")
    else:
        print(f"  Decision 等待: 无")

    # 优先级队列（Batch 4.1 新增）
    pending = sort_missions_by_priority(status_filter={"CREATED", "PENDING"})
    if pending:
        next_m = pending[0]
        next_id = next_m.get("mission_id", "unknown")
        next_pri = next_m.get("priority", "P2")
        print(f"  优先级队列: {len(pending)} 个待执行, 下一个: [{next_pri}] {next_id}")
    else:
        print(f"  优先级队列: 空")

    # 判断是否有告警
    warnings = []
    if batch_dur.get("has_warning"):
        warnings.append(f"Batch 耗时 {batch_dur['elapsed_minutes']:.0f}min 超限")
    if decision.get("has_warning"):
        warnings.append(f"Decision 等待 {decision['wait_hours']:.1f}h 超 24h")

    if warnings:
        detail = "; ".join(warnings)
        return ("WARNING", detail, False)

    detail = (
        f"完成率 {completion['completed']}/{completion['total']} ({completion['rate']}%), "
        f"Batch {batch_dur['elapsed_minutes']:.0f}min, "
        f"Decision {decision['pending_count']}项"
    )
    return ("OK", detail, False)


# ──────────────────────────────────────────────
# Batch 4.2: Duration Tracking & Timeout Alerts (v2.6)
# ──────────────────────────────────────────────


def _parse_iso_datetime(dt_str: str) -> Optional[datetime.datetime]:
    """安全解析 ISO 格式时间字符串，返回带 tzinfo 的 datetime 或 None。

    兼容 Python 3.10（不支持 'Z' 后缀），自动将 'Z' 替换为 '+00:00'。
    """
    if not dt_str:
        return None
    try:
        # Python 3.10 fromisoformat 不支持 'Z'，需手动替换
        normalized = dt_str.replace("Z", "+00:00")
        dt = datetime.datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def record_batch_start(mission_id: str, batch_id: str,
                       started_at: Optional[str] = None) -> bool:
    """记录 Batch 开始时间到 mission.state。

    Args:
        mission_id: Mission ID
        batch_id: Batch ID (e.g. "4.2")
        started_at: ISO 格式时间字符串，默认当前 UTC 时间

    Returns:
        True 如果成功写入，False 否则
    """
    if started_at is None:
        started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # 搜索两个目录
    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    for base_dir in search_dirs:
        state_path = os.path.join(base_dir, mission_id, "mission.state")
        if not os.path.isfile(state_path):
            continue

        try:
            with open(state_path, "r", encoding="utf-8") as f:
                state = json.load(f)
        except Exception:
            try:
                with open(state_path, "r", encoding="gbk") as f:
                    state = json.load(f)
            except Exception:
                continue

        state["batch_started_at"] = started_at
        state["batch_completed_at"] = None
        state["batch_duration_minutes"] = None
        state["current_batch"] = batch_id
        state["updated_at"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()

        try:
            with open(state_path, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            continue

    return False


def record_batch_end(mission_id: str,
                     completed_at: Optional[str] = None) -> bool:
    """记录 Batch 结束时间并计算耗时到 mission.state。

    Args:
        mission_id: Mission ID
        completed_at: ISO 格式时间字符串，默认当前 UTC 时间

    Returns:
        True 如果成功写入，False 否则
    """
    if completed_at is None:
        completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    for base_dir in search_dirs:
        state_path = os.path.join(base_dir, mission_id, "mission.state")
        if not os.path.isfile(state_path):
            continue

        try:
            with open(state_path, "r", encoding="utf-8") as f:
                state = json.load(f)
        except Exception:
            try:
                with open(state_path, "r", encoding="gbk") as f:
                    state = json.load(f)
            except Exception:
                continue

        started_at_str = state.get("batch_started_at")
        started_at = _parse_iso_datetime(started_at_str)
        end_at = _parse_iso_datetime(completed_at)

        duration_minutes = None
        if started_at and end_at:
            duration_minutes = round(
                (end_at - started_at).total_seconds() / 60, 1
            )

        state["batch_completed_at"] = completed_at
        state["batch_duration_minutes"] = duration_minutes
        state["updated_at"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()

        # 同时更新 tasks 列表中当前 batch 的状态
        current_batch = state.get("current_batch")
        tasks = state.get("tasks", [])
        for task in tasks:
            if str(task.get("id")) == str(current_batch):
                task["completed_at"] = completed_at
                if duration_minutes is not None:
                    task["duration_minutes"] = duration_minutes
                break

        try:
            with open(state_path, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            continue

    return False


def get_batch_duration_stats() -> dict:
    """跨 Mission Batch 耗时统计报表。

    扫描所有 mission.state，收集有 batch_duration_minutes 的记录。
    返回 dict: {
        total_batches, avg_minutes, max_minutes, min_minutes,
        total_minutes, max_mission_id, min_mission_id, batches: [...]
    }
    """
    batches = []

    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    seen_ids = set()

    for base_dir in search_dirs:
        if not os.path.isdir(base_dir):
            continue

        state_files = glob.glob(
            os.path.join(base_dir, "*", "mission.state"),
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

            mission_id = state.get("mission_id", "unknown")

            # 去重
            dedup_key = mission_id
            if dedup_key in seen_ids:
                continue
            seen_ids.add(dedup_key)

            # 收集 tasks 中有 duration_minutes 的记录
            tasks = state.get("tasks", [])
            for task in tasks:
                dur = task.get("duration_minutes")
                if dur is not None and isinstance(dur, (int, float)):
                    batches.append({
                        "mission_id": mission_id,
                        "batch_id": str(task.get("id", "?")),
                        "duration_minutes": dur,
                        "completed_at": task.get("completed_at", ""),
                    })

            # 也检查顶层 batch_duration_minutes（当前 batch）
            top_dur = state.get("batch_duration_minutes")
            if top_dur is not None and isinstance(top_dur, (int, float)):
                # 避免重复（如果 task 里已经有了）
                current_batch = state.get("current_batch", "")
                already = any(
                    b["mission_id"] == mission_id
                    and b["batch_id"] == str(current_batch)
                    for b in batches
                )
                if not already:
                    batches.append({
                        "mission_id": mission_id,
                        "batch_id": str(current_batch),
                        "duration_minutes": top_dur,
                        "completed_at": state.get("batch_completed_at", ""),
                    })

    if not batches:
        return {
            "total_batches": 0,
            "avg_minutes": 0,
            "max_minutes": 0,
            "min_minutes": 0,
            "total_minutes": 0,
            "max_mission_id": None,
            "min_mission_id": None,
            "batches": [],
        }

    durations = [b["duration_minutes"] for b in batches]
    max_idx = durations.index(max(durations))
    min_idx = durations.index(min(durations))

    return {
        "total_batches": len(batches),
        "avg_minutes": round(sum(durations) / len(durations), 1),
        "max_minutes": max(durations),
        "min_minutes": min(durations),
        "total_minutes": round(sum(durations), 1),
        "max_mission_id": batches[max_idx]["mission_id"],
        "max_batch_id": batches[max_idx]["batch_id"],
        "min_mission_id": batches[min_idx]["mission_id"],
        "min_batch_id": batches[min_idx]["batch_id"],
        "batches": batches,
    }


def check_batch_timeout() -> tuple[str, str, bool]:
    """独立超时告警检测。

    检查当前 RUNNING 的 Batch 是否超过 BATCH_TIMEOUT_MINUTES。
    返回 (status, detail, needs_owner)
    """
    if not os.path.isdir(MISSIONS_DIR):
        return ("OK", "无 Active Mission", False)

    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    seen_ids = set()

    for base_dir in search_dirs:
        if not os.path.isdir(base_dir):
            continue

        state_files = glob.glob(
            os.path.join(base_dir, "*", "mission.state"),
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

            if state.get("status") != "RUNNING":
                continue

            mission_id = state.get("mission_id", "unknown")
            if mission_id in seen_ids:
                continue
            seen_ids.add(mission_id)

            batch_started_at = state.get("batch_started_at")
            if not batch_started_at:
                continue

            started = _parse_iso_datetime(batch_started_at)
            if not started:
                continue

            now = datetime.datetime.now(datetime.timezone.utc)
            elapsed = (now - started).total_seconds() / 60
            current_batch = state.get("current_batch", "?")

            if elapsed > BATCH_TIMEOUT_MINUTES:
                return (
                    "WARNING",
                    f"[{mission_id}] Batch {current_batch} 已运行 "
                    f"{elapsed:.0f}min，超过阈值 {BATCH_TIMEOUT_MINUTES}min",
                    False,
                )

    return ("OK", f"无 Batch 超时（阈值 {BATCH_TIMEOUT_MINUTES}min）", False)


def check_batch_duration_statistics() -> tuple[str, str, bool]:
    """Check 12: Batch 耗时统计报表。

    输出所有已完成 Batch 的耗时统计（avg/max/min/total）。
    同时集成超时告警。
    """
    stats = get_batch_duration_stats()
    timeout_status, timeout_detail, _ = check_batch_timeout()

    print(f"  Batch 总数: {stats['total_batches']}")

    if stats["total_batches"] > 0:
        print(f"  平均耗时: {stats['avg_minutes']:.1f} 分钟")
        print(f"  最长耗时: {stats['max_minutes']:.1f} 分钟 "
              f"({stats.get('max_mission_id', '?')} / "
              f"Batch {stats.get('max_batch_id', '?')})")
        print(f"  最短耗时: {stats['min_minutes']:.1f} 分钟 "
              f"({stats.get('min_mission_id', '?')} / "
              f"Batch {stats.get('min_batch_id', '?')})")
        print(f"  累计耗时: {stats['total_minutes']:.1f} 分钟")
    else:
        print(f"  平均耗时: —")
        print(f"  最长耗时: —")
        print(f"  最短耗时: —")
        print(f"  累计耗时: —")

    # 超时告警
    if timeout_status == "WARNING":
        print(f"  [WARNING] 超时告警: {timeout_detail}")

    # 当前 Batch 实时耗时
    batch_dur = get_batch_duration()
    if batch_dur["mission_id"] and batch_dur["batch_started_at"]:
        print(f"  当前 Batch: {batch_dur['elapsed_minutes']:.0f} 分钟 (进行中)")

    if timeout_status == "WARNING":
        return ("WARNING", timeout_detail, False)

    if stats["total_batches"] > 0:
        detail = (
            f"{stats['total_batches']} batches, "
            f"avg {stats['avg_minutes']:.0f}min, "
            f"max {stats['max_minutes']:.0f}min"
        )
    else:
        detail = "无已完成 Batch 记录"

    return ("OK", detail, False)


# ──────────────────────────────────────────────
# Check 11: Mission 优先级队列（Batch 4.1 新增）
# ──────────────────────────────────────────────


def _load_all_mission_states() -> list[dict]:
    """加载所有 mission.state 文件（从项目目录和 QwenPaw 工作区两个位置）。

    返回 list[dict]，每个 dict 是一个 mission.state 的内容。
    去重逻辑：以 mission_id 为键，优先读项目目录（更新更频繁）。
    """
    states_by_id: dict[str, dict] = {}

    # 搜索两个目录
    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    for base_dir in search_dirs:
        if not os.path.isdir(base_dir):
            continue
        state_files = glob.glob(
            os.path.join(base_dir, "*", "mission.state"),
            recursive=True,
        )
        for sf in state_files:
            state = None
            try:
                with open(sf, "r", encoding="utf-8") as f:
                    state = json.load(f)
            except Exception:
                try:
                    with open(sf, "r", encoding="gbk") as f:
                        state = json.load(f)
                except Exception:
                    continue

            if state and "mission_id" in state:
                mid = state["mission_id"]
                # 优先保留项目目录的版本（通常更新）
                if mid not in states_by_id or base_dir == PROJECT_MISSIONS_DIR:
                    states_by_id[mid] = state

    return list(states_by_id.values())


def get_mission_priority(mission_id: str) -> str:
    """获取单个 Mission 的优先级。

    优先级: P0 > P1 > P2 > P3
    如果 mission.state 中无 priority 字段，默认返回 P2。
    """
    states = _load_all_mission_states()
    for state in states:
        if state.get("mission_id") == mission_id:
            return state.get("priority", "P2")
    return "P2"  # 默认优先级


def sort_missions_by_priority(
    status_filter: Optional[set[str]] = None,
) -> list[dict]:
    """按优先级+创建时间排序 Mission 列表。

    排序规则:
    1. 按优先级排序: P0 > P1 > P2 > P3
    2. 同优先级按创建时间排序: 先创建先执行（FIFO）

    Args:
        status_filter: 要包含的状态集合，如 {"CREATED", "PENDING"}。
                       None 表示包含所有状态。

    Returns:
        排序后的 mission state 列表。
    """
    states = _load_all_mission_states()

    # 过滤状态
    if status_filter:
        states = [s for s in states if s.get("status") in status_filter]

    # 排序: 先按优先级，再按创建时间
    def sort_key(state: dict) -> tuple[int, str]:
        priority = state.get("priority", "P2")
        priority_val = PRIORITY_ORDER.get(priority, 99)
        created_at = state.get("created_at", "9999-99-99")
        # 处理 ISO 格式中的时区后缀，统一截取前 19 字符
        if len(created_at) > 19:
            created_at = created_at[:19]
        return (priority_val, created_at)

    return sorted(states, key=sort_key)


def get_next_mission() -> Optional[dict]:
    """获取下一个将执行的 Mission。

    从 CREATED/PENDING 状态的 Mission 中，按优先级排序取第一个。
    如果没有待执行的 Mission，返回 None。
    """
    sorted_missions = sort_missions_by_priority(
        status_filter={"CREATED", "PENDING"}
    )
    if sorted_missions:
        return sorted_missions[0]
    return None


def check_mission_priority_queue() -> tuple[str, str, bool]:
    """Check 11: Mission 优先级队列展示。

    输出:
    - 当前 RUNNING Mission 的优先级
    - 待执行 Mission 列表（按优先级排序）
    - 下一个将执行的 Mission
    """
    states = _load_all_mission_states()

    # 当前 RUNNING Mission
    running = [s for s in states if s.get("status") == "RUNNING"]
    # 待执行 Mission（CREATED/PENDING）
    pending = sort_missions_by_priority(status_filter={"CREATED", "PENDING"})

    lines = []

    # RUNNING Mission 优先级
    if running:
        lines.append(f"当前 RUNNING: {len(running)} 个")
        for m in running:
            mid = m.get("mission_id", "unknown")
            priority = m.get("priority", "P2")
            label = PRIORITY_LABELS.get(priority, priority)
            phase = m.get("current_phase", "?")
            batch = m.get("current_batch", "?")
            lines.append(
                f"  [{priority}] {mid} (Phase {phase}, Batch {batch})"
            )
    else:
        lines.append("当前 RUNNING: 无")

    # 待执行列表
    if pending:
        lines.append(f"待执行队列: {len(pending)} 个（按优先级排序）")
        for i, m in enumerate(pending, 1):
            mid = m.get("mission_id", "unknown")
            priority = m.get("priority", "P2")
            created = m.get("created_at", "unknown")[:10]
            lines.append(f"  {i}. [{priority}] {mid} (创建: {created})")

        # 下一个将执行的
        next_m = pending[0]
        next_id = next_m.get("mission_id", "unknown")
        next_priority = next_m.get("priority", "P2")
        lines.append(f"下一个执行: [{next_priority}] {next_id}")
    else:
        lines.append("待执行队列: 空")
        lines.append("下一个执行: 无（等待 Owner 创建新 Mission）")

    detail = "\n".join(lines)

    # 统计各优先级数量
    all_states = states
    priority_counts = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}
    for s in all_states:
        p = s.get("priority", "P2")
        if p in priority_counts:
            priority_counts[p] += 1

    # 检查是否有 P0 待执行（紧急 Mission 排队）
    p0_pending = [m for m in pending if m.get("priority") == "P0"]
    has_warning = False
    if p0_pending and running:
        # P0 Mission 在排队但当前有非 P0 Mission 在运行
        for m in running:
            if m.get("priority", "P2") > "P0":
                has_warning = True
                break

    if has_warning:
        return ("WARNING", f"P0 紧急 Mission 等待执行，当前有低优先级 Mission 运行中", False)

    return ("OK", detail, False)


# ──────────────────────────────────────────────
# Daily Report Generation (Batch 4.3 — v2.7)
# ──────────────────────────────────────────────

DAILY_REPORTS_DIR = os.path.join(os.path.dirname(BASE_DIR), "daily-reports")

# Evidence 索引文件路径（Batch 4.4 — v2.8）
EVIDENCE_INDEX_FILE = os.path.join(
    os.path.dirname(BASE_DIR), ".missions", "EVIDENCE-INDEX.md"
)

# Evidence 分类关键词映射（按优先级排列，先匹配先生效）
EVIDENCE_TYPE_KEYWORDS = {
    "fix": [
        "修复", "fix", "bug", "hotfix", "patch", "defect",
        "error", "crash", "broken", "regression", "guard bug",
        "泄漏", "leak",
    ],
    "feat": [
        "新增", "功能", "feat", "feature", "implement",
        "implementation", "add", "new page", "new endpoint",
        "新增页面", "新增功能", "新增端点", "新增方法",
    ],
    "docs": [
        "文档", "docs", "document", "readme", "blueprint",
        "plan", "计划", "方案", "research",
        "扫描报告", "计划文档",
    ],
    "test": [
        "测试", "test", "spec", "coverage",
        "回归测试", "regression test", "unit test",
    ],
    "chore": [
        "配置", "chore", "config", "env", "dependency",
        "依赖", "upgrade", "迁移", "migration", "cleanup",
        "清理", "重构", "refactor",
    ],
    "verify": [
        "验证报告", "verify", "validation", "audit",
        "验收", "review", "scan", "扫描结果",
        "pass",
    ],
}


def collect_daily_completed(date_str: str) -> list[dict]:
    """收集指定日期完成的 Mission/Phase/Batch。

    扫描所有 mission.state 文件，找出在 date_str 当天完成的任务。
    判定标准：tasks 中 completed_at 的日期 = date_str。
    返回 list[dict]，每个 dict 包含 mission_id, task_id, description, commit, evidence。
    """
    completed = []
    seen_keys = set()  # dedup by (mission_id, task_id)
    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    for base_dir in search_dirs:
        if not os.path.isdir(base_dir):
            continue
        state_files = glob.glob(
            os.path.join(base_dir, "*", "mission.state"), recursive=True
        )
        for sf in state_files:
            state = None
            try:
                with open(sf, "r", encoding="utf-8") as f:
                    state = json.load(f)
            except Exception:
                try:
                    with open(sf, "r", encoding="gbk") as f:
                        state = json.load(f)
                except Exception:
                    continue

            if not state:
                continue

            mission_id = state.get("mission_id", "unknown")
            tasks = state.get("tasks", [])
            for task in tasks:
                completed_at = task.get("completed_at", "")
                if completed_at and date_str in completed_at:
                    dedup_key = (mission_id, task.get("id", "?"))
                    if dedup_key in seen_keys:
                        continue
                    seen_keys.add(dedup_key)
                    completed.append({
                        "mission_id": mission_id,
                        "task_id": task.get("id", "?"),
                        "description": task.get("description", ""),
                        "commit": task.get("commit", "—"),
                        "evidence": task.get("evidence", "—"),
                    })

    return completed


def get_daily_commits(date_str: str) -> list[dict]:
    """获取指定日期的 git commits。

    使用 git log --since --until 获取当日 commits。
    返回 list[dict]，每个 dict 包含 sha, message, author。
    """
    repo_dir = os.path.dirname(BASE_DIR)  # 项目根目录
    try:
        result = subprocess.run(
            [
                "git", "log",
                f"--since={date_str}T00:00:00",
                f"--until={date_str}T23:59:59",
                "--format=%H|%s|%an",
                "--no-merges",
            ],
            capture_output=True,
            text=True,
            cwd=repo_dir,
            timeout=30,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode != 0:
            return []

        commits = []
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("|", 2)
            if len(parts) >= 2:
                commits.append({
                    "sha": parts[0][:7],
                    "message": parts[1],
                    "author": parts[2] if len(parts) > 2 else "unknown",
                })
        return commits
    except Exception:
        return []


def get_daily_evidence(date_str: str) -> list[str]:
    """获取指定日期新增的 Evidence 文件。

    扫描所有 .missions/*/evidence/ 目录，找出 mtime 在 date_str 当天的文件。
    返回 list[str]，文件名列表。
    """
    evidence_files = []
    seen_names = set()  # dedup by filename
    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()

    for base_dir in search_dirs:
        if not os.path.isdir(base_dir):
            continue
        ev_dirs = glob.glob(
            os.path.join(base_dir, "*", "evidence"), recursive=True
        )
        for ev_dir in ev_dirs:
            if not os.path.isdir(ev_dir):
                continue
            for fname in os.listdir(ev_dir):
                fpath = os.path.join(ev_dir, fname)
                if os.path.isfile(fpath):
                    try:
                        mtime = datetime.datetime.fromtimestamp(
                            os.path.getmtime(fpath)
                        ).date()
                        if mtime == target_date:
                            if fname not in seen_names:
                                seen_names.add(fname)
                                evidence_files.append(fname)
                    except Exception:
                        pass

    return evidence_files


def get_test_status() -> str:
    """获取当前测试状态摘要。"""
    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    for base_dir in search_dirs:
        if not os.path.isdir(base_dir):
            continue
        state_files = glob.glob(
            os.path.join(base_dir, "*", "mission.state"), recursive=True
        )
        for sf in state_files:
            state = None
            try:
                with open(sf, "r", encoding="utf-8") as f:
                    state = json.load(f)
            except Exception:
                continue
            if state and state.get("test_baseline"):
                return state["test_baseline"]

    return "—"


def get_build_status() -> str:
    """获取当前构建状态。从 dist/ 目录推断。"""
    dist_dir = os.path.join(BASE_DIR, "dist")
    if os.path.isdir(dist_dir):
        try:
            files = os.listdir(dist_dir)
            if files:
                return "PASS"
        except Exception:
            pass
    return "—"


def generate_daily_report(date_str: str) -> str:
    """生成指定日期的日报并写入文件。

    参数: date_str — 日期字符串，格式 YYYY-MM-DD
    返回: 生成的文件路径
    """
    # 确保输出目录存在
    os.makedirs(DAILY_REPORTS_DIR, exist_ok=True)

    # 收集数据
    completed = collect_daily_completed(date_str)
    commits = get_daily_commits(date_str)
    evidence = get_daily_evidence(date_str)
    test_status = get_test_status()
    build_status = get_build_status()

    # 构建完成项文本
    if completed:
        completed_lines = []
        for item in completed:
            completed_lines.append(
                f"- Mission: {item['mission_id']}\n"
                f"  - Task: {item['task_id']}\n"
                f"  - 描述: {item['description']}\n"
                f"  - Commit: {item['commit']}\n"
                f"  - Evidence: {item['evidence']}"
            )
        completed_text = "\n".join(completed_lines)
    else:
        completed_text = "- 无记录"

    # 待处理项（从当前 running mission 的 decision gates 推断）
    decision_count = 0
    blocking_count = 0
    next_mission = "—"
    next_priority = "—"

    # 尝试获取下一个 mission 信息
    seen_missions = set()  # dedup by mission_id
    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    for base_dir in search_dirs:
        if not os.path.isdir(base_dir):
            continue
        state_files = glob.glob(
            os.path.join(base_dir, "*", "mission.state"), recursive=True
        )
        for sf in state_files:
            state = None
            try:
                with open(sf, "r", encoding="utf-8") as f:
                    state = json.load(f)
            except Exception:
                continue
            if state and state.get("status") == "RUNNING":
                mid = state.get("mission_id", "—")
                if mid in seen_missions:
                    continue
                seen_missions.add(mid)
                for task in state.get("tasks", []):
                    if task.get("status") == "PENDING":
                        if next_mission == "—":
                            next_mission = state.get("mission_id", "—")
                            next_priority = state.get("priority", "—")
                        break

    # 读取模板
    template_path = os.path.join(TOOLS_DIR, "daily_report_template.md")
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template = f.read()
    except Exception:
        template = "# EOS 日报 — {date}\n\n{content}"

    # 填充模板
    report = template.replace("{date}", date_str)
    report = report.replace("{completed_items}", completed_text)
    report = report.replace("{commit_count}", str(len(commits)))
    report = report.replace("{test_status}", test_status)
    report = report.replace("{build_status}", build_status)
    report = report.replace("{evidence_count}", str(len(evidence)))
    report = report.replace("{decision_count}", str(decision_count))
    report = report.replace("{blocking_count}", str(blocking_count))
    report = report.replace("{next_mission}", next_mission)
    report = report.replace("{next_priority}", next_priority)

    # 追加 commit 列表
    if commits:
        report += "\n\n## 今日 Commits\n"
        for c in commits:
            report += f"- `{c['sha']}` {c['message']} ({c['author']})\n"

    # 追加 evidence 列表
    if evidence:
        report += "\n\n## 今日 Evidence\n"
        for e in evidence:
            report += f"- {e}\n"

    # 写入文件
    output_path = os.path.join(DAILY_REPORTS_DIR, f"{date_str}.md")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)

    return output_path


# ──────────────────────────────────────────────
# Evidence Auto-Classification & Indexing (Batch 4.4 — v2.8)
# ──────────────────────────────────────────────


def classify_evidence(evidence_file: str) -> str:
    """根据 Evidence 文件内容自动分类。

    读取文件内容，按 EVIDENCE_TYPE_KEYWORDS 中的关键词匹配。
    使用评分机制：统计每个类型的关键词命中次数，取得分最高的类型。
    如果所有类型得分都为 0，返回 "unknown"。
    """
    if not os.path.isfile(evidence_file):
        return "unknown"

    try:
        with open(evidence_file, "r", encoding="utf-8") as f:
            content = f.read().lower()
    except UnicodeDecodeError:
        try:
            with open(evidence_file, "r", encoding="gbk") as f:
                content = f.read().lower()
        except Exception:
            return "unknown"
    except Exception:
        return "unknown"

    # 也检查文件名本身（文件名权重 x3）
    filename = os.path.basename(evidence_file).lower()
    combined = (filename + " ") * 3 + content

    # 评分机制：统计每个类型的关键词命中次数
    scores: dict[str, int] = {}
    for evidence_type, keywords in EVIDENCE_TYPE_KEYWORDS.items():
        score = 0
        for kw in keywords:
            # 统计关键词出现次数
            count = combined.lower().count(kw.lower())
            score += count
        scores[evidence_type] = score

    # 取得分最高的类型
    best_type = max(scores, key=scores.get)  # type: ignore[arg-type]
    best_score = scores[best_type]

    if best_score == 0:
        return "unknown"

    return best_type


def _collect_all_evidence() -> list[dict]:
    """收集所有 Evidence 文件信息。

    扫描 .missions/ 下所有 evidence/ 目录中的 .md 文件。
    返回 list[dict]，每个 dict 包含：
        file_path, file_name, mission_id, evidence_id,
        classification, description, mtime, size
    """
    results = []
    search_dirs = [MISSIONS_DIR]
    if os.path.isdir(PROJECT_MISSIONS_DIR):
        search_dirs.append(PROJECT_MISSIONS_DIR)

    seen_files = set()  # dedup by (mission_id, file_name)

    for base_dir in search_dirs:
        if not os.path.isdir(base_dir):
            continue

        # 查找所有 evidence/ 目录下的 .md 文件
        for root, dirs, files in os.walk(base_dir):
            # 只处理 evidence 目录
            if os.path.basename(root) != "evidence":
                continue

            # 提取 mission_id（evidence 目录的上级目录名）
            mission_dir = os.path.dirname(root)
            mission_id = os.path.basename(mission_dir)

            for fname in files:
                if not fname.endswith(".md"):
                    continue

                fpath = os.path.join(root, fname)

                # 去重：按 (mission_id, file_name) 去重
                # 同一 evidence 可能存在于 MISSIONS_DIR 和 PROJECT_MISSIONS_DIR
                dedup_key = (mission_id, fname)
                if dedup_key in seen_files:
                    continue
                seen_files.add(dedup_key)

                # 跳过 EVIDENCE-SUMMARY.md（这是索引文件，不是单条 evidence）
                if fname.upper() == "EVIDENCE-SUMMARY.MD":
                    continue

                # 提取 evidence_id（从文件名推导）
                evidence_id = os.path.splitext(fname)[0]

                # 分类
                classification = classify_evidence(fpath)

                # 提取描述（读取文件前几行找标题或第一行有意义的内容）
                description = _extract_evidence_description(fpath)

                # 文件元数据
                try:
                    stat = os.stat(fpath)
                    mtime = stat.st_mtime
                    size = stat.st_size
                except OSError:
                    mtime = 0
                    size = 0

                results.append({
                    "file_path": fpath,
                    "file_name": fname,
                    "mission_id": mission_id,
                    "evidence_id": evidence_id,
                    "classification": classification,
                    "description": description,
                    "mtime": mtime,
                    "size": size,
                })

    return results


def _extract_evidence_description(file_path: str) -> str:
    """从 Evidence 文件中提取简短描述。

    尝试从文件头部提取标题或第一行有意义的内容。
    最大返回 80 字符。
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = []
            for i, line in enumerate(f):
                if i >= 10:
                    break
                lines.append(line.strip())
    except UnicodeDecodeError:
        try:
            with open(file_path, "r", encoding="gbk") as f:
                lines = []
                for i, line in enumerate(f):
                    if i >= 10:
                        break
                    lines.append(line.strip())
        except Exception:
            return "(无法读取)"
    except Exception:
        return "(无法读取)"

    # 优先找 # 标题
    for line in lines:
        if line.startswith("# ") and not line.startswith("## "):
            title = line[2:].strip()
            # 去掉 "Evidence:" 前缀
            if title.lower().startswith("evidence:"):
                title = title[9:].strip()
            # 去掉 "Evidence —" 前缀
            if "—" in title:
                title = title.split("—", 1)[1].strip()
            return title[:80] if title else "(无描述)"

    # 其次找第一个非空非标题行
    for line in lines:
        if line and not line.startswith("#") and not line.startswith("-") and not line.startswith("|"):
            return line[:80]

    return "(无描述)"


def generate_evidence_index() -> str:
    """生成 Evidence 索引文件。

    扫描所有 Evidence 文件，按 Mission 分类 + 按类型分类，
    输出到 .missions/EVIDENCE-INDEX.md。
    返回输出文件路径。
    """
    all_evidence = _collect_all_evidence()

    if not all_evidence:
        # 即使没有 evidence 也生成空索引
        pass

    # 按 Mission 分组
    by_mission: dict[str, list[dict]] = {}
    for ev in all_evidence:
        mid = ev["mission_id"]
        if mid not in by_mission:
            by_mission[mid] = []
        by_mission[mid].append(ev)

    # 按类型分组
    by_type: dict[str, list[dict]] = {}
    for ev in all_evidence:
        cls = ev["classification"]
        if cls not in by_type:
            by_type[cls] = []
        by_type[cls].append(ev)

    # 生成 Markdown
    lines = []
    lines.append("# Evidence 索引")
    lines.append("")
    lines.append(f"自动生成时间: {_now()}")
    lines.append(f"总 Evidence 数量: {len(all_evidence)}")
    lines.append("")

    # 按 Mission 分类
    lines.append("## 按 Mission 分类")
    lines.append("")

    for mid in sorted(by_mission.keys()):
        evs = by_mission[mid]
        lines.append(f"### {mid}")
        lines.append("")
        for ev in sorted(evs, key=lambda x: x["evidence_id"]):
            desc = ev["description"]
            cls = ev["classification"]
            lines.append(f"- {ev['evidence_id']}: {desc} [{cls}]")
        lines.append("")

    # 按类型分类
    lines.append("## 按类型分类")
    lines.append("")

    type_labels = {
        "fix": "Fix (代码修复)",
        "feat": "Feat (功能新增)",
        "docs": "Docs (文档更新)",
        "test": "Test (测试补充)",
        "chore": "Chore (配置修改)",
        "verify": "Verify (验证报告)",
        "unknown": "Unknown (未分类)",
    }

    for cls in ["fix", "feat", "docs", "test", "chore", "verify", "unknown"]:
        evs = by_type.get(cls, [])
        if not evs:
            continue
        label = type_labels.get(cls, cls)
        lines.append(f"### {label}")
        lines.append("")
        for ev in sorted(evs, key=lambda x: x["evidence_id"]):
            desc = ev["description"]
            mid = ev["mission_id"]
            lines.append(f"- {ev['evidence_id']}: {desc} ({mid})")
        lines.append("")

    # 写入文件
    output_dir = os.path.dirname(EVIDENCE_INDEX_FILE)
    os.makedirs(output_dir, exist_ok=True)

    content = "\n".join(lines)
    with open(EVIDENCE_INDEX_FILE, "w", encoding="utf-8") as f:
        f.write(content)

    return EVIDENCE_INDEX_FILE


def get_evidence_statistics() -> dict:
    """获取 Evidence 统计信息。

    返回 dict: {
        total: int,
        by_type: {fix: int, feat: int, docs: int, test: int, chore: int, verify: int, unknown: int},
        by_mission: {mission_id: int, ...},
        recent_7days: int,
        recent_7days_detail: [{evidence_id, mission_id, classification, date}, ...],
    }
    """
    all_evidence = _collect_all_evidence()

    # 总量
    total = len(all_evidence)

    # 按类型统计
    by_type = {"fix": 0, "feat": 0, "docs": 0, "test": 0,
               "chore": 0, "verify": 0, "unknown": 0}
    for ev in all_evidence:
        cls = ev["classification"]
        if cls in by_type:
            by_type[cls] += 1
        else:
            by_type["unknown"] += 1

    # 按 Mission 统计
    by_mission: dict[str, int] = {}
    for ev in all_evidence:
        mid = ev["mission_id"]
        by_mission[mid] = by_mission.get(mid, 0) + 1

    # 近 7 天新增
    now = datetime.datetime.now()
    seven_days_ago = now - datetime.timedelta(days=7)
    seven_days_ago_ts = seven_days_ago.timestamp()

    recent_7days = 0
    recent_7days_detail = []
    for ev in all_evidence:
        if ev["mtime"] >= seven_days_ago_ts:
            recent_7days += 1
            date_str = datetime.datetime.fromtimestamp(
                ev["mtime"]
            ).strftime("%Y-%m-%d")
            recent_7days_detail.append({
                "evidence_id": ev["evidence_id"],
                "mission_id": ev["mission_id"],
                "classification": ev["classification"],
                "date": date_str,
            })

    return {
        "total": total,
        "by_type": by_type,
        "by_mission": by_mission,
        "recent_7days": recent_7days,
        "recent_7days_detail": sorted(
            recent_7days_detail, key=lambda x: x["date"], reverse=True
        ),
    }


def format_evidence_statistics() -> str:
    """格式化 Evidence 统计为可读字符串。"""
    stats = get_evidence_statistics()

    lines = []
    lines.append(f"Evidence 统计:")
    lines.append(f"  总量: {stats['total']}")
    lines.append(f"  按类型:")

    type_labels = {
        "fix": "Fix(修复)",
        "feat": "Feat(功能)",
        "docs": "Docs(文档)",
        "test": "Test(测试)",
        "chore": "Chore(配置)",
        "verify": "Verify(验证)",
        "unknown": "Unknown(未分类)",
    }

    for cls in ["fix", "feat", "docs", "test", "chore", "verify", "unknown"]:
        count = stats["by_type"].get(cls, 0)
        if count > 0:
            label = type_labels.get(cls, cls)
            lines.append(f"    {label}: {count}")

    lines.append(f"  按 Mission:")
    for mid in sorted(stats["by_mission"].keys()):
        count = stats["by_mission"][mid]
        # 缩短 Mission ID 显示
        short_id = mid if len(mid) <= 50 else mid[:47] + "..."
        lines.append(f"    {short_id}: {count}")

    lines.append(f"  近 7 天新增: {stats['recent_7days']}")
    for detail in stats["recent_7days_detail"][:5]:
        lines.append(
            f"    {detail['date']} | {detail['evidence_id']} "
            f"({detail['classification']}) [{detail['mission_id'][:30]}]"
        )
    if len(stats["recent_7days_detail"]) > 5:
        lines.append(f"    ... 还有 {len(stats['recent_7days_detail']) - 5} 项")

    return "\n".join(lines)


def main() -> int:
    """执行所有检测项并输出日志。"""
    # 命令行参数解析（Batch 4.3 新增）
    args = sys.argv[1:]

    if "--daily-report" in args:
        # 确定日期
        date_arg = None
        for i, arg in enumerate(args):
            if arg == "--daily-report" and i + 1 < len(args):
                next_arg = args[i + 1]
                # 检查是否是日期格式
                if len(next_arg) == 10 and next_arg[4] == '-':
                    date_arg = next_arg
                    break

        report_date = date_arg if date_arg else _today()
        print(f"Generating daily report for {report_date}...")
        try:
            output_path = generate_daily_report(report_date)
            print(f"Daily report generated: {output_path}")
            return 0
        except Exception as e:
            print(f"ERROR: Failed to generate daily report: {e}")
            return 1

    # Batch 4.4 — Evidence 索引生成
    if "--evidence-index" in args:
        print("Generating Evidence index...")
        try:
            output_path = generate_evidence_index()
            print(f"Evidence index generated: {output_path}")
            return 0
        except Exception as e:
            print(f"ERROR: Failed to generate evidence index: {e}")
            return 1

    # Batch 4.4 — Evidence 统计
    if "--evidence-stats" in args:
        print("Evidence Statistics:")
        try:
            output = format_evidence_statistics()
            print(output)
            return 0
        except Exception as e:
            print(f"ERROR: Failed to get evidence statistics: {e}")
            return 1

    # 清除代理
    for k in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"]:
        os.environ.pop(k, None)

    print("=" * 60)
    print(f"  EOS Heartbeat Check v2.8")
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
        ("State Sync", check_mission_state_sync),
        ("EOS Statistics", check_eos_statistics),
        ("Priority Queue", check_mission_priority_queue),
        ("Batch Duration Stats", check_batch_duration_statistics),
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
