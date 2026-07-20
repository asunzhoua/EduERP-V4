import { PointsGrantedEvent } from '../finance/points-granted.event';
import { ContractExhaustedEvent } from '../finance/contract-exhausted.event';
import { ContractExpiredEvent } from '../finance/contract-expired.event';
import { ContractRefundedEvent } from '../finance/contract-refunded.event';
import { LeaveApprovedEvent } from '../leave/leave-approved.event';
import { LeaveSubmittedEvent } from '../leave/leave-submitted.event';
import { LessonCompletedEvent } from '../lesson/lesson-completed.event';
import { LessonFeedbackCreatedEvent } from '../lesson/lesson-feedback-created.event';
import { LessonFinishedEvent } from '../lesson/lesson-finished.event';
import { AttendanceConfirmedEvent } from '../lesson/attendance-confirmed.event';
import { StudentDeactivatedEvent } from '../student/student-deactivated.event';

describe('Event Classes – instantiation & property assignment', () => {
  // ── Finance ──────────────────────────────────────────────

  describe('PointsGrantedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new PointsGrantedEvent('evt-1', 10, 20, 5, '2026-01-01T00:00:00Z');
      expect(e.eventId).toBe('evt-1');
      expect(e.studentId).toBe(10);
      expect(e.lessonId).toBe(20);
      expect(e.points).toBe(5);
      expect(e.time).toBe('2026-01-01T00:00:00Z');
    });
  });

  describe('ContractExhaustedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new ContractExhaustedEvent('evt-2', 1, 'C001', 'S001', 0, 120, '2026-02-01T00:00:00Z');
      expect(e.eventId).toBe('evt-2');
      expect(e.contractId).toBe(1);
      expect(e.contractCode).toBe('C001');
      expect(e.studentCode).toBe('S001');
      expect(e.remainingLessons).toBe(0);
      expect(e.totalDeducted).toBe(120);
      expect(e.time).toBe('2026-02-01T00:00:00Z');
    });
  });

  describe('ContractExpiredEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new ContractExpiredEvent('evt-3', 2, 'C002', 'S002', '2026-06-30', 5, '2026-07-01T00:00:00Z');
      expect(e.eventId).toBe('evt-3');
      expect(e.contractId).toBe(2);
      expect(e.contractCode).toBe('C002');
      expect(e.studentCode).toBe('S002');
      expect(e.validTo).toBe('2026-06-30');
      expect(e.remainingLessons).toBe(5);
      expect(e.time).toBe('2026-07-01T00:00:00Z');
    });
  });

  describe('ContractRefundedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new ContractRefundedEvent('evt-4', 3, 'C003', 'S003', 500, 'personal reason', 99, '2026-03-15T00:00:00Z');
      expect(e.eventId).toBe('evt-4');
      expect(e.contractId).toBe(3);
      expect(e.contractCode).toBe('C003');
      expect(e.studentCode).toBe('S003');
      expect(e.refundAmount).toBe(500);
      expect(e.refundReason).toBe('personal reason');
      expect(e.processedBy).toBe(99);
      expect(e.time).toBe('2026-03-15T00:00:00Z');
    });
  });

  // ── Leave ────────────────────────────────────────────────

  describe('LeaveApprovedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new LeaveApprovedEvent('evt-5', 11, 22, 33, 44, '2026-04-01T00:00:00Z');
      expect(e.eventId).toBe('evt-5');
      expect(e.leaveId).toBe(11);
      expect(e.studentId).toBe(22);
      expect(e.lessonId).toBe(33);
      expect(e.approvedBy).toBe(44);
      expect(e.time).toBe('2026-04-01T00:00:00Z');
    });
  });

  describe('LeaveSubmittedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new LeaveSubmittedEvent('evt-6', 12, 23, 34, '2026-04-02T00:00:00Z');
      expect(e.eventId).toBe('evt-6');
      expect(e.leaveId).toBe(12);
      expect(e.studentId).toBe(23);
      expect(e.lessonId).toBe(34);
      expect(e.time).toBe('2026-04-02T00:00:00Z');
    });
  });

  // ── Lesson ───────────────────────────────────────────────

  describe('LessonCompletedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new LessonCompletedEvent(
        'evt-7', 50, 'CLS01', 'CRS01', 60,
        '2026-05-10', '09:00', '10:30', 90, '2026-05-10T10:30:00Z',
      );
      expect(e.eventId).toBe('evt-7');
      expect(e.lessonId).toBe(50);
      expect(e.classCode).toBe('CLS01');
      expect(e.courseCode).toBe('CRS01');
      expect(e.teacherId).toBe(60);
      expect(e.scheduledDate).toBe('2026-05-10');
      expect(e.actualStartTime).toBe('09:00');
      expect(e.actualEndTime).toBe('10:30');
      expect(e.durationMinutes).toBe(90);
      expect(e.time).toBe('2026-05-10T10:30:00Z');
    });
  });

  describe('LessonFeedbackCreatedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new LessonFeedbackCreatedEvent('evt-8', 51, 70, 60, '2026-05-11T00:00:00Z');
      expect(e.eventId).toBe('evt-8');
      expect(e.lessonId).toBe(51);
      expect(e.studentId).toBe(70);
      expect(e.teacherId).toBe(60);
      expect(e.time).toBe('2026-05-11T00:00:00Z');
    });
  });

  describe('LessonFinishedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new LessonFinishedEvent(
        'evt-9', 52, 'CLS02', 'CRS02', 61,
        '2026-05-12', '14:00', '15:00', 60,
        88, '2026-05-12T15:05:00Z', '2026-05-12T15:05:00Z',
      );
      expect(e.eventId).toBe('evt-9');
      expect(e.lessonId).toBe(52);
      expect(e.classCode).toBe('CLS02');
      expect(e.courseCode).toBe('CRS02');
      expect(e.teacherId).toBe(61);
      expect(e.scheduledDate).toBe('2026-05-12');
      expect(e.actualStartTime).toBe('14:00');
      expect(e.actualEndTime).toBe('15:00');
      expect(e.durationMinutes).toBe(60);
      expect(e.confirmedBy).toBe(88);
      expect(e.confirmedAt).toBe('2026-05-12T15:05:00Z');
      expect(e.time).toBe('2026-05-12T15:05:00Z');
    });
  });

  describe('AttendanceConfirmedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new AttendanceConfirmedEvent('evt-10', 53, '2026-05-13T00:00:00Z');
      expect(e.eventId).toBe('evt-10');
      expect(e.lessonId).toBe(53);
      expect(e.time).toBe('2026-05-13T00:00:00Z');
    });
  });

  // ── Student ──────────────────────────────────────────────

  describe('StudentDeactivatedEvent', () => {
    it('should assign all properties from constructor args', () => {
      const e = new StudentDeactivatedEvent(
        'evt-11', 100, 'STU100', 'active', 'inactive', 'graduated', 999, '2026-06-01T00:00:00Z',
      );
      expect(e.eventId).toBe('evt-11');
      expect(e.studentId).toBe(100);
      expect(e.studentCode).toBe('STU100');
      expect(e.previousStatus).toBe('active');
      expect(e.newStatus).toBe('inactive');
      expect(e.reason).toBe('graduated');
      expect(e.operatedBy).toBe(999);
      expect(e.time).toBe('2026-06-01T00:00:00Z');
    });
  });
});
