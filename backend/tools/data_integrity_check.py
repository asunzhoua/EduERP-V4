#!/usr/bin/env python3
"""Phase 3 Batch 3.1: Data Integrity Check Script"""
import pymysql
import json

conn = pymysql.connect(
    host='localhost', port=3306, user='root', password='sun123456', database='EduOS',
    cursorclass=pymysql.cursors.DictCursor
)
cursor = conn.cursor()

issues = []

def check(name, sql, expect_zero=True):
    cursor.execute(sql)
    rows = cursor.fetchall()
    count = len(rows)
    status = "[OK]" if (count == 0) == expect_zero else "[FAIL]"
    if status == "❌":
        issues.append({"check": name, "count": count, "data": rows})
    print(f"\n{'='*60}")
    print(f"{status} {name} (found {count} rows)")
    if rows:
        for r in rows:
            print(f"  {r}")
    return count, rows

print("=" * 60)
print("PHASE 3 BATCH 3.1: DATA INTEGRITY CHECK")
print("=" * 60)

# ============================================
# 1. 空数据检查
# ============================================
print("\n\n### 1. EMPTY DATA CHECKS ###")

check("User: empty/null name or username",
      "SELECT id, username, name, role FROM user WHERE name = '' OR name IS NULL OR username = '' OR username IS NULL")

check("Student: empty/null name or studentCode",
      "SELECT id, studentCode, name FROM student WHERE name = '' OR name IS NULL OR studentCode = '' OR studentCode IS NULL")

check("Course: empty/null name or courseCode",
      "SELECT id, courseCode, name FROM course WHERE name = '' OR name IS NULL OR courseCode = '' OR courseCode IS NULL")

check("Class: empty/null name or classCode",
      "SELECT id, classCode, name FROM class WHERE name = '' OR name IS NULL OR classCode = '' OR classCode IS NULL")

check("Contract: empty contractCode",
      "SELECT id, contractCode, studentCode FROM contract WHERE contractCode = '' OR contractCode IS NULL")

# ============================================
# 2. 测试数据残留
# ============================================
print("\n\n### 2. TEST DATA RESIDUAL CHECKS ###")

check("User: test/debug data",
      "SELECT id, username, name, role FROM user WHERE username LIKE 'test%' OR name LIKE 'test%' OR username LIKE '%debug%'")

check("Student: test data",
      "SELECT id, studentCode, name FROM student WHERE name LIKE 'test%' OR studentCode LIKE 'test%'")

check("Course: test data",
      "SELECT id, courseCode, name FROM course WHERE name LIKE 'test%' OR courseCode LIKE 'test%'")

check("Class: test data",
      "SELECT id, classCode, name FROM class WHERE name LIKE 'test%' OR classCode LIKE 'test%'")

# ============================================
# 3. 无关联数据（孤儿记录）
# ============================================
print("\n\n### 3. ORPHAN DATA CHECKS ###")

# Course -> no teacherId in this schema, course has no teacherId column
# Class -> courseCode references course
check("Class: no matching course (orphan courseCode)",
      "SELECT cl.id, cl.classCode, cl.name, cl.courseCode FROM class cl LEFT JOIN course c ON cl.courseCode = c.courseCode WHERE c.id IS NULL AND cl.deleted = 0")

# Enrollment -> studentCode + classCode + contractCode
check("Enrollment: no matching student (orphan studentCode)",
      "SELECT e.id, e.classCode, e.studentCode, e.contractCode FROM enrollment e LEFT JOIN student s ON e.studentCode = s.studentCode WHERE s.id IS NULL")

check("Enrollment: no matching class (orphan classCode)",
      "SELECT e.id, e.classCode, e.studentCode, e.contractCode FROM enrollment e LEFT JOIN class cl ON e.classCode = cl.classCode WHERE cl.id IS NULL")

check("Enrollment: no matching contract (orphan contractCode)",
      "SELECT e.id, e.classCode, e.studentCode, e.contractCode FROM enrollment e LEFT JOIN contract ct ON e.contractCode = ct.contractCode WHERE ct.id IS NULL")

# Lesson -> classCode + teacherId
check("Lesson: no matching class (orphan classCode)",
      "SELECT l.id, l.classCode, l.lessonNumber, l.teacherId FROM lesson l LEFT JOIN class cl ON l.classCode = cl.classCode WHERE cl.id IS NULL")

check("Lesson: no matching teacher (orphan teacherId)",
      "SELECT l.id, l.classCode, l.lessonNumber, l.teacherId FROM lesson l LEFT JOIN user u ON l.teacherId = u.id WHERE u.id IS NULL")

# Attendance -> lessonId + studentCode
check("Attendance: no matching lesson (orphan lessonId)",
      "SELECT a.id, a.lessonId, a.studentCode, a.classCode FROM lesson_attendance a LEFT JOIN lesson l ON a.lessonId = l.id WHERE l.id IS NULL")

check("Attendance: no matching student (orphan studentCode)",
      "SELECT a.id, a.lessonId, a.studentCode, a.classCode FROM lesson_attendance a LEFT JOIN student s ON a.studentCode = s.studentCode WHERE s.id IS NULL")

# TeacherAssignment -> classCode + teacherId
check("TeacherAssignment: no matching class (orphan classCode)",
      "SELECT ta.id, ta.classCode, ta.teacherId, ta.role FROM teacher_assignment ta LEFT JOIN class cl ON ta.classCode = cl.classCode WHERE cl.id IS NULL")

check("TeacherAssignment: no matching teacher (orphan teacherId)",
      "SELECT ta.id, ta.classCode, ta.teacherId, ta.role FROM teacher_assignment ta LEFT JOIN user u ON ta.teacherId = u.id WHERE u.id IS NULL")

# Contract -> studentCode
check("Contract: no matching student (orphan studentCode)",
      "SELECT ct.id, ct.contractCode, ct.studentCode FROM contract ct LEFT JOIN student s ON ct.studentCode = s.studentCode WHERE s.id IS NULL")

# ============================================
# 4. 字段一致性检查
# ============================================
print("\n\n### 4. FIELD CONSISTENCY CHECKS ###")

check("Lesson: null scheduledDate",
      "SELECT id, scheduledDate FROM lesson WHERE scheduledDate IS NULL")

check("Attendance: invalid status values",
      "SELECT id, status FROM lesson_attendance WHERE status IS NOT NULL AND status NOT IN ('PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'MAKEUP', 'ONLINE', 'OFFLINE')")

check("Lesson: negative or zero lessonNumber",
      "SELECT id, lessonNumber FROM lesson WHERE lessonNumber <= 0")

check("Contract: remainingLessons > totalLessons (inconsistent)",
      "SELECT id, contractCode, totalLessons, remainingLessons FROM contract WHERE remainingLessons > totalLessons")

check("Contract: negative remainingLessons",
      "SELECT id, contractCode, remainingLessons FROM contract WHERE remainingLessons < 0")

check("Contract: negative unitPrice or totalAmount",
      "SELECT id, contractCode, unitPrice, totalAmount FROM contract WHERE unitPrice < 0 OR totalAmount < 0")

check("Lesson: startTime >= endTime",
      "SELECT id, startTime, endTime FROM lesson WHERE startTime >= endTime AND startTime IS NOT NULL AND endTime IS NOT NULL")

check("Class: startTime >= endTime",
      "SELECT id, startTime, endTime FROM class WHERE startTime >= endTime AND startTime IS NOT NULL AND endTime IS NOT NULL")

# ============================================
# 5. 数据完整性（业务逻辑）
# ============================================
print("\n\n### 5. BUSINESS INTEGRITY CHECKS ###")

# Student without enrollment
check("Student: no enrollment records",
      """SELECT s.id, s.studentCode, s.name FROM student s 
         WHERE NOT EXISTS (SELECT 1 FROM enrollment e WHERE e.studentCode = s.studentCode)
         AND s.deleted = 0""",
      expect_zero=False)  # This is informational, not necessarily an error

# Class without lessons
check("Class: no lesson records",
      """SELECT cl.id, cl.classCode, cl.name FROM class cl
         WHERE NOT EXISTS (SELECT 1 FROM lesson l WHERE l.classCode = cl.classCode)
         AND cl.deleted = 0""",
      expect_zero=False)  # Informational

# Course without classes
check("Course: no class records",
      """SELECT c.id, c.courseCode, c.name FROM course c
         WHERE NOT EXISTS (SELECT 1 FROM class cl WHERE cl.courseCode = c.courseCode)
         AND c.deleted = 0""",
      expect_zero=False)  # Informational

# Teacher without assignments
check("Teacher: no teacher_assignment records",
      """SELECT u.id, u.username, u.name FROM user u
         WHERE u.role = 'Teacher'
         AND NOT EXISTS (SELECT 1 FROM teacher_assignment ta WHERE ta.teacherId = u.id)""",
      expect_zero=False)  # Informational

# Lesson without attendance records
check("Lesson: no attendance records (for FINISHED lessons)",
      """SELECT l.id, l.classCode, l.lessonNumber, l.status FROM lesson l
         WHERE l.status = 'FINISHED'
         AND NOT EXISTS (SELECT 1 FROM lesson_attendance a WHERE a.lessonId = l.id)""",
      expect_zero=False)  # Informational

# ============================================
# 6. Duplicate data check
# ============================================
print("\n\n### 6. DUPLICATE DATA CHECKS ###")

check("Student: duplicate studentCode",
      "SELECT studentCode, COUNT(*) as cnt FROM student GROUP BY studentCode HAVING cnt > 1")

check("Course: duplicate courseCode",
      "SELECT courseCode, COUNT(*) as cnt FROM course GROUP BY courseCode HAVING cnt > 1")

check("Class: duplicate classCode",
      "SELECT classCode, COUNT(*) as cnt FROM class GROUP BY classCode HAVING cnt > 1")

check("Contract: duplicate contractCode",
      "SELECT contractCode, COUNT(*) as cnt FROM contract GROUP BY contractCode HAVING cnt > 1")

# ============================================
# 7. Soft-deleted data check
# ============================================
print("\n\n### 7. SOFT-DELETED DATA CHECKS ###")

check("Student: soft-deleted records",
      "SELECT id, studentCode, name, deleted FROM student WHERE deleted = 1",
      expect_zero=False)

check("Course: soft-deleted records",
      "SELECT id, courseCode, name, deleted FROM course WHERE deleted = 1",
      expect_zero=False)

check("Class: soft-deleted records",
      "SELECT id, classCode, name, deleted FROM class WHERE deleted = 1",
      expect_zero=False)

# ============================================
# Summary
# ============================================
print("\n\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Total issues found: {len(issues)}")
if issues:
    print("\nIssues requiring attention:")
    for i, issue in enumerate(issues, 1):
        print(f"  {i}. {issue['check']} ({issue['count']} rows)")
else:
    print("No critical issues found!")

cursor.close()
conn.close()
