import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateClassDto } from '../class/dto/create-class.dto';
import { UpdateClassDto } from '../class/dto/update-class.dto';
import { UpdateClassStatusDto } from '../class/dto/update-class-status.dto';
import { QueryClassDto } from '../class/dto/query-class.dto';
import { AssignTeacherDto } from '../class/dto/assign-teacher.dto';
import { ClassStatus } from '../class/enums/class-status.enum';
import { TeacherRole } from '@common/enums/teacher-role.enum';

import { CreateCourseDto } from '../course/dto/create-course.dto';
import { UpdateCourseDto } from '../course/dto/update-course.dto';
import { UpdateCourseStatusDto } from '../course/dto/update-course-status.dto';
import { QueryCourseDto } from '../course/dto/query-course.dto';
import { CourseStatus } from '../course/enums/course-status.enum';
import { CourseType } from '../course/enums/course-type.enum';
import { Subject } from '@common/enums/subject.enum';

// ─── Class DTOs ────────────────────────────────────────────────

describe('CreateClassDto', () => {
  const valid = {
    courseCode: 'CS2026070001',
    name: '周六上午10点班',
    startDate: '2026-07-12',
    totalLessons: 20,
    defaultDuration: 60,
    dayOfWeek: [6],
    startTime: '10:00',
    endTime: '11:30',
  };

  it('should pass with valid data', async () => {
    const dto = plainToInstance(CreateClassDto, valid);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with optional fields', async () => {
    const dto = plainToInstance(CreateClassDto, {
      ...valid,
      maxStudents: 20,
      room: 'A301',
      tags: ['英语'],
      note: 'test',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when courseCode is empty', async () => {
    const dto = plainToInstance(CreateClassDto, { ...valid, courseCode: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when name is empty', async () => {
    const dto = plainToInstance(CreateClassDto, { ...valid, name: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when startDate is not YYYY-MM-DD', async () => {
    const dto = plainToInstance(CreateClassDto, { ...valid, startDate: '2026/07/12' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when totalLessons < 1', async () => {
    const dto = plainToInstance(CreateClassDto, { ...valid, totalLessons: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when defaultDuration < 15', async () => {
    const dto = plainToInstance(CreateClassDto, { ...valid, defaultDuration: 10 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when dayOfWeek is empty array', async () => {
    const dto = plainToInstance(CreateClassDto, { ...valid, dayOfWeek: [] });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when dayOfWeek has > 7 items', async () => {
    const dto = plainToInstance(CreateClassDto, {
      ...valid,
      dayOfWeek: [0, 1, 2, 3, 4, 5, 6, 0],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when startTime format is invalid', async () => {
    const dto = plainToInstance(CreateClassDto, { ...valid, startTime: '10:00:00' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when endTime format is invalid', async () => {
    const dto = plainToInstance(CreateClassDto, { ...valid, endTime: '11' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when maxStudents < 1', async () => {
    const dto = plainToInstance(CreateClassDto, { ...valid, maxStudents: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when courseCode exceeds 20 chars', async () => {
    const dto = plainToInstance(CreateClassDto, {
      ...valid,
      courseCode: 'A'.repeat(21),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when name exceeds 100 chars', async () => {
    const dto = plainToInstance(CreateClassDto, {
      ...valid,
      name: 'A'.repeat(101),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateClassDto', () => {
  it('should pass with all fields undefined', async () => {
    const dto = plainToInstance(UpdateClassDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with valid partial data', async () => {
    const dto = plainToInstance(UpdateClassDto, {
      name: '新班级名',
      totalLessons: 15,
      startTime: '09:00',
      endTime: '10:30',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when startDate format is invalid', async () => {
    const dto = plainToInstance(UpdateClassDto, { startDate: '07-12-2026' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when totalLessons < 1', async () => {
    const dto = plainToInstance(UpdateClassDto, { totalLessons: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when defaultDuration < 15', async () => {
    const dto = plainToInstance(UpdateClassDto, { defaultDuration: 5 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateClassStatusDto', () => {
  it('should pass with valid ClassStatus', async () => {
    const dto = plainToInstance(UpdateClassStatusDto, {
      status: ClassStatus.ACTIVE,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with CANCELLED and reason', async () => {
    const dto = plainToInstance(UpdateClassStatusDto, {
      status: ClassStatus.CANCELLED,
      cancelledReason: '家长要求',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail with invalid status', async () => {
    const dto = plainToInstance(UpdateClassStatusDto, {
      status: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('QueryClassDto', () => {
  it('should pass with no params', async () => {
    const dto = plainToInstance(QueryClassDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with valid filters', async () => {
    const dto = plainToInstance(QueryClassDto, {
      name: '周六',
      courseCode: 'CS2026070001',
      status: ClassStatus.ACTIVE,
      page: 1,
      pageSize: 20,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when page < 1', async () => {
    const dto = plainToInstance(QueryClassDto, { page: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when pageSize < 1', async () => {
    const dto = plainToInstance(QueryClassDto, { pageSize: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('AssignTeacherDto', () => {
  it('should pass with valid data', async () => {
    const dto = plainToInstance(AssignTeacherDto, {
      teacherId: 5001,
      role: TeacherRole.PRIMARY,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with reason', async () => {
    const dto = plainToInstance(AssignTeacherDto, {
      teacherId: 5001,
      role: TeacherRole.SUBSTITUTE,
      reason: '代课',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when teacherId is missing', async () => {
    const dto = plainToInstance(AssignTeacherDto, {
      role: TeacherRole.ASSISTANT,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when role is invalid', async () => {
    const dto = plainToInstance(AssignTeacherDto, {
      teacherId: 5001,
      role: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when reason exceeds 200 chars', async () => {
    const dto = plainToInstance(AssignTeacherDto, {
      teacherId: 5001,
      role: TeacherRole.PRIMARY,
      reason: 'A'.repeat(201),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── Course DTOs ───────────────────────────────────────────────

describe('CreateCourseDto', () => {
  const valid = {
    name: '少儿英语一级',
    subject: Subject.ENGLISH,
    type: CourseType.GROUP,
    totalHours: 40,
    totalLessons: 40,
    defaultDuration: 60,
  };

  it('should pass with valid data', async () => {
    const dto = plainToInstance(CreateCourseDto, valid);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with optional fields', async () => {
    const dto = plainToInstance(CreateCourseDto, {
      ...valid,
      description: '课程描述',
      tags: ['英语', '少儿'],
      coverImage: 'https://example.com/cover.jpg',
      note: '内部备注',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when name is empty', async () => {
    const dto = plainToInstance(CreateCourseDto, { ...valid, name: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when subject is invalid', async () => {
    const dto = plainToInstance(CreateCourseDto, {
      ...valid,
      subject: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when type is invalid', async () => {
    const dto = plainToInstance(CreateCourseDto, {
      ...valid,
      type: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when totalHours < 0.5', async () => {
    const dto = plainToInstance(CreateCourseDto, { ...valid, totalHours: 0.1 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when totalLessons < 1', async () => {
    const dto = plainToInstance(CreateCourseDto, { ...valid, totalLessons: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when defaultDuration < 15', async () => {
    const dto = plainToInstance(CreateCourseDto, { ...valid, defaultDuration: 10 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when name exceeds 100 chars', async () => {
    const dto = plainToInstance(CreateCourseDto, {
      ...valid,
      name: 'A'.repeat(101),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when coverImage exceeds 500 chars', async () => {
    const dto = plainToInstance(CreateCourseDto, {
      ...valid,
      coverImage: 'A'.repeat(501),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateCourseDto', () => {
  it('should pass with all fields undefined', async () => {
    const dto = plainToInstance(UpdateCourseDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with valid partial data', async () => {
    const dto = plainToInstance(UpdateCourseDto, {
      name: '新课程名',
      subject: Subject.MATH,
      type: CourseType.INDIVIDUAL,
      totalHours: 30,
      totalLessons: 30,
      defaultDuration: 45,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when name is empty string', async () => {
    const dto = plainToInstance(UpdateCourseDto, { name: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when subject is invalid', async () => {
    const dto = plainToInstance(UpdateCourseDto, { subject: 'INVALID' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when totalHours < 0.5', async () => {
    const dto = plainToInstance(UpdateCourseDto, { totalHours: 0.1 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateCourseStatusDto', () => {
  it('should pass with valid CourseStatus', async () => {
    const dto = plainToInstance(UpdateCourseStatusDto, {
      status: CourseStatus.PUBLISHED,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail with invalid status', async () => {
    const dto = plainToInstance(UpdateCourseStatusDto, {
      status: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('QueryCourseDto', () => {
  it('should pass with no params', async () => {
    const dto = plainToInstance(QueryCourseDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with valid filters', async () => {
    const dto = plainToInstance(QueryCourseDto, {
      name: '英语',
      subject: Subject.ENGLISH,
      type: CourseType.GROUP,
      status: CourseStatus.PUBLISHED,
      page: 1,
      pageSize: 20,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when page < 1', async () => {
    const dto = plainToInstance(QueryCourseDto, { page: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when pageSize < 1', async () => {
    const dto = plainToInstance(QueryCourseDto, { pageSize: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when subject is invalid', async () => {
    const dto = plainToInstance(QueryCourseDto, { subject: 'INVALID' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
