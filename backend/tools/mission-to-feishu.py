#!/usr/bin/env python3
"""
mission-to-feishu.py — Write Pump Runner mission execution results back to Feishu Mission Board.

Reads mission.state and mission.data.json from the .missions directory,
then updates the corresponding Feishu spreadsheet row with execution results.

Only writes cells that actually changed (smart diff).

Usage:
    python mission-to-feishu.py --mission-id <id> --board <token> --sheet <sheet_id> --row <row>

Dependencies: Python 3.10+, requests
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Optional

try:
    import requests
except ImportError:
    print("FATAL: requests library not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

FEISHU_BASE_URL = "https://open.feishu.cn/open-apis"

# Columns we are allowed to write (Mission Board schema A-M):
#   A (Mission ID)   — READ ONLY
#   B (Mission Name) — NOT written by this script
#   C (Description)  — READ ONLY
#   D (Status)       — WRITABLE: state["status"]
#   E (Owner)        — User managed
#   F (Executor)     — User managed
#   G (Priority)     — User managed
#   H (Created Time) — READ ONLY
#   I (Started Time) — WRITABLE: state.get("started_at", "")
#   J (Finished Time) — WRITABLE: only when status is COMPLETED/FAILED
#   K (Evidence Link) — WRITABLE: constructed from mission_id
#   L (Result)        — WRITABLE: summary or status
#   M (Tag)           — User managed

WRITABLE_COLUMNS: dict[str, str] = {
    "D": "Status",
    "I": "Started Time",
    "J": "Finished Time",
    "K": "Evidence Link",
    "L": "Result",
}


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


# ── Mission state helpers ─────────────────────────────────────────

MISSIONS_DIR = os.path.join(os.getcwd(), ".missions")


def _find_mission_dir(mission_id: str) -> str:
    """Return the mission directory path for a given mission ID."""
    return os.path.join(MISSIONS_DIR, mission_id)


def read_mission_state(mission_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Read mission state and data files.

    Reads:
      - .missions/{mission-id}/mission.state  (Pump Runner state)
      - .missions/{mission-id}/mission.data.json  (execution data)

    Returns:
        Tuple of (state_dict, data_dict). data_dict may be empty if file is missing.

    Raises:
        SystemExit: If mission.state file is not found.
    """
    mission_dir = _find_mission_dir(mission_id)
    state_path = os.path.join(mission_dir, "mission.state")
    data_path = os.path.join(mission_dir, "mission.data.json")

    if not os.path.exists(state_path):
        print(f"ERROR: Mission state file not found: {state_path}", file=sys.stderr)
        sys.exit(1)

    with open(state_path, "r", encoding="utf-8") as f:
        state = json.load(f)

    data: dict[str, Any] = {}
    if os.path.exists(data_path):
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        print(f"WARNING: Mission data file not found: {data_path}", file=sys.stderr)

    return state, data


# ── Feishu API helpers ────────────────────────────────────────────

def read_row(board_token: str, sheet_id: str, row: int, token: str) -> list[str]:
    """Read a single row from the board. Row is 1-based."""
    url = f"{FEISHU_BASE_URL}/sheets/v2/spreadsheets/{board_token}/values/{sheet_id}!A{row}:M{row}"
    resp = requests.get(url, headers=get_headers(token), timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        print(f"ERROR: Failed to read row {row}: {data}", file=sys.stderr)
        sys.exit(1)
    values = data.get("data", {}).get("valueRange", {}).get("values", [])
    if not values:
        return [""] * 13
    row_data = list(values[0])
    while len(row_data) < 13:
        row_data.append("")
    return row_data


def write_cell(board_token: str, sheet_id: str, cell: str, value: str, token: str) -> bool:
    """Write a single cell value. Returns True on success.
    
    Note: v2 values API requires range format 'Sheet!ColRow:ColRow'
    (e.g. '40e76d!D2:D2'), not just '40e76d!D2'.
    """
    url = f"{FEISHU_BASE_URL}/sheets/v2/spreadsheets/{board_token}/values"
    body = {
        "valueRange": {
            "range": f"{sheet_id}!{cell}:{cell}",
            "values": [[value]],
        }
    }
    resp = requests.put(url, headers=get_headers(token), json=body, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        print(f"  ✗ Failed to write {cell}: {data.get('msg', 'unknown error')}", file=sys.stderr)
        return False
    return True


# ── Core logic ────────────────────────────────────────────────────

def determine_values_to_write(state: dict[str, Any], data: dict[str, Any], mission_id: str) -> dict[str, str]:
    """
    Determine what values to write to which cells based on mission state and data.

    Args:
        state: mission.state dict from Pump Runner.
        data: mission.data.json dict (may be empty).
        mission_id: The mission ID for constructing evidence path.

    Returns:
        Dict mapping column letters to string values.
    """
    result: dict[str, str] = {}

    # D — Status
    status = state.get("status", "")
    if status:
        result["D"] = status

    # I — Started Time
    started_at = state.get("started_at", "")
    if started_at:
        result["I"] = started_at

    # J — Finished Time (only when terminal status)
    if status in ("COMPLETED", "FAILED", "ABORTED"):
        updated_at = state.get("updated_at", "")
        if updated_at:
            result["J"] = updated_at

    # K — Evidence Link
    evidence_path = f".missions/{mission_id}/evidence/"
    result["K"] = evidence_path

    # L — Result
    summary = data.get("summary", "") if data else ""
    if summary:
        result["L"] = summary
    elif status:
        result["L"] = f"Status: {status}"

    return result


# ── CLI ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Write Pump Runner mission results back to Feishu Mission Board."
    )
    parser.add_argument(
        "--mission-id", required=True,
        help="Mission ID (directory name under .missions/)"
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
        help="Row number to update (1-based)"
    )
    args = parser.parse_args()

    print(f"🔍 Mission ID: {args.mission_id}")
    print(f"   Board: {args.board}")
    print(f"   Sheet: {args.sheet}")
    print(f"   Row:   {args.row}")
    print()

    # 1. Read mission state
    print("📂 Reading mission state...")
    state, data = read_mission_state(args.mission_id)
    print(f"   State status: {state.get('status', '(none)')}")
    print(f"   Data keys: {list(data.keys()) if data else '(empty)'}")
    print()

    # 2. Authenticate
    print("🔐 Getting tenant_access_token...")
    token = get_tenant_access_token()
    print("✅ Authenticated")
    print()

    # 3. Read current row values from Feishu
    print("📋 Reading current row values from Feishu...")
    current_row = read_row(args.board, args.sheet, args.row, token)
    print(f"   Read {len(current_row)} columns")
    print()

    # 4. Determine what to write
    values_to_write = determine_values_to_write(state, data, args.mission_id)
    print(f"📝 Values to write ({len(values_to_write)} cells):")
    for col, val in sorted(values_to_write.items()):
        print(f"   {col} ({WRITABLE_COLUMNS.get(col, '?')}): {repr(val)}")
    print()

    # 5. Smart write: only write cells that actually changed
    changes_made = 0
    errors = 0
    for col, new_value in sorted(values_to_write.items()):
        idx = ord(col) - 65  # A=0, B=1, ...
        if idx >= len(current_row):
            print(f"   {col}: column out of range (current row has {len(current_row)} cols) — skipping")
            continue

        current_value = current_row[idx]
        if current_value == new_value:
            print(f"   {col}: already '{new_value}' — no change needed")
            continue

        full_cell = f"{col}{args.row}"
        print(f"   Writing {full_cell}: {repr(current_value)} → {repr(new_value)}...", end=" ")
        if write_cell(args.board, args.sheet, full_cell, new_value, token):
            print("✓")
            changes_made += 1
        else:
            print("✗")
            errors += 1

    print()
    print(f"📊 Summary: {changes_made} cells updated, {errors} errors")
    if errors:
        sys.exit(1)
    print("✅ Done")


if __name__ == "__main__":
    main()
