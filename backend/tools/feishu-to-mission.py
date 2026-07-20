#!/usr/bin/env python3
"""
feishu-to-mission.py — Read a row from the Feishu Mission Board and export as mission.json.

Converts a single spreadsheet row into Pump Runner-compatible mission.json format.
The output contains NO "status" or "state" fields — Pump Runner's build_state() handles that.

Usage:
    python feishu-to-mission.py --board <token> --sheet <sheet_id> --row <row_number> [--output <path>]

Dependencies: Python 3.10+, requests
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Optional

try:
    import requests
except ImportError:
    print("FATAL: requests library not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

FEISHU_BASE_URL = "https://open.feishu.cn/open-apis"


# ── Auth ──────────────────────────────────────────────────────────

def get_tenant_access_token() -> str:
    """Obtain tenant_access_token using FEISHU_APP_ID and FEISHU_APP_SECRET env vars."""
    app_id = os.environ.get("FEISHU_APP_ID")
    app_secret = os.environ.get("FEISHU_APP_SECRET")
    if not app_id or not app_secret:
        print("ERROR: FEISHU_APP_ID and FEISHU_APP_SECRET must be set.", file=sys.stderr)
        sys.exit(1)

    url = f"{FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal"
    resp = requests.post(url, json={"app_id": app_id, "app_secret": app_secret}, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        print(f"ERROR: Failed to get token: {data}", file=sys.stderr)
        sys.exit(1)
    return data["tenant_access_token"]


def get_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


# ── Feishu API ────────────────────────────────────────────────────

def read_mission_from_feishu(board_token: str, sheet_id: str, row_index: int, token: str) -> list[str]:
    """
    Read a single row from the Mission Board spreadsheet.

    Row is 1-based (header is row 1, data starts row 2).
    Returns a list of 13 values (columns A-M).

    Args:
        board_token: Feishu spreadsheet token.
        sheet_id: Sheet ID within the spreadsheet.
        row_index: 1-based row number to read.
        token: Tenant access token.

    Returns:
        List of 13 string values (one per column A-M), padded with empty strings.

    Raises:
        SystemExit: On API failure.
    """
    range_str = f"{sheet_id}!A{row_index}:M{row_index}"
    url = f"{FEISHU_BASE_URL}/sheets/v2/spreadsheets/{board_token}/values/{range_str}"
    resp = requests.get(url, headers=get_headers(token), timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        print(f"ERROR: Failed to read row {row_index}: {data}", file=sys.stderr)
        sys.exit(1)

    values = data.get("data", {}).get("valueRange", {}).get("values", [])
    if not values:
        return [""] * 13

    row_data = list(values[0])
    # Pad to 13 columns
    while len(row_data) < 13:
        row_data.append("")
    return row_data


def parse_priority(priority_str: str) -> str:
    """Parse priority string, defaulting to P2 on invalid input."""
    priority_str = priority_str.strip().upper()
    if priority_str in ("P0", "P1", "P2", "P3"):
        return priority_str
    print(f"WARNING: Invalid priority '{priority_str}', defaulting to P2", file=sys.stderr)
    return "P2"


def parse_tags(tag_str: str) -> list[str]:
    """Parse tag string into a list of tags."""
    if not tag_str or not tag_str.strip():
        return []
    return [t.strip() for t in tag_str.split(",") if t.strip()]


def parse_created_time(time_str: str) -> str:
    """Parse created time string into ISO 8601 format.

    Accepts common date formats; falls back to current time if unparseable.
    """
    if not time_str or not time_str.strip():
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    time_str = time_str.strip()
    # Try common date formats
    for fmt in (
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(time_str, fmt)
            if fmt == "%Y-%m-%d":
                dt = dt.replace(hour=0, minute=0, second=0)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            continue

    print(f"WARNING: Could not parse time '{time_str}', using current time", file=sys.stderr)
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def export_to_mission_json(
    row_data: list[str],
    board_token: str,
    sheet_id: str,
    row_index: int,
) -> dict[str, Any]:
    """
    Convert row data to Pump Runner-compatible mission.json format.

    The output MUST NOT contain "status" or "state" fields — Pump Runner's
    build_state() will handle those.

    Args:
        row_data: List of 13 values (columns A-M).
        board_token: Feishu spreadsheet token.
        sheet_id: Sheet ID within the spreadsheet.
        row_index: 1-based row number (for feishu_row field).

    Returns:
        Mission JSON dict suitable for writing to .missions/<id>/mission.json.
    """
    mission_id = row_data[0].strip() if row_data[0] else ""
    mission_name = row_data[1].strip() if len(row_data) > 1 else ""
    description = row_data[2].strip() if len(row_data) > 2 else ""
    status = row_data[3].strip() if len(row_data) > 3 else ""
    owner = row_data[4].strip() if len(row_data) > 4 else ""
    executor = row_data[5].strip() if len(row_data) > 5 else ""
    priority_str = row_data[6].strip() if len(row_data) > 6 else ""
    created_time_str = row_data[7].strip() if len(row_data) > 7 else ""
    tag_str = row_data[12].strip() if len(row_data) > 12 else ""

    priority = parse_priority(priority_str)
    tags = parse_tags(tag_str)
    created_at = parse_created_time(created_time_str)

    # Warn about invalid status
    valid_statuses = {"CREATED", "RUNNING", "PAUSED", "FAILED", "COMPLETED", "ABORTED"}
    if status and status not in valid_statuses:
        print(f"WARNING: Invalid Status '{status}' in row {row_index}", file=sys.stderr)

    mission: dict[str, Any] = {
        "id": mission_id,
        "name": mission_name or f"Mission-{mission_id}",
        "description": description,
        "source": "feishu",
        "feishu_board_token": board_token,
        "feishu_sheet_id": sheet_id,
        "feishu_row": row_index,
        "priority": priority,
        "tags": tags,
        "created_at": created_at,
        "tasks": [
            {
                "id": "TASK-001",
                "label": "执行任务",
                "prompt": description or f"Execute mission {mission_id}",
            }
        ],
    }

    return mission


# ── CLI ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Read a row from Feishu Mission Board and export as mission.json."
    )
    parser.add_argument(
        "--board", required=True,
        help="Feishu spreadsheet token (board token)"
    )
    parser.add_argument(
        "--sheet", required=True,
        help="Sheet ID within the spreadsheet"
    )
    parser.add_argument(
        "--row", required=True, type=int,
        help="Row number to export (1-based, data starts at row 2)"
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output path for mission.json (default: .missions/<id>/mission.json in current dir)"
    )
    args = parser.parse_args()

    # Guard: refuse to export header row
    if args.row <= 1:
        print("ERROR: Row 1 is the header row. Data starts at row 2.", file=sys.stderr)
        sys.exit(1)

    print(f"🔍 Reading row {args.row} from board...")
    token = get_tenant_access_token()
    row_data = read_mission_from_feishu(args.board, args.sheet, args.row, token)

    # Validate Mission ID
    mission_id = row_data[0].strip()
    if not mission_id:
        print("ERROR: Mission ID (column A) is empty. Cannot export.", file=sys.stderr)
        sys.exit(1)
    print(f"   Mission ID: {mission_id}")
    print(f"   Mission Name: {row_data[1].strip()}")
    print(f"   Status: {row_data[3].strip()}")
    print()

    # Build mission JSON
    mission_json = export_to_mission_json(
        row_data, args.board, args.sheet, args.row,
    )

    # Determine output path
    if args.output:
        output_path = args.output
    else:
        missions_dir = os.path.join(os.getcwd(), ".missions", mission_id)
        os.makedirs(missions_dir, exist_ok=True)
        output_path = os.path.join(missions_dir, "mission.json")

    # Check if mission.json already exists
    if os.path.exists(output_path):
        print(f"⚠️  WARNING: {output_path} already exists. Will not overwrite running missions.", file=sys.stderr)
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
            existing_id = existing.get("id", "")
            if existing_id == mission_id:
                print(f"   Mission {mission_id} already has a mission.json file. Skipping.", file=sys.stderr)
                sys.exit(0)
        except (json.JSONDecodeError, IOError):
            pass
        print(f"   Overwriting {output_path}...")

    # Write mission.json
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(mission_json, f, ensure_ascii=False, indent=2)

    print(f"✅ Written to {output_path}")
    print(f"   Contains NO status/state fields (Pump Runner handles those).")


if __name__ == "__main__":
    main()
