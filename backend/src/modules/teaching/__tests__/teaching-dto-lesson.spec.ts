import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

// ─── Lesson DTOs ────────────────────────────────────────────────
import { CreateLessonDto } from '../lesson/dto/create-lesson.dto';
import { CancelLessonDto } from '../lesson/dto/cancel-lesson.dto';
import { CreateMakeupDto } from '../lesson/dto/create-makeup.dto';
import { UpdateLessonDto } from '../lesson/dto/update-lesson.dto';
import { QueryLessonDto } from '../lesson/dto/query-lesson.dto';

// ─── Enrollment DTOs ────────────────────────────────────────────
import { CreateEnrollmentDto } from '../enrollment/dto/create-enrollment.dto';
import { WithdrawEnrollmentDto } from '../enrollment/dto/withdraw-enrollment.dto';
import { UpdateEnrollmentDto } from '../enrollment/dto/update-enrollment.dto';
import { QueryEnrollmentDto } from '../enrollment/dto/query-enrollment.dto';

// ─── CreateLessonDto ────────────────────────────────────────────

describe('CreateLessonDto', () => {
  const valid = {
    classCode: 'CLS2026070001',
    courseCode: 'CS2026070001',
    lessonNumber: 1,
    scheduledDate: '2026-07-20',
    startTime: '10:00',
    endTime: '11:30',
    teacherId: 1001,
  };

  it('should pass with valid data', async () => {
    const dto = plainToInstance(CreateLessonDto, valid);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with optional fields', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      ...valid,
      isMakeup: true,
      originLessonId: 50,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when classCode is not a string', async () => {
    const dto = plainToInstance(CreateLessonDto, { ...valid, classCode: 123 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when courseCode is not a string', async () => {
    const dto = plainToInstance(CreateLessonDto, { ...valid, courseCode: true });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when lessonNumber < 1', async () => {
    const dto = plainToInstance(CreateLessonDto, { ...valid, lessonNumber: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when lessonNumber > 999', async () => {
    const dto = plainToInstance(CreateLessonDto, { ...valid, lessonNumber: 1000 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when scheduledDate is not YYYY-MM-DD', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      ...valid,
      scheduledDate: '2026/07/20',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when startTime format is invalid', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      ...valid,
      startTime: '10:00:00',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when endTime format is invalid', async () => {
    const dto = plainToInstance(CreateLessonDto, { ...valid, endTime: '11' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when teacherId is missing', async () => {
    const dto = plainToInstance(CreateLessonDto, { ...valid, teacherId: undefined });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── CancelLessonDto ────────────────────────────────────────────

describe('CancelLessonDto', () => {
  it('should pass with valid reason', async () => {
    const dto = plainToInstance(CancelLessonDto, { reason: '教师请假' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when reason is empty', async () => {
    const dto = plainToInstance(CancelLessonDto, { reason: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when reason < 2 chars', async () => {
    const dto = plainToInstance(CancelLessonDto, { reason: 'A' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when reason > 200 chars', async () => {
    const dto = plainToInstance(CancelLessonDto, {
      reason: 'A'.repeat(201),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should pass with exactly 2 chars', async () => {
    const dto = plainToInstance(CancelLessonDto, { reason: 'AB' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with exactly 200 chars', async () => {
    const dto = plainToInstance(CancelLessonDto, {
      reason: 'A'.repeat(200),
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

// ─── CreateMakeupDto ────────────────────────────────────────────

describe('CreateMakeupDto', () => {
  const valid = {
    courseCode: 'CS2026070001',
    lessonNumber: 99,
    scheduledDate: '2026-07-20',
    startTime: '14:00',
    endTime: '15:30',
    teacherId: 1001,
  };

  it('should pass with valid data', async () => {
    const dto = plainToInstance(CreateMakeupDto, valid);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with optional originLessonId', async () => {
    const dto = plainToInstance(CreateMakeupDto, {
      ...valid,
      originLessonId: 123,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when courseCode is not a string', async () => {
    const dto = plainToInstance(CreateMakeupDto, { ...valid, courseCode: 42 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when lessonNumber < 1', async () => {
    const dto = plainToInstance(CreateMakeupDto, {
      ...valid,
      lessonNumber: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when lessonNumber > 999', async () => {
    const dto = plainToInstance(CreateMakeupDto, {
      ...valid,
      lessonNumber: 1000,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when scheduledDate is invalid', async () => {
    const dto = plainToInstance(CreateMakeupDto, {
      ...valid,
      scheduledDate: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when startTime format is invalid', async () => {
    const dto = plainToInstance(CreateMakeupDto, {
      ...valid,
      startTime: '25:00',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when endTime format is invalid', async () => {
    const dto = plainToInstance(CreateMakeupDto, {
      ...valid,
      endTime: '9:30',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when teacherId is missing', async () => {
    const dto = plainToInstance(CreateMakeupDto, {
      ...valid,
      teacherId: undefined,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── UpdateLessonDto (empty) ───────────────────────────────────

describe('UpdateLessonDto', () => {
  it('should instantiate', () => {
    const dto = new UpdateLessonDto();
    expect(dto).toBeDefined();
  });
});

// ─── QueryLessonDto (empty) ────────────────────────────────────

describe('QueryLessonDto', () => {
  it('should instantiate', () => {
    const dto = new QueryLessonDto();
    expect(dto).toBeDefined();
  });
});

// ─── CreateEnrollmentDto ────────────────────────────────────────

describe('CreateEnrollmentDto', () => {
  const valid = {
    classCode: 'CLS2026070001',
    studentCode: 'STU20260001',
    contractCode: 'CTR2026070001',
  };

  it('should pass with valid data', async () => {
    const dto = plainToInstance(CreateEnrollmentDto, valid);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when classCode is empty', async () => {
    const dto = plainToInstance(CreateEnrollmentDto, {
      ...valid,
      classCode: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when studentCode is empty', async () => {
    const dto = plainToInstance(CreateEnrollmentDto, {
      ...valid,
      studentCode: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when contractCode is empty', async () => {
    const dto = plainToInstance(CreateEnrollmentDto, {
      ...valid,
      contractCode: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when classCode exceeds 20 chars', async () => {
    const dto = plainToInstance(CreateEnrollmentDto, {
      ...valid,
      classCode: 'A'.repeat(21),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when studentCode exceeds 20 chars', async () => {
    const dto = plainToInstance(CreateEnrollmentDto, {
      ...valid,
      studentCode: 'A'.repeat(21),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when contractCode exceeds 20 chars', async () => {
    const dto = plainToInstance(CreateEnrollmentDto, {
      ...valid,
      contractCode: 'A'.repeat(21),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when fields are missing', async () => {
    const dto = plainToInstance(CreateEnrollmentDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── WithdrawEnrollmentDto ──────────────────────────────────────

describe('WithdrawEnrollmentDto', () => {
  it('should pass with valid reason', async () => {
    const dto = plainToInstance(WithdrawEnrollmentDto, {
      reason: '学生转学',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when reason is empty', async () => {
    const dto = plainToInstance(WithdrawEnrollmentDto, { reason: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when reason < 2 chars', async () => {
    const dto = plainToInstance(WithdrawEnrollmentDto, { reason: 'A' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when reason > 200 chars', async () => {
    const dto = plainToInstance(WithdrawEnrollmentDto, {
      reason: 'A'.repeat(201),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should pass with exactly 2 chars', async () => {
    const dto = plainToInstance(WithdrawEnrollmentDto, { reason: 'AB' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with exactly 200 chars', async () => {
    const dto = plainToInstance(WithdrawEnrollmentDto, {
      reason: 'A'.repeat(200),
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

// ─── UpdateEnrollmentDto (empty) ───────────────────────────────

describe('UpdateEnrollmentDto', () => {
  it('should instantiate', () => {
    const dto = new UpdateEnrollmentDto();
    expect(dto).toBeDefined();
  });
});

// ─── QueryEnrollmentDto (empty) ────────────────────────────────

describe('QueryEnrollmentDto', () => {
  it('should instantiate', () => {
    const dto = new QueryEnrollmentDto();
    expect(dto).toBeDefined();
  });
});
