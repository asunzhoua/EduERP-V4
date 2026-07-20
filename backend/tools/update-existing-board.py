#!/usr/bin/env python3
"""
update-existing-board.py — Patch PRODUCTION Mission Board to new 13-column schema.

Changes:
  H1: "Start Time"  → "Created Time"
  I1: "End Time"     → "Started Time"
  J1: "Evidence Link" → "Finished Time"
  K1: "Result"       → "Evidence Link"
  L1: "Tag"          → "Result"
  M1: (empty)        → "Tag"

Usage:
    python update-existing-board.py --board-token <token> [--dry-run]

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

# Column letter → old header → new header mapping (A-M, zero-indexed by column index)
COLUMN_MAPPING: list[tuple[str, str, str]] = [
    ("H", "Start Time", "Created Time"),
    ("I", "End Time", "Started Time"),
    ("J", "Evidence Link", "Finished Time"),
    ("K", "Result", "Evidence Link"),
    ("L", "Tag", "Result"),
    ("M", "", "Tag"),
]


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


# ── Feishu API helpers ────────────────────────────────────────────

def get_spreadsheet_meta(board_token: str, token: str) -> tuple[str, str]:
    """Get spreadsheet meta, return (title, sheet_id_of_first_sheet)."""
    # Get title
    url = f"{FEISHU_BASE_URL}/sheets/v3/spreadsheets/{board_token}"
    resp = requests.get(url, headers=get_headers(token), timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        print(f"ERROR: Failed to read spreadsheet: {data}", file=sys.stderr)
        sys.exit(1)
    title = data["data"]["spreadsheet"]["title"]
    # Get sheet_id from sheets/query
    url = f"{FEISHU_BASE_URL}/sheets/v3/spreadsheets/{board_token}/sheets/query"
    resp = requests.get(url, headers=get_headers(token), timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0 or not data.get("data", {}).get("sheets"):
        print(f"ERROR: Failed to get sheet_id: {data}", file=sys.stderr)
        sys.exit(1)
    sheet_id = data["data"]["sheets"][0]["sheet_id"]
    return title, sheet_id


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
    # Pad to 13 columns
    row_data = list(values[0])
    while len(row_data) < 13:
        row_data.append("")
    return row_data


def write_cell(board_token: str, sheet_id: str, cell: str, value: str, token: str) -> bool:
    """Write a single cell value. Returns True on success.
    
    Note: v2 values API requires range format 'Sheet!ColRow:ColRow'
    (e.g. '40e76d!H1:H1'), not just '40e76d!H1'.
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


# ── Main ──────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Patch PRODUCTION Mission Board to new 13-column schema."
    )
    parser.add_argument(
        "--board-token", required=True,
        help="Production spreadsheet token (e.g. UTWZs3CKYhmkpotK3DDczrwDnId)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview changes without writing to Feishu"
    )
    args = parser.parse_args()

    print(f"🔍 Board token: {args.board_token}")
    print()

    # Authenticate
    print("🔐 Getting tenant_access_token...")
    token = get_tenant_access_token()
    print("✅ Authenticated")
    print()

    # Read spreadsheet meta
    print("📄 Reading spreadsheet meta...")
    title, sheet_id = get_spreadsheet_meta(args.board_token, token)
    print(f"   Title: {title}")
    print(f"   Sheet ID: {sheet_id}")
    print()

    # Read existing row 1 (headers)
    print("📋 Reading existing headers (row 1):")
    headers = read_row(args.board_token, sheet_id, 1, token)
    for i, h in enumerate(headers):
        letter = chr(65 + i)  # A=0, B=1, ...
        print(f"   {letter}1: {repr(h)}")
    print()

    # Show planned changes
    print("📝 Planned changes:")
    for col_letter, old_name, new_name in COLUMN_MAPPING:
        idx = ord(col_letter) - 65  # A=0
        actual_old = headers[idx] if idx < len(headers) else ""
        status = "✓" if actual_old == new_name else "→"
        print(f"   {col_letter}1: {repr(actual_old)} {status} {repr(new_name)}")

    print()

    if args.dry_run:
        print("🏁 --dry-run mode: No changes written.")
        sys.exit(0)

    # Execute changes
    print("✏️  Writing changes...")
    changes_made = 0
    errors = 0
    for col_letter, old_name, new_name in COLUMN_MAPPING:
        idx = ord(col_letter) - 65
        actual_old = headers[idx] if idx < len(headers) else ""
        if actual_old == new_name:
            print(f"   {col_letter}1: already '{new_name}' — skipping")
            continue
        full_cell = f"{col_letter}1"
        if write_cell(args.board_token, sheet_id, full_cell, new_name, token):
            print(f"   ✓ {full_cell}: {repr(actual_old)} → {repr(new_name)}")
            changes_made += 1
        else:
            errors += 1

    print()

    # Verification: re-read row 1
    print("🔍 Verifying updated headers (row 1):")
    new_headers = read_row(args.board_token, sheet_id, 1, token)
    for i, h in enumerate(new_headers):
        letter = chr(65 + i)
        print(f"   {letter}1: {repr(h)}")
    print()

    # Summary
    all_correct = True
    for col_letter, _, expected in COLUMN_MAPPING:
        idx = ord(col_letter) - 65
        actual = new_headers[idx] if idx < len(new_headers) else ""
        if actual != expected:
            print(f"   ❌ {col_letter}1: expected {repr(expected)}, got {repr(actual)}")
            all_correct = False

    if all_correct:
        print("✅ All headers updated successfully!")
    else:
        print("⚠️  Some headers did not match expected values.", file=sys.stderr)

    print(f"\n📊 Summary: {changes_made} cells changed, {errors} errors")
    sys.exit(0 if all_correct else 1)


if __name__ == "__main__":
    main()
