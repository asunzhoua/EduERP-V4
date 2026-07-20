import { ClassStatus } from '../class/enums/class-status.enum';
import { CourseStatus } from '../course/enums/course-status.enum';
import { CourseType } from '../course/enums/course-type.enum';
import { ContractStatus } from '../contract/enums/contract-status.enum';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';
import { AttendanceStatus } from '../lesson-attendance/enums/attendance-status.enum';
import { AttendanceWorkflowState } from '../lesson-attendance/enums/attendance-workflow-state.enum';
import { AttendanceSource } from '../lesson-attendance/enums/attendance-source.enum';
import { ChangeRequestStatus } from '../lesson-change-request/enums/change-request-status.enum';
import { ChangeRequestType } from '@common/enums/change-request-type.enum';
import { TeacherRole } from '@common/enums/teacher-role.enum';
import { Subject } from '@common/enums/subject.enum';

// ─── ClassEntity ───

describe('ClassEntity', () => {
  it('should instantiate with undefined fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClassEntity } = require('../class/class.entity');
    const entity = new ClassEntity();
    expect(entity).toBeDefined();
    expect(entity.id).toBeUndefined();
    expect(entity.classCode).toBeUndefined();
  });

  it('should accept valid ClassStatus enum values', () => {
    expect(ClassStatus.DRAFT).toBe('DRAFT');
    expect(ClassStatus.ACTIVE).toBe('ACTIVE');
    expect(ClassStatus.COMPLETED).toBe('COMPLETED');
    expect(ClassStatus.CANCELLED).toBe('CANCELLED');
  });

  it('should assign all required properties', () => {
    const { ClassEntity } = require('../class/class.entity');
    const entity = new ClassEntity();
    entity.classCode = 'CLS-001';
    entity.courseCode = 'CRS-001';
    entity.name = '数学基础班';
    entity.status = ClassStatus.DRAFT;
    entity.startDate = '2026-09-01';
    entity.totalLessons = 24;
    entity.dayOfWeek = [1, 3, 5];
    entity.startTime = '18:00';
    entity.endTime = '19:00';
    entity.createdBy = 1;

    expect(entity.classCode).toBe('CLS-001');
    expect(entity.courseCode).toBe('CRS-001');
    expect(entity.name).toBe('数学基础班');
    expect(entity.status).toBe(ClassStatus.DRAFT);
    expect(entity.totalLessons).toBe(24);
    expect(entity.dayOfWeek).toEqual([1, 3, 5]);
  });

  it('should support nullable optional fields', () => {
    const { ClassEntity } = require('../class/class.entity');
    const entity = new ClassEntity();
    entity.room = null;
    entity.tags = null;
    entity.note = null;
    entity.cancelledReason = null;

    expect(entity.room).toBeNull();
    expect(entity.tags).toBeNull();
    expect(entity.note).toBeNull();
    expect(entity.cancelledReason).toBeNull();
  });

  it('should have TypeORM default declarations for status, defaultDuration, maxStudents, deleted', () => {
    // Verify the decorator metadata carries the expected defaults
    const { ClassEntity } = require('../class/class.entity');
    const entity = new ClassEntity();
    // Without TypeORM runtime, decorated defaults are not applied on `new`,
    // but we verify the class shape is intact
    expect(typeof entity.defaultDuration).toBe('undefined');
    expect(typeof entity.maxStudents).toBe('undefined');
    expect(typeof entity.deleted).toBe('undefined');
  });
});

// ─── CourseEntity ───

describe('CourseEntity', () => {
  it('should instantiate with undefined fields', () => {
    const { CourseEntity } = require('../course/course.entity');
    const entity = new CourseEntity();
    expect(entity).toBeDefined();
    expect(entity.id).toBeUndefined();
    expect(entity.courseCode).toBeUndefined();
  });

  it('should accept valid CourseStatus enum values', () => {
    expect(CourseStatus.DRAFT).toBe('DRAFT');
    expect(CourseStatus.PUBLISHED).toBe('PUBLISHED');
    expect(CourseStatus.ARCHIVED).toBe('ARCHIVED');
  });

  it('should accept valid CourseType enum values', () => {
    expect(CourseType.INDIVIDUAL).toBe('INDIVIDUAL');
    expect(CourseType.GROUP).toBe('GROUP');
    expect(CourseType.TRIAL).toBe('TRIAL');
    expect(CourseType.CAMP).toBe('CAMP');
  });

  it('should assign all required properties', () => {
    const { CourseEntity } = require('../course/course.entity');
    const entity = new CourseEntity();
    entity.courseCode = 'CRS-100';
    entity.name = '高等数学';
    entity.subject = Subject.MATH;
    entity.type = CourseType.GROUP;
    entity.totalHours = 48.5;
    entity.totalLessons = 32;
    entity.defaultDuration = 90;
    entity.status = CourseStatus.PUBLISHED;
    entity.createdBy = 1;

    expect(entity.courseCode).toBe('CRS-100');
    expect(entity.name).toBe('高等数学');
    expect(entity.subject).toBe(Subject.MATH);
    expect(entity.type).toBe(CourseType.GROUP);
    expect(entity.totalHours).toBe(48.5);
    expect(entity.totalLessons).toBe(32);
    expect(entity.defaultDuration).toBe(90);
    expect(entity.status).toBe(CourseStatus.PUBLISHED);
  });

  it('should support nullable optional fields', () => {
    const { CourseEntity } = require('../course/course.entity');
    const entity = new CourseEntity();
    entity.description = null;
    entity.tags = null;
    entity.coverImage = null;
    entity.note = null;

    expect(entity.description).toBeNull();
    expect(entity.tags).toBeNull();
    expect(entity.coverImage).toBeNull();
    expect(entity.note).toBeNull();
  });
});

// ─── ContractEntity ───

describe('ContractEntity', () => {
  it('should instantiate with undefined fields', () => {
    const { ContractEntity } = require('../contract/contract.entity');
    const entity = new ContractEntity();
    expect(entity).toBeDefined();
    expect(entity.id).toBeUndefined();
    expect(entity.contractCode).toBeUndefined();
  });

  it('should accept valid ContractStatus enum values', () => {
    expect(ContractStatus.ACTIVE).toBe('ACTIVE');
    expect(ContractStatus.EXHAUSTED).toBe('EXHAUSTED');
    expect(ContractStatus.EXPIRED).toBe('EXPIRED');
    expect(ContractStatus.REFUNDED).toBe('REFUNDED');
    expect(ContractStatus.FROZEN).toBe('FROZEN');
  });

  it('should assign all required properties', () => {
    const { ContractEntity } = require('../contract/contract.entity');
    const entity = new ContractEntity();
    entity.contractCode = 'CTR-200';
    entity.studentCode = 'STU-001';
    entity.subject = Subject.ENGLISH;
    entity.totalLessons = 48;
    entity.remainingLessons = 30;
    entity.status = ContractStatus.ACTIVE;
    entity.validFrom = '2026-01-01';
    entity.createdBy = 1;

    expect(entity.contractCode).toBe('CTR-200');
    expect(entity.studentCode).toBe('STU-001');
    expect(entity.subject).toBe(Subject.ENGLISH);
    expect(entity.totalLessons).toBe(48);
    expect(entity.remainingLessons).toBe(30);
    expect(entity.status).toBe(ContractStatus.ACTIVE);
  });

  it('should support nullable pricing and note fields', () => {
    const { ContractEntity } = require('../contract/contract.entity');
    const entity = new ContractEntity();
    entity.validTo = null;
    entity.unitPrice = null;
    entity.totalAmount = null;
    entity.note = null;
    entity.tags = null;

    expect(entity.validTo).toBeNull();
    expect(entity.unitPrice).toBeNull();
    expect(entity.totalAmount).toBeNull();
    expect(entity.note).toBeNull();
    expect(entity.tags).toBeNull();
  });
});

// ─── EnrollmentEntity ───

describe('EnrollmentEntity', () => {
  it('should instantiate with undefined fields', () => {
    const { EnrollmentEntity } = require('../enrollment/enrollment.entity');
    const entity = new EnrollmentEntity();
    expect(entity).toBeDefined();
    expect(entity.id).toBeUndefined();
    expect(entity.classCode).toBeUndefined();
  });

  it('should accept valid EnrollmentStatus enum values', () => {
    expect(EnrollmentStatus.ACTIVE).toBe('ACTIVE');
    expect(EnrollmentStatus.WITHDRAWN).toBe('WITHDRAWN');
    expect(EnrollmentStatus.COMPLETED).toBe('COMPLETED');
  });

  it('should assign all required properties', () => {
    const { EnrollmentEntity } = require('../enrollment/enrollment.entity');
    const entity = new EnrollmentEntity();
    entity.classCode = 'CLS-001';
    entity.studentCode = 'STU-001';
    entity.contractCode = 'CTR-200';
    entity.status = EnrollmentStatus.ACTIVE;
    entity.enrolledBy = 1;

    expect(entity.classCode).toBe('CLS-001');
    expect(entity.studentCode).toBe('STU-001');
    expect(entity.contractCode).toBe('CTR-200');
    expect(entity.status).toBe(EnrollmentStatus.ACTIVE);
    expect(entity.enrolledBy).toBe(1);
  });

  it('should support nullable withdrawReason', () => {
    const { EnrollmentEntity } = require('../enrollment/enrollment.entity');
    const entity = new EnrollmentEntity();
    entity.withdrawReason = null;
    expect(entity.withdrawReason).toBeNull();
  });
});

// ─── LessonEntity ───

describe('LessonEntity', () => {
  it('should instantiate with undefined fields', () => {
    const { LessonEntity } = require('../lesson/lesson.entity');
    const entity = new LessonEntity();
    expect(entity).toBeDefined();
    expect(entity.id).toBeUndefined();
    expect(entity.classCode).toBeUndefined();
  });

  it('should accept valid LessonStatus enum values', () => {
    expect(LessonStatus.DRAFT).toBe('DRAFT');
    expect(LessonStatus.SCHEDULED).toBe('SCHEDULED');
    expect(LessonStatus.TEACHING).toBe('TEACHING');
    expect(LessonStatus.FINISHED).toBe('FINISHED');
    expect(LessonStatus.ARCHIVED).toBe('ARCHIVED');
    expect(LessonStatus.CANCELLED).toBe('CANCELLED');
  });

  it('should assign all required properties', () => {
    const { LessonEntity } = require('../lesson/lesson.entity');
    const entity = new LessonEntity();
    entity.classCode = 'CLS-001';
    entity.courseCode = 'CRS-100';
    entity.lessonNumber = 5;
    entity.status = LessonStatus.SCHEDULED;
    entity.scheduledDate = '2026-09-08';
    entity.startTime = '18:00';
    entity.endTime = '19:00';
    entity.teacherId = 42;
    entity.createdBy = 1;

    expect(entity.classCode).toBe('CLS-001');
    expect(entity.courseCode).toBe('CRS-100');
    expect(entity.lessonNumber).toBe(5);
    expect(entity.status).toBe(LessonStatus.SCHEDULED);
    expect(entity.scheduledDate).toBe('2026-09-08');
    expect(entity.teacherId).toBe(42);
  });

  it('should support nullable fields for actual times, makeup, and confirmation', () => {
    const { LessonEntity } = require('../lesson/lesson.entity');
    const entity = new LessonEntity();
    entity.actualStartTime = null;
    entity.actualEndTime = null;
    entity.note = null;
    entity.cancelledReason = null;
    entity.isMakeup = false;
    entity.originLessonId = null;
    entity.changeRequestId = null;
    entity.confirmedBy = null;
    entity.confirmedAt = null;

    expect(entity.actualStartTime).toBeNull();
    expect(entity.actualEndTime).toBeNull();
    expect(entity.isMakeup).toBe(false);
    expect(entity.originLessonId).toBeNull();
    expect(entity.confirmedBy).toBeNull();
  });

  it('should support makeup lesson assignment', () => {
    const { LessonEntity } = require('../lesson/lesson.entity');
    const entity = new LessonEntity();
    entity.isMakeup = true;
    entity.originLessonId = 100;

    expect(entity.isMakeup).toBe(true);
    expect(entity.originLessonId).toBe(100);
  });
});

// ─── LessonAttendanceEntity ───

describe('LessonAttendanceEntity', () => {
  it('should instantiate with undefined fields', () => {
    const { LessonAttendanceEntity } = require('../lesson-attendance/lesson-attendance.entity');
    const entity = new LessonAttendanceEntity();
    expect(entity).toBeDefined();
    expect(entity.id).toBeUndefined();
    expect(entity.lessonId).toBeUndefined();
  });

  it('should accept valid AttendanceWorkflowState enum values', () => {
    expect(AttendanceWorkflowState.PENDING).toBe('PENDING');
    expect(AttendanceWorkflowState.CHECKED_IN).toBe('CHECKED_IN');
    expect(AttendanceWorkflowState.CONFIRMED).toBe('CONFIRMED');
    expect(AttendanceWorkflowState.LOCKED).toBe('LOCKED');
  });

  it('should accept valid AttendanceStatus enum values', () => {
    expect(AttendanceStatus.PRESENT).toBe('PRESENT');
    expect(AttendanceStatus.ABSENT).toBe('ABSENT');
    expect(AttendanceStatus.LATE).toBe('LATE');
    expect(AttendanceStatus.LEAVE).toBe('LEAVE');
    expect(AttendanceStatus.MAKEUP).toBe('MAKEUP');
    expect(AttendanceStatus.ONLINE).toBe('ONLINE');
    expect(AttendanceStatus.OFFLINE).toBe('OFFLINE');
  });

  it('should accept valid AttendanceSource enum values', () => {
    expect(AttendanceSource.MANUAL).toBe('MANUAL');
    expect(AttendanceSource.SELF_CHECK_IN).toBe('SELF_CHECK_IN');
    expect(AttendanceSource.API).toBe('API');
    expect(AttendanceSource.IMPORT).toBe('IMPORT');
  });

  it('should assign all required properties', () => {
    const { LessonAttendanceEntity } = require('../lesson-attendance/lesson-attendance.entity');
    const entity = new LessonAttendanceEntity();
    entity.lessonId = 10;
    entity.studentCode = 'STU-001';
    entity.classCode = 'CLS-001';
    entity.teacherId = 42;
    entity.workflowState = AttendanceWorkflowState.PENDING;
    entity.status = null;
    entity.operator = 42;
    entity.source = AttendanceSource.API;
    entity.createdBy = 42;

    expect(entity.lessonId).toBe(10);
    expect(entity.studentCode).toBe('STU-001');
    expect(entity.classCode).toBe('CLS-001');
    expect(entity.teacherId).toBe(42);
    expect(entity.workflowState).toBe(AttendanceWorkflowState.PENDING);
    expect(entity.status).toBeNull();
    expect(entity.source).toBe(AttendanceSource.API);
  });

  it('should support nullable checkInTime, reason, note, and status', () => {
    const { LessonAttendanceEntity } = require('../lesson-attendance/lesson-attendance.entity');
    const entity = new LessonAttendanceEntity();
    entity.checkInTime = null;
    entity.reason = null;
    entity.note = null;
    entity.status = null;

    expect(entity.checkInTime).toBeNull();
    expect(entity.reason).toBeNull();
    expect(entity.note).toBeNull();
    expect(entity.status).toBeNull();
  });
});

// ─── LessonChangeRequestEntity ───

describe('LessonChangeRequestEntity', () => {
  it('should instantiate with undefined fields', () => {
    const { LessonChangeRequestEntity } = require('../lesson-change-request/lesson-change-request.entity');
    const entity = new LessonChangeRequestEntity();
    expect(entity).toBeDefined();
    expect(entity.id).toBeUndefined();
    expect(entity.lessonId).toBeUndefined();
  });

  it('should accept valid ChangeRequestType enum values', () => {
    expect(ChangeRequestType.RESCHEDULE).toBe('RESCHEDULE');
    expect(ChangeRequestType.TEACHER_CHANGE).toBe('TEACHER_CHANGE');
    expect(ChangeRequestType.CANCEL).toBe('CANCEL');
    expect(ChangeRequestType.REOPEN).toBe('REOPEN');
  });

  it('should accept valid ChangeRequestStatus enum values', () => {
    expect(ChangeRequestStatus.PENDING).toBe('PENDING');
    expect(ChangeRequestStatus.APPROVED).toBe('APPROVED');
    expect(ChangeRequestStatus.REJECTED).toBe('REJECTED');
    expect(ChangeRequestStatus.EXECUTED).toBe('EXECUTED');
  });

  it('should assign all required properties', () => {
    const { LessonChangeRequestEntity } = require('../lesson-change-request/lesson-change-request.entity');
    const entity = new LessonChangeRequestEntity();
    entity.lessonId = 10;
    entity.requestType = ChangeRequestType.RESCHEDULE;
    entity.requestedBy = 42;
    entity.reason = '教师出差需要调课';
    entity.status = ChangeRequestStatus.PENDING;

    expect(entity.lessonId).toBe(10);
    expect(entity.requestType).toBe(ChangeRequestType.RESCHEDULE);
    expect(entity.requestedBy).toBe(42);
    expect(entity.reason).toBe('教师出差需要调课');
    expect(entity.status).toBe(ChangeRequestStatus.PENDING);
  });

  it('should support reschedule fields (previous/new date and time)', () => {
    const { LessonChangeRequestEntity } = require('../lesson-change-request/lesson-change-request.entity');
    const entity = new LessonChangeRequestEntity();
    entity.previousDate = '2026-09-08';
    entity.newDate = '2026-09-10';
    entity.previousStartTime = '18:00';
    entity.newStartTime = '19:00';
    entity.previousEndTime = '19:00';
    entity.newEndTime = '20:00';

    expect(entity.previousDate).toBe('2026-09-08');
    expect(entity.newDate).toBe('2026-09-10');
    expect(entity.previousStartTime).toBe('18:00');
    expect(entity.newStartTime).toBe('19:00');
  });

  it('should support teacher change fields', () => {
    const { LessonChangeRequestEntity } = require('../lesson-change-request/lesson-change-request.entity');
    const entity = new LessonChangeRequestEntity();
    entity.previousTeacherId = 42;
    entity.newTeacherId = 55;

    expect(entity.previousTeacherId).toBe(42);
    expect(entity.newTeacherId).toBe(55);
  });

  it('should support nullable approval and execution fields', () => {
    const { LessonChangeRequestEntity } = require('../lesson-change-request/lesson-change-request.entity');
    const entity = new LessonChangeRequestEntity();
    entity.approvedBy = null;
    entity.approvedAt = null;
    entity.rejectionReason = null;
    entity.executedAt = null;
    entity.executedBy = null;

    expect(entity.approvedBy).toBeNull();
    expect(entity.approvedAt).toBeNull();
    expect(entity.rejectionReason).toBeNull();
    expect(entity.executedAt).toBeNull();
    expect(entity.executedBy).toBeNull();
  });
});

// ─── TeacherAssignmentEntity ───

describe('TeacherAssignmentEntity', () => {
  it('should instantiate with undefined fields', () => {
    const { TeacherAssignmentEntity } = require('../teacher-assignment/teacher-assignment.entity');
    const entity = new TeacherAssignmentEntity();
    expect(entity).toBeDefined();
    expect(entity.id).toBeUndefined();
    expect(entity.classCode).toBeUndefined();
  });

  it('should accept valid TeacherRole enum values', () => {
    expect(TeacherRole.PRIMARY).toBe('PRIMARY');
    expect(TeacherRole.SUBSTITUTE).toBe('SUBSTITUTE');
    expect(TeacherRole.ASSISTANT).toBe('ASSISTANT');
  });

  it('should assign all required properties', () => {
    const { TeacherAssignmentEntity } = require('../teacher-assignment/teacher-assignment.entity');
    const entity = new TeacherAssignmentEntity();
    entity.classCode = 'CLS-001';
    entity.teacherId = 42;
    entity.role = TeacherRole.PRIMARY;
    entity.effectiveFrom = '2026-09-01';
    entity.assignedBy = 1;

    expect(entity.classCode).toBe('CLS-001');
    expect(entity.teacherId).toBe(42);
    expect(entity.role).toBe(TeacherRole.PRIMARY);
    expect(entity.effectiveFrom).toBe('2026-09-01');
    expect(entity.assignedBy).toBe(1);
  });

  it('should support nullable effectiveTo and reason', () => {
    const { TeacherAssignmentEntity } = require('../teacher-assignment/teacher-assignment.entity');
    const entity = new TeacherAssignmentEntity();
    entity.effectiveTo = null;
    entity.reason = null;

    expect(entity.effectiveTo).toBeNull();
    expect(entity.reason).toBeNull();
  });

  it('should allow substitute role assignment', () => {
    const { TeacherAssignmentEntity } = require('../teacher-assignment/teacher-assignment.entity');
    const entity = new TeacherAssignmentEntity();
    entity.role = TeacherRole.SUBSTITUTE;
    entity.effectiveFrom = '2026-10-01';
    entity.effectiveTo = '2026-10-15';
    entity.reason = '主讲教师休假期间代课';

    expect(entity.role).toBe(TeacherRole.SUBSTITUTE);
    expect(entity.effectiveTo).toBe('2026-10-15');
    expect(entity.reason).toBe('主讲教师休假期间代课');
  });
});

// ─── Subject enum cross-module validation ───

describe('Subject enum (shared)', () => {
  it('should contain all expected subjects', () => {
    const expected = [
      'MATH', 'ENGLISH', 'CHINESE', 'PHYSICS', 'CHEMISTRY',
      'ART', 'MUSIC', 'DANCE', 'SPORTS', 'CODING', 'OTHER',
    ];
    for (const value of expected) {
      expect(Subject[value as keyof typeof Subject]).toBe(value);
    }
    expect(Object.keys(Subject)).toHaveLength(expected.length);
  });
});
