# EventValidation

> **Generated**: 2026-07-15T08:37:59.885Z

## Summary

| Severity | Count |
|----------|------:|
| PASS     | 6 |
| FAIL     | 0 |
| WARNING  | 1 |

**Result: PASS (with warnings)**

---

## Details

### ✅ WP2.1: Every EventCatalog event has EventSchema entry

- **Severity**: PASS
- **Details**: All 24 catalog events have schema entries

### ✅ WP2.2: CURRENT/DESIGNED events have event class in code

- **Severity**: PASS
- **Details**: All 11 CURRENT/DESIGNED events have code classes

### ⚠️ WP2.3: Event class fields match Schema payload fields

- **Severity**: WARNING
- **Details**: lesson.completed: in schema but not class: attendance; lesson.finished: in schema but not class: attendance

### ✅ WP2.4: Every publish() call has event registered in EventCatalog

- **Severity**: PASS
- **Details**: All 2 publish() calls are registered

### ✅ WP2.5: Publish payload fields match Schema defined fields

- **Severity**: PASS
- **Details**: All 2 publish payloads match schemas

### ✅ WP2.6: No orphan event classes (code classes not in Catalog)

- **Severity**: PASS
- **Details**: All 11 event classes are cataloged

### ✅ WP2.7: CURRENT status accuracy (only events with publish() calls)

- **Severity**: PASS
- **Details**: All 2 CURRENT events have publish() calls
