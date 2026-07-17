# EduOS Core Business Flow

> **Version**: v0.1.0
> **Last Updated**: 2026-07-07
> **Purpose**: This document describes the end-to-end real business flow from enrollment to financial settlement. It does NOT describe database tables, API endpoints, or code structure. It exists to help all developers (human and AI) understand the business before reading the code.

---

## About This Document

This is not a technical document. It is a **business narrative**.

Every EduOS developer should read this first — before the Constitution, before the Business Rules, before any code. Understand how the business works, then the code will make sense.

---

## The Complete Business Flow

### Phase 1: A Parent Walks In

A parent comes to the front desk with their child.

> **Parent**: "I want to enroll my child in math classes."

**What happens in the real world:**
1. Admin checks if the student already exists in the system
2. If not, creates a new student profile (name, age, school, parent contact)
3. Parent chooses a course: "小学数学提高班"
4. Parent pays for 20 lessons
5. Admin creates a **Contract**: 20 math lessons for this student
6. Admin checks available class times
7. Admin assigns the student to **"Saturday 10am Class"**
8. Parent receives confirmation: student info, class time, remaining lessons

**What the system records:**
- Student ✓ (Student Domain)
- Contract: 20 lessons, math subject, ACTIVE ✓
- Enrollment: Student → Saturday 10am Class, funded by Contract ✓
- Parent notification (future)

### Phase 2: Before Each Lesson

> **Teacher**: "What am I teaching today?"

**Daily flow:**
1. Teacher opens the app/website
2. Sees their schedule: "10:00-11:30 — 周六班 — 数学 — 第5节课"
3. Sees the student list for today's lesson
4. Prepares teaching materials

### Phase 3: The Lesson Happens

> **Teacher**: "Class begins."

**Real-time flow:**
1. Teacher clicks **"Start Lesson"**
2. System marks lesson as **Teaching** (in progress)
3. Teacher takes attendance:
   - Most students: **Present** ✅
   - Xiao Ming: **Late** (arrived 20 min late)
   - Xiao Hua: **Leave Approved** (parent called ahead)
4. Teacher adds lesson notes: "Today covered Chapter 3, fractions. Homework: p45-48."
5. Teacher clicks **"Complete Lesson"**

**State change:** Lesson → **Finished**

### Phase 4: The First Event — LessonCompleted

> **System**: "Lesson #L20260712005 has been completed."

**Immediately:**
1. Lesson status → **Finished**
2. Attendance records saved (Present, Present, Late, Leave Approved)
3. **LessonCompleted** event emitted via EventBus
4. Dashboard updates: "Today: 3 lessons completed"
5. No money moves yet.

> Why no money? Because the admin hasn't confirmed yet. Maybe the parent calls later to say Xiao Ming was absent, not late. The Finished state allows corrections.

### Phase 5: Review & Confirmation

> **Admin**: "Let me check today's lessons."

**Review window** (configurable, default: 24 hours):
1. Admin reviews each Finished lesson
2. Checks attendance accuracy
3. Corrects if needed (e.g., Xiao Ming was actually Absent, not Late)
4. If everything is correct, admins can **auto-approve** or wait for timeout

**Auto-approval:** If no corrections within 24 hours, lesson auto-transitions to **Archived**.

### Phase 6: The Second Event — LessonFinished

> **System**: "Lesson #L20260712005 has been confirmed. Money can move."

**When lesson → Archived:**
1. **LessonFinished** event emitted
2. **Contract deduction:** -1 lesson from Xiao Ming's Contract
3. **Teacher salary:** +1 lesson pay for the teacher
4. **Points:** Students who attended get +10 points each
5. **Notifications:** Parents notified of completed lesson
6. **Dashboard:** Financial metrics updated

> **This is the ONLY event that moves money.** Not LessonCompleted. Only LessonFinished.

### Phase 7: Ongoing Tracking

**For the parent:**
- Opens WeChat mini-program
- Sees: "Your child has 15 remaining lessons"
- Sees: "Last lesson: Completed Saturday 10am — Present ✓"
- Sees: "Next lesson: Next Saturday 10am"

**For the teacher:**
- Sees: "This month: 24 lessons × ¥80 = ¥1,920 salary"
- Sees: "Next week: 8 lessons scheduled"

**For the boss:**
- Opens dashboard
- Sees: "Today: 3 lessons, ¥480 revenue, ¥240 teacher cost"
- Sees: "This month: 320 lessons, 92% attendance rate"
- Sees: "5 contracts expiring this week — renewal reminder"

---

## Edge Cases

### Student Absence (Leave Approved)

```
Lesson starts
  → Teacher marks Xiao Hua as LEAVE_APPROVED
  → Lesson → FINISHED
  → LessonCompleted emitted
  → Admin reviews
  → Lesson → ARCHIVED
  → LessonFinished emitted
  → Contract: NO deduction (leave = no charge)
  → Makeup lesson scheduled for next week
  → Makeup lesson: CREATE new lesson, originLessonId links back
```

### Mid-Term Class Change

```
Student moves from "Saturday 10am" to "Sunday 2pm"
  → New Enrollment created (same Contract)
  → Old Enrollment → WITHDRAWN
  → Contract unchanged (15 lessons remaining)
  → Future lessons deducted from same Contract
```

### Refund

```
Parent requests refund with 12 of 20 lessons used
  → Finance domain calculates: 8 unused × ¥80 = ¥640 refund
  → Contract → REFUNDED
  → Remaining enrollment → WITHDRAWN
  → All future lessons → CANCELLED
  → Audit trail: every deduction traceable to a Lesson ID
```

### System Crash During Lesson

```
Teacher completes lesson
  → System crashes before LessonFinished event
  → Lesson is in FINISHED state (not ARCHIVED)
  → No money moved
  → Admin reviews, sees FINISHED lesson, manually confirms
  → Lesson → ARCHIVED
  → LessonFinished emitted
  → Normal flow resumes
```

---

## Business Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PARENT WALKS IN                               │
│  Student exists? → Create Student → Choose Course → Pay →       │
│  Create Contract (20 lessons) → Assign to Class                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE LESSON                                 │
│  Teacher checks schedule → Prepares materials                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LESSON EXECUTION                              │
│  Start Lesson (Teaching) → Take Attendance → Complete Lesson    │
│  Lesson → FINISHED → LessonCompleted Event                      │
│  Status: ⏳ Teaching done. Money stays.                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REVIEW WINDOW (24h default)                   │
│  Admin reviews attendance → Corrects if needed                  │
│  Auto-approve on timeout                                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FINANCIAL SETTLEMENT                          │
│  Lesson → ARCHIVED → LessonFinished Event                       │
│                                                                  │
│  ┌─────────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │
│  │ Contract    │  │ Teacher  │  │ Points    │  │ Dashboard  │  │
│  │ -1 lesson  │  │ +¥80     │  │ +10       │  │ Updated    │  │
│  └─────────────┘  └──────────┘  └───────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ONGOING                                       │
│  Parent: Check balance → View progress                         │
│  Teacher: View salary → Upcoming schedule                       │
│  Boss: Dashboard → Analytics → Insights                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Design Principles Illustrated

| Principle | Where It Appears |
|---|---|
| **Reality First** | Teacher completes → System reacts. Not admin clicking "deduct". |
| **Event First** | LessonCompleted → review → LessonFinished → everything else |
| **Document First** | Contract is the financial document. All deductions reference it. |
| **Rule 19** | Every flow above revolves around Lesson. Not Class, not Course. |
| **Rule 20** | Every money movement traces back to a Lesson ID. |
| **Two-Phase Safety** | LessonCompleted (teaching) ≠ LessonFinished (money). Always a review gate. |

---

*This document was created during the Teaching Domain Design Freeze v1.1. It should be updated as the system evolves. It is the recommended first-read for any new developer joining the project.*
