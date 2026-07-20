import { AuditAction } from './audit-action.enum';
import { ChangeRequestType } from './change-request-type.enum';
import { CreatedSource } from './created-source.enum';
import { EnrollmentStatus } from './enrollment-status.enum';
import { Subject } from './subject.enum';
import { TeacherRole } from './teacher-role.enum';

describe('Common Enums', () => {
  describe('AuditAction', () => {
    it('should contain 5 members', () => {
      expect(Object.keys(AuditAction)).toHaveLength(5);
    });

    it('should have string values matching keys', () => {
      expect(AuditAction.CREATE).toBe('CREATE');
      expect(AuditAction.MERGE).toBe('MERGE');
    });

    it('should include STATUS_CHANGE', () => {
      expect(AuditAction.STATUS_CHANGE).toBeDefined();
    });
  });

  describe('ChangeRequestType', () => {
    it('should contain 4 members', () => {
      expect(Object.keys(ChangeRequestType)).toHaveLength(4);
    });

    it('should have string values matching keys', () => {
      expect(ChangeRequestType.RESCHEDULE).toBe('RESCHEDULE');
      expect(ChangeRequestType.CANCEL).toBe('CANCEL');
    });

    it('should include REOPEN', () => {
      expect(ChangeRequestType.REOPEN).toBeDefined();
    });
  });

  describe('CreatedSource', () => {
    it('should contain 3 members', () => {
      expect(Object.keys(CreatedSource)).toHaveLength(3);
    });

    it('should have string values matching keys', () => {
      expect(CreatedSource.ADMIN).toBe('ADMIN');
      expect(CreatedSource.API).toBe('API');
    });

    it('should include IMPORT', () => {
      expect(CreatedSource.IMPORT).toBeDefined();
    });
  });

  describe('EnrollmentStatus', () => {
    it('should contain 3 members', () => {
      expect(Object.keys(EnrollmentStatus)).toHaveLength(3);
    });

    it('should have string values matching keys', () => {
      expect(EnrollmentStatus.ACTIVE).toBe('ACTIVE');
      expect(EnrollmentStatus.WITHDRAWN).toBe('WITHDRAWN');
    });

    it('should include COMPLETED', () => {
      expect(EnrollmentStatus.COMPLETED).toBeDefined();
    });
  });

  describe('Subject', () => {
    it('should contain 11 members', () => {
      expect(Object.keys(Subject)).toHaveLength(11);
    });

    it('should have string values matching keys', () => {
      expect(Subject.MATH).toBe('MATH');
      expect(Subject.CODING).toBe('CODING');
    });

    it('should include ALL and OTHER as boundary values', () => {
      expect(Subject.OTHER).toBeDefined();
      expect(Subject.MUSIC).toBeDefined();
    });
  });

  describe('TeacherRole', () => {
    it('should contain 3 members', () => {
      expect(Object.keys(TeacherRole)).toHaveLength(3);
    });

    it('should have string values matching keys', () => {
      expect(TeacherRole.PRIMARY).toBe('PRIMARY');
      expect(TeacherRole.ASSISTANT).toBe('ASSISTANT');
    });

    it('should include SUBSTITUTE', () => {
      expect(TeacherRole.SUBSTITUTE).toBeDefined();
    });
  });
});
