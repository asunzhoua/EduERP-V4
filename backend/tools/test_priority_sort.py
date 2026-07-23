"""
test_priority_sort.py — Batch 4.1 优先级排序逻辑测试

测试覆盖:
1. PRIORITY_ORDER 常量正确性
2. get_mission_priority() 返回值
3. sort_missions_by_priority() 排序正确性
4. get_next_mission() 选择逻辑
5. check_mission_priority_queue() 输出完整性
"""

import json
import os
import sys
import tempfile
import shutil

# 添加 tools 目录到 path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from heartbeat_check import (
    PRIORITY_ORDER,
    PRIORITY_LABELS,
    get_mission_priority,
    sort_missions_by_priority,
    get_next_mission,
    check_mission_priority_queue,
    _load_all_mission_states,
)


def test_priority_order():
    """测试 1: PRIORITY_ORDER 常量"""
    print("Test 1: PRIORITY_ORDER 常量...")
    assert PRIORITY_ORDER["P0"] == 0, "P0 should be 0 (highest)"
    assert PRIORITY_ORDER["P1"] == 1, "P1 should be 1"
    assert PRIORITY_ORDER["P2"] == 2, "P2 should be 2"
    assert PRIORITY_ORDER["P3"] == 3, "P3 should be 3 (lowest)"
    assert PRIORITY_ORDER["P0"] < PRIORITY_ORDER["P3"], "P0 < P3 in sort order"
    print("  PASS: P0(0) < P1(1) < P2(2) < P3(3)")


def test_priority_labels():
    """测试 2: PRIORITY_LABELS 完整性"""
    print("Test 2: PRIORITY_LABELS 完整性...")
    for key in ["P0", "P1", "P2", "P3"]:
        assert key in PRIORITY_LABELS, f"{key} missing from PRIORITY_LABELS"
        assert len(PRIORITY_LABELS[key]) > 0, f"{key} label is empty"
    print(f"  PASS: All 4 priority labels defined")
    for k, v in PRIORITY_LABELS.items():
        print(f"    {k}: {v}")


def test_load_missions():
    """测试 3: 加载 Mission 状态"""
    print("Test 3: 加载 Mission 状态...")
    states = _load_all_mission_states()
    assert len(states) > 0, "Should load at least 1 mission"
    print(f"  PASS: Loaded {len(states)} missions from dual directories")

    # 检查去重
    ids = [s.get("mission_id") for s in states]
    assert len(ids) == len(set(ids)), f"Duplicate mission IDs found: {ids}"
    print(f"  PASS: No duplicate mission IDs")


def test_sort_by_priority():
    """测试 4: 按优先级排序"""
    print("Test 4: 按优先级排序...")
    sorted_missions = sort_missions_by_priority()
    assert len(sorted_missions) > 0, "Should have missions to sort"

    # 验证排序顺序
    prev_priority_val = -1
    prev_created = ""
    for m in sorted_missions:
        p = m.get("priority", "P2")
        p_val = PRIORITY_ORDER.get(p, 99)
        c = m.get("created_at", "9999-99-99")[:19]

        if p_val > prev_priority_val:
            # 新优先级，重置 created_at 比较
            prev_created = ""
        elif p_val == prev_priority_val:
            # 同优先级，检查 created_at 递增
            assert c >= prev_created, (
                f"Same priority but created_at not ascending: "
                f"{prev_created} > {c}"
            )

        prev_priority_val = p_val
        prev_created = c

    print(f"  PASS: {len(sorted_missions)} missions correctly sorted")
    for m in sorted_missions:
        mid = m.get("mission_id", "?")[:50]
        p = m.get("priority", "?")
        print(f"    [{p}] {mid}")


def test_sort_with_filter():
    """测试 5: 状态过滤排序"""
    print("Test 5: 状态过滤排序...")
    running = sort_missions_by_priority(status_filter={"RUNNING"})
    pending = sort_missions_by_priority(status_filter={"CREATED", "PENDING"})
    completed = sort_missions_by_priority(status_filter={"COMPLETED"})

    # 验证过滤结果
    for m in running:
        assert m.get("status") == "RUNNING", f"Filter failed: {m.get('status')}"
    for m in pending:
        assert m.get("status") in ("CREATED", "PENDING"), f"Filter failed: {m.get('status')}"
    for m in completed:
        assert m.get("status") == "COMPLETED", f"Filter failed: {m.get('status')}"

    print(f"  PASS: RUNNING={len(running)}, PENDING={len(pending)}, COMPLETED={len(completed)}")


def test_get_next_mission():
    """测试 6: 获取下一个 Mission"""
    print("Test 6: 获取下一个 Mission...")
    next_m = get_next_mission()
    if next_m:
        print(f"  Next: [{next_m.get('priority', '?')}] {next_m.get('mission_id', '?')}")
        assert next_m.get("status") in ("CREATED", "PENDING"), "Next should be CREATED/PENDING"
    else:
        print(f"  Next: None (no pending missions)")
    print(f"  PASS: get_next_mission() returned correctly")


def test_get_mission_priority():
    """测试 7: 获取单个 Mission 优先级"""
    print("Test 7: 获取单个 Mission 优先级...")
    states = _load_all_mission_states()
    if states:
        test_id = states[0].get("mission_id")
        priority = get_mission_priority(test_id)
        assert priority in PRIORITY_ORDER or priority == "P2", f"Unexpected priority: {priority}"
        print(f"  PASS: {test_id[:40]} -> {priority}")

    # 测试不存在的 Mission
    unknown_priority = get_mission_priority("NON-EXISTENT-MISSION")
    assert unknown_priority == "P2", f"Unknown mission should default to P2, got {unknown_priority}"
    print(f"  PASS: Unknown mission defaults to P2")


def test_priority_queue_check():
    """测试 8: 优先级队列检测输出"""
    print("Test 8: 优先级队列检测...")
    status, detail, notified = check_mission_priority_queue()
    assert status in ("OK", "WARNING"), f"Unexpected status: {status}"
    assert "当前 RUNNING" in detail, "Should contain RUNNING info"
    assert "待执行队列" in detail, "Should contain pending queue info"
    assert "下一个执行" in detail, "Should contain next mission info"
    print(f"  PASS: status={status}")
    print(f"  Detail:\n{detail}")


def main():
    print("=" * 60)
    print("  Batch 4.1 — Mission Priority Sorting Tests")
    print("=" * 60)

    tests = [
        test_priority_order,
        test_priority_labels,
        test_load_missions,
        test_sort_by_priority,
        test_sort_with_filter,
        test_get_next_mission,
        test_get_mission_priority,
        test_priority_queue_check,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"  FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
        print()

    print("=" * 60)
    print(f"  Results: {passed} passed, {failed} failed, {passed + failed} total")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
