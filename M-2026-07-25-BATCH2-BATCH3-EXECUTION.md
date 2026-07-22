# M-2026-07-25-BATCH2-BATCH3-EXECUTION

## Decision Reference
DR-2026-07-25-001
Owner Decision: Batch2-Course=A, Batch2-Enrollment=A, Batch3-ClassCode=A

## Executor
CC Executor

## Scope

### Task 1: Course Enrichment — Backend
Add lessonCount (alias for totalLessons) and enrolledClasses to GET /courses and GET /courses/:code responses.

Files to modify:
- teaching/course/course.repository.ts — add countActiveByCourseCode + countActiveByCourseCodes
- teaching/course/course.service.ts — add enrichCourses + enrichCourse
- teaching/course/course.controller.ts — findAll/findOne call enrichment

### Task 2: Enrollment Enrichment — Backend  
Add className, courseName, completedLessons, totalLessons to enrollment endpoints.

Files to modify:
- teaching/enrollment/enrollment.repository.ts — add batch query methods
- teaching/enrollment/enrollment.service.ts — add enrichEnrollments
- teaching/enrollment/enrollment.controller.ts — call enrichment

### Task 3: Student ClassCode — Frontend
Use real classCode and teacherName from backend GET /students/self/contracts response.

Files to modify:
- miniapp/pages/student/classes.js — use c.classCode instead of 'CT'+c.contractCode, use c.teacherName
- miniapp/pages/student/class-detail.js — remove fake code matching, use real classCode

## Constraints
- No entity changes (no new columns)
- No route changes
- No mock data changes
- 935 tests must remain ALL PASS

## Output
- Modified file list
- Test results
- Git commit
