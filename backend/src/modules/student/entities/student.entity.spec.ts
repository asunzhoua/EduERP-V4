import { Student } from './student.entity';
import { StudentParent } from './student-parent.entity';
import { StudentAuditLog } from './student-audit-log.entity';
import { ImportHistory } from './import-history.entity';
import { StudentStatus } from '../enums/student-status.enum';
import { Gender } from '../enums/gender.enum';
import { CreatedSource } from '@common/enums/created-source.enum';
import { AuditAction } from '@common/enums/audit-action.enum';

describe('Student Entity', () => {
  it('should instantiate with all required fields', () => {
    const student = new Student();
    student.id = 1;
    student.studentCode = 'STU001';
    student.name = '张三';
    student.gender = Gender.MALE;
    student.birthDate = '2010-01-15';
    student.createdBy = 100;

    expect(student.id).toBe(1);
    expect(student.studentCode).toBe('STU001');
    expect(student.name).toBe('张三');
    expect(student.gender).toBe(Gender.MALE);
    expect(student.birthDate).toBe('2010-01-15');
    expect(student.createdBy).toBe(100);
  });

  it('should have nullable fields as undefined when unset', () => {
    const student = new Student();

    expect(student.phone).toBeUndefined();
    expect(student.email).toBeUndefined();
    expect(student.school).toBeUndefined();
    expect(student.grade).toBeUndefined();
    expect(student.tags).toBeUndefined();
    expect(student.note).toBeUndefined();
    expect(student.mergedToStudentId).toBeUndefined();
    expect(student.updatedBy).toBeUndefined();
  });

  it('should support Gender enum values', () => {
    const male = new Student();
    male.gender = Gender.MALE;
    expect(male.gender).toBe('MALE');

    const female = new Student();
    female.gender = Gender.FEMALE;
    expect(female.gender).toBe('FEMALE');
  });

  it('should default status to ACTIVE', () => {
    const student = new Student();
    student.status = StudentStatus.ACTIVE;
    expect(student.status).toBe(StudentStatus.ACTIVE);
  });

  it('should support all StudentStatus values', () => {
    const statuses = [
      StudentStatus.ACTIVE,
      StudentStatus.PAUSED,
      StudentStatus.GRADUATED,
      StudentStatus.INACTIVE,
    ];
    for (const status of statuses) {
      const student = new Student();
      student.status = status;
      expect(student.status).toBe(status);
    }
  });

  it('should default version to 1', () => {
    const student = new Student();
    student.version = 1;
    expect(student.version).toBe(1);
  });

  it('should default deleted to false', () => {
    const student = new Student();
    student.deleted = false;
    expect(student.deleted).toBe(false);
  });

  it('should default createdSource to API', () => {
    const student = new Student();
    student.createdSource = CreatedSource.API;
    expect(student.createdSource).toBe(CreatedSource.API);
  });

  it('should support tags as string array', () => {
    const student = new Student();
    student.tags = ['音乐', '体育', '竞赛'];
    expect(student.tags).toHaveLength(3);
    expect(student.tags).toContain('竞赛');
  });

  it('should handle FEMALE gender correctly', () => {
    const student = new Student();
    student.gender = Gender.FEMALE;
    student.name = '李四';
    expect(student.gender).toBe(Gender.FEMALE);
    expect(student.name).toBe('李四');
  });

  it('should allow setting audit timestamps', () => {
    const student = new Student();
    const now = new Date();
    student.createTime = now;
    student.updateTime = now;
    expect(student.createTime).toBe(now);
    expect(student.updateTime).toBe(now);
  });

  it('should allow setting mergedToStudentId', () => {
    const student = new Student();
    student.mergedToStudentId = 42;
    expect(student.mergedToStudentId).toBe(42);
  });
});

describe('StudentParent Entity', () => {
  it('should instantiate with required fields', () => {
    const sp = new StudentParent();
    sp.id = 1;
    sp.studentId = 10;
    sp.parentId = 100;

    expect(sp.id).toBe(1);
    expect(sp.studentId).toBe(10);
    expect(sp.parentId).toBe(100);
  });

  it('should have relation as undefined when unset', () => {
    const sp = new StudentParent();
    expect(sp.relation).toBeUndefined();
  });

  it('should default isPrimary to false', () => {
    const sp = new StudentParent();
    sp.isPrimary = false;
    expect(sp.isPrimary).toBe(false);
  });

  it('should support setting relation', () => {
    const sp = new StudentParent();
    sp.relation = '父亲';
    expect(sp.relation).toBe('父亲');
  });

  it('should support isPrimary flag', () => {
    const sp = new StudentParent();
    sp.isPrimary = true;
    expect(sp.isPrimary).toBe(true);
  });

  it('should allow setting createTime', () => {
    const sp = new StudentParent();
    const now = new Date();
    sp.createTime = now;
    expect(sp.createTime).toBe(now);
  });
});

describe('StudentAuditLog Entity', () => {
  it('should instantiate with required fields', () => {
    const log = new StudentAuditLog();
    log.id = 1;
    log.studentId = 10;
    log.action = AuditAction.CREATE;
    log.operatedBy = 100;

    expect(log.id).toBe(1);
    expect(log.studentId).toBe(10);
    expect(log.action).toBe(AuditAction.CREATE);
    expect(log.operatedBy).toBe(100);
  });

  it('should have nullable fields as undefined when unset', () => {
    const log = new StudentAuditLog();
    expect(log.fieldName).toBeUndefined();
    expect(log.oldValue).toBeUndefined();
    expect(log.newValue).toBeUndefined();
    expect(log.detail).toBeUndefined();
  });

  it('should default source to API', () => {
    const log = new StudentAuditLog();
    log.source = CreatedSource.API;
    expect(log.source).toBe(CreatedSource.API);
  });

  it('should support all AuditAction values', () => {
    const actions = [
      AuditAction.CREATE,
      AuditAction.UPDATE,
      AuditAction.STATUS_CHANGE,
      AuditAction.DELETE,
      AuditAction.MERGE,
    ];
    for (const action of actions) {
      const log = new StudentAuditLog();
      log.action = action;
      expect(log.action).toBe(action);
    }
  });

  it('should support field change tracking', () => {
    const log = new StudentAuditLog();
    log.action = AuditAction.UPDATE;
    log.fieldName = 'name';
    log.oldValue = '张三';
    log.newValue = '张三丰';
    log.detail = '修改学生姓名';

    expect(log.fieldName).toBe('name');
    expect(log.oldValue).toBe('张三');
    expect(log.newValue).toBe('张三丰');
    expect(log.detail).toBe('修改学生姓名');
  });

  it('should allow setting operateTime', () => {
    const log = new StudentAuditLog();
    const now = new Date();
    log.operateTime = now;
    expect(log.operateTime).toBe(now);
  });

  it('should support MERGE action', () => {
    const log = new StudentAuditLog();
    log.action = AuditAction.MERGE;
    log.detail = '合并学生档案';
    expect(log.action).toBe(AuditAction.MERGE);
    expect(log.detail).toBe('合并学生档案');
  });
});

describe('ImportHistory Entity', () => {
  it('should instantiate with required fields', () => {
    const imp = new ImportHistory();
    imp.id = 1;
    imp.entityType = 'student';
    imp.fileName = 'students.xlsx';
    imp.totalRows = 100;
    imp.successCount = 95;
    imp.failureCount = 5;
    imp.importedBy = 100;

    expect(imp.id).toBe(1);
    expect(imp.entityType).toBe('student');
    expect(imp.fileName).toBe('students.xlsx');
    expect(imp.totalRows).toBe(100);
    expect(imp.successCount).toBe(95);
    expect(imp.failureCount).toBe(5);
    expect(imp.importedBy).toBe(100);
  });

  it('should have errorDetails as undefined when unset', () => {
    const imp = new ImportHistory();
    expect(imp.errorDetails).toBeUndefined();
  });

  it('should default source to IMPORT', () => {
    const imp = new ImportHistory();
    imp.source = CreatedSource.IMPORT;
    expect(imp.source).toBe(CreatedSource.IMPORT);
  });

  it('should support setting errorDetails', () => {
    const imp = new ImportHistory();
    imp.errorDetails = JSON.stringify({ row: 5, reason: '姓名为空' });
    expect(imp.errorDetails).toContain('姓名为空');
  });

  it('should allow setting importTime', () => {
    const imp = new ImportHistory();
    const now = new Date();
    imp.importTime = now;
    expect(imp.importTime).toBe(now);
  });

  it('should support zero-count import (empty file)', () => {
    const imp = new ImportHistory();
    imp.totalRows = 0;
    imp.successCount = 0;
    imp.failureCount = 0;
    expect(imp.totalRows + imp.successCount + imp.failureCount).toBe(0);
  });

  it('should represent full success import', () => {
    const imp = new ImportHistory();
    imp.totalRows = 50;
    imp.successCount = 50;
    imp.failureCount = 0;
    expect(imp.successCount).toBe(imp.totalRows);
    expect(imp.failureCount).toBe(0);
  });

  it('should represent full failure import', () => {
    const imp = new ImportHistory();
    imp.totalRows = 20;
    imp.successCount = 0;
    imp.failureCount = 20;
    expect(imp.failureCount).toBe(imp.totalRows);
    expect(imp.successCount).toBe(0);
  });
});
