# Governance Friction Log

> **Version**: v1.0.0
> **Sprint**: 4.1.7 (Governance Validation)
> **Purpose**: Record every governance friction point encountered during real business development. This log is the **sole input** for Sprint 4.2 Architecture Automation.

---

## GF-001

| | |
|---|---|
| **Scenario** | Implementing event publishing in LessonService |
| **Problem** | `EventBusService.publish()` takes `payload: any`. No type safety on event payloads. Publisher can pass any shape without compile-time error. |
| **Impact** | Risk of payload mismatch between publisher and EventSchema. Only caught at runtime or during code review. |
| **Root Cause** | EventBusService.publish() signature uses `any` type |
| **Automation Candidate** | Typed publish<T>() generic on EventBusService, enforced by lint rule |
| **Priority** | P1 |

---

## GF-002

| | |
|---|---|
| **Scenario** | Creating event classes (LessonCompletedEvent, LessonFinishedEvent) |
| **Problem** | Event classes have constructors, but `EventBusService.publish()` takes a plain object. The event class constructors are never called by the service. They exist as data carriers but aren't used in the publish flow. |
| **Impact** | Event classes are dead code in the publish path. Payload shape is defined by the plain object passed to `publish()`, not by the class. |
| **Root Cause** | EventBusService was designed before event classes existed. No contract enforcement between class and publish call. |
| **Automation Candidate** | Generate event classes from EventSchema, or enforce that publish() accepts an event class instance |
| **Priority** | P2 |

---

## GF-003

| | |
|---|---|
| **Scenario** | Updating LessonFinishedEvent to match EventSchema |
| **Problem** | Existing event class had `campusId` field that doesn't exist in EventSchema or LessonEntity. Had to manually discover and fix the mismatch. |
| **Impact** | Event class was out of sync with EventSchema. Would have caused runtime issues if used. |
| **Root Cause** | No automated check that event classes match EventSchema definitions |
| **Automation Candidate** | Auto-generate event classes from EventSchema.md, or CI check that class fields match schema |
| **Priority** | P1 |

---

## GF-004

| | |
|---|---|
| **Scenario** | Writing tests for event publishing |
| **Problem** | Jest can't parse `uuid` ESM module (used by EventBusService). Had to add `jest.mock('uuid')` in every test file that imports EventBusService. |
| **Impact** | Every test file that tests event publishing needs the same boilerplate mock. Easy to forget. |
| **Root Cause** | `uuid` package uses ESM exports, Jest config doesn't have `transformIgnorePatterns` for it |
| **Automation Candidate** | Add `transformIgnorePatterns` to Jest config, or create shared test helper that mocks uuid |
| **Priority** | P2 |

---

## GF-005

| | |
|---|---|
| **Scenario** | Writing tests for event publishing |
| **Problem** | ESLint `unbound-method` rule triggers on `eventBus.publish.mock.calls`. Can't destructure mock methods from the mock object. Had to restructure tests to use standalone `jest.fn()`. |
| **Impact** | Test authoring requires non-obvious patterns to satisfy ESLint. Knowledge barrier for new contributors. |
| **Root Cause** | ESLint unbound-method rule is strict about method extraction from objects, even for jest mocks |
| **Automation Candidate** | Create shared test utility (e.g., `createMockEventBus()`) that returns standalone functions |
| **Priority** | P3 |

---

## GF-006

| | |
|---|---|
| **Scenario** | Updating EventCatalog after implementing event chain |
| **Problem** | Had to manually verify that EventCatalog, EventSchema, code event classes, and LessonService all agree on event names, owners, and payload fields. |
| **Impact** | Manual cross-referencing is error-prone and time-consuming. Risk of drift between documents and code. |
| **Root Cause** | No automated consistency check between EventCatalog/EventSchema and actual code |
| **Automation Candidate** | Script that parses EventCatalog.md + EventSchema.md and compares against event classes + publish() calls |
| **Priority** | P1 |

---

## GF-007

| | |
|---|---|
| **Scenario** | Adding EventBusModule dependency to LessonModule |
| **Problem** | Had to manually remember to import EventBusModule into LessonModule. No compile-time error if forgotten (would fail at runtime only). |
| **Impact** | Missing module import causes runtime DI error, not compile-time. |
| **Root Cause** | NestJS DI is runtime, not compile-time. No static analysis for module dependencies. |
| **Automation Candidate** | Lint rule or architecture test that verifies modules using EventBusService import EventBusModule |
| **Priority** | P2 |

---

## Summary

| Priority | Count | Examples |
|----------|-------|---------|
| P1 | 3 | Typed publish, schema-code sync, catalog-code consistency |
| P2 | 3 | Event class dead code, uuid mock boilerplate, module import check |
| P3 | 1 | Jest mock patterns |

**Key Insight**: The highest-value automation targets are **P1 items** — they address structural gaps that could cause production bugs. P2/P3 items are convenience improvements.

**Recommendation for Sprint 4.2**: Focus on P1 automation first:
1. Typed `EventBusService.publish<T>()` (GF-001)
2. Event class generation from EventSchema (GF-002, GF-003)
3. EventCatalog/Schema vs code consistency checker (GF-006)

---

*This log is append-only. New friction points are added as they are discovered during development.*
