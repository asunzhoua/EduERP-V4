import { Test, TestingModule } from '@nestjs/testing';
import { LessonService, CreateLessonInput } from './lesson.service';
import { LessonRepository } from './lesson.repository';
import { LessonEntity } from './lesson.entity';
import { LessonStatus } from './enums/lesson-status.enum';
import { ClassRepository } from '../class/class.repository';
import { ClassStatus } from '../class/enums/class-status.enum';
import { EnrollmentRepository } from '../enrollment/enrollment.repository';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventBusService } from '@events/event-bus.service';
import { ReminderService } from '@modules/reminder/reminder.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Student } from '@modules/student/entities/student.entity';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));
jest.mock('@events/event-bus.service');

describe('LessonService', () => {
  let service: LessonService;
  let lessonRepo: jest.Mocked<LessonRepository>;
  let classRepo: jest.Mocked<ClassRepository>;
  let enrollmentRepo: jest.Mocked<EnrollmentRepository>;
  let mockPublish: jest.Mock;

  const mockLessonInput: CreateLessonInput = {
    classCode: 'CL2026070001',
    courseCode: 'CS2026070001',
    lessonNumber: 1,
    scheduledDate: '2026-07-12',
    startTime: '10:00',
    endTime: '11:30',
    teacherId: 5001,
  };

  const mockLesson: LessonEntity = {
    id: 1,
    classCode: 'CL2026070001',
    courseCode: 'CS2026070001',
    lessonNumber: 1,
    status: LessonStatus.DRAFT,
    scheduledDate: '2026-07-12',
    startTime: '10:00',
    endTime: '11:30',
    teacherId: 5001,
    actualStartTime: null,
    actualEndTime: null,
    note: null,
    cancelledReason: null,
    isMakeup: false,
    originLessonId: null,
    changeRequestId: null,
    confirmedBy: null,
    confirmedAt: null,
    createdBy: 0,
    createdAt: new Date(),
  };

  const mockActiveClass = {
    id: 1,
    classCode: 'CL2026070001',
    courseCode: 'CS2026070001',
    name: '周六上午班',
    status: ClassStatus.ACTIVE,
    startDate: '2026-07-01',
    totalLessons: 20,
    defaultDuration: 90,
    dayOfWeek: [6],
    startTime: '10:00',
    endTime: '11:30',
    maxStudents: 20,
    room: null,
    tags: null,
    note: null,
    cancelledReason: null,
    createdBy: 0,
    createTime: new Date(),
    updatedBy: null,
    updateTime: new Date(),
    version: 1,
    deleted: false,
  };

  beforeEach(async () => {
    const mockLessonRepo = {
      save: jest.fn(),
      saveAll: jest.fn(),
      findOneById: jest.fn(),
      findByClassCode: jest.fn(),
      findOneByClassCodeAndLessonNumber: jest.fn(),
      countByClassCode: jest.fn(),
    };

    const mockClassRepo = {
      findOneByCode: jest.fn(),
      save: jest.fn(),
      raw: { create: jest.fn() },
      findMany: jest.fn(),
    };

    const mockEnrollmentRepo = {
      findByClassAndStudent: jest.fn(),
      findByClassCode: jest.fn(),
      findByStudentCode: jest.fn(),
      save: jest.fn(),
      countActiveByClassCode: jest.fn(),
      findOneById: jest.fn(),
      findActiveByClassAndStudentCodes: jest.fn(),
    };

    mockPublish = jest.fn();
    const mockEventBus = {
      publish: mockPublish,
      subscribe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonService,
        { provide: LessonRepository, useValue: mockLessonRepo },
        { provide: ClassRepository, useValue: mockClassRepo },
        { provide: EnrollmentRepository, useValue: mockEnrollmentRepo },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: ReminderService, useValue: { createReminder: jest.fn().mockResolvedValue({ id: 1 }) } },
        { provide: getRepositoryToken(Student), useValue: { createQueryBuilder: jest.fn().mockReturnValue({ where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) }) } },
      ],
    }).compile();

    service = module.get<LessonService>(LessonService);
    lessonRepo = module.get(LessonRepository);
    classRepo = module.get(ClassRepository);
    enrollmentRepo = module.get(EnrollmentRepository);
  });

  // ─── Create ───

  describe('create', () => {
    it('should create a lesson with DRAFT status when all validations pass', async () => {
      classRepo.findOneByCode.mockResolvedValue({ ...mockActiveClass });
      lessonRepo.findOneByClassCodeAndLessonNumber.mockResolvedValue(null);
      lessonRepo.save.mockResolvedValue({ ...mockLesson });

      const result = await service.create(mockLessonInput);

      expect(result.status).toBe(LessonStatus.DRAFT);
      expect(result.classCode).toBe('CL2026070001');
      expect(result.lessonNumber).toBe(1);
    });

    it('should throw BadRequestException when endTime <= startTime', async () => {
      const input = { ...mockLessonInput, endTime: '09:00' };

      await expect(service.create(input)).rejects.toThrow(BadRequestException);
      await expect(service.create(input)).rejects.toThrow(
        'endTime must be greater than startTime',
      );
    });

    it('should throw BadRequestException when startTime format is invalid', async () => {
      const input = { ...mockLessonInput, startTime: '25:00' };

      await expect(service.create(input)).rejects.toThrow(BadRequestException);
      await expect(service.create(input)).rejects.toThrow(
        'must be in HH:MM format',
      );
    });

    it('should throw BadRequestException when endTime format is invalid', async () => {
      const input = { ...mockLessonInput, endTime: '9:00' };

      await expect(service.create(input)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when lessonNumber < 1', async () => {
      const input = { ...mockLessonInput, lessonNumber: 0 };

      await expect(service.create(input)).rejects.toThrow(BadRequestException);
      await expect(service.create(input)).rejects.toThrow(
        'positive integer',
      );
    });

    it('should throw BadRequestException when lessonNumber > 999', async () => {
      const input = { ...mockLessonInput, lessonNumber: 1000 };

      await expect(service.create(input)).rejects.toThrow(BadRequestException);
      await expect(service.create(input)).rejects.toThrow('<= 999');
    });

    it('should throw NotFoundException when class does not exist', async () => {
      classRepo.findOneByCode.mockResolvedValue(null);

      await expect(service.create(mockLessonInput)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(mockLessonInput)).rejects.toThrow(
        'Class not found',
      );
    });

    it('should throw BadRequestException when class is not ACTIVE', async () => {
      const draftClass = { ...mockActiveClass, status: ClassStatus.DRAFT };
      classRepo.findOneByCode.mockResolvedValue(draftClass);

      await expect(service.create(mockLessonInput)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockLessonInput)).rejects.toThrow(
        'not ACTIVE',
      );
    });

    it('should throw BadRequestException when courseCode mismatches class', async () => {
      classRepo.findOneByCode.mockResolvedValue({ ...mockActiveClass });
      const input = { ...mockLessonInput, courseCode: 'WRONG_COURSE' };

      await expect(service.create(input)).rejects.toThrow(BadRequestException);
      await expect(service.create(input)).rejects.toThrow('courseCode mismatch');
    });

    it('should throw BadRequestException when lessonNumber already exists', async () => {
      classRepo.findOneByCode.mockResolvedValue({ ...mockActiveClass });
      lessonRepo.findOneByClassCodeAndLessonNumber.mockResolvedValue(
        { ...mockLesson, lessonNumber: 1 },
      );

      await expect(service.create(mockLessonInput)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockLessonInput)).rejects.toThrow(
        'already exists',
      );
    });

    it('should pass when lessonNumber exists but is CANCELLED (can reuse)', async () => {
      classRepo.findOneByCode.mockResolvedValue({ ...mockActiveClass });
      lessonRepo.findOneByClassCodeAndLessonNumber.mockResolvedValue(
        { ...mockLesson, id: 5, lessonNumber: 1, status: LessonStatus.CANCELLED },
      );
      lessonRepo.save.mockResolvedValue({ ...mockLesson });

      const result = await service.create(mockLessonInput);
      expect(result.lessonNumber).toBe(1);
    });
  });

  // ─── CreateBatch ───

  describe('createBatch', () => {
    it('should batch create lessons with SCHEDULED status (skip DRAFT)', async () => {
      const inputs = [
        { ...mockLessonInput, lessonNumber: 1, scheduledDate: '2026-07-12' },
        { ...mockLessonInput, lessonNumber: 2, scheduledDate: '2026-07-19' },
        { ...mockLessonInput, lessonNumber: 3, scheduledDate: '2026-07-26' },
      ];
      lessonRepo.saveAll.mockResolvedValue(
        inputs.map((inp, i) => ({
          ...mockLesson,
          id: i + 1,
          lessonNumber: inp.lessonNumber,
          scheduledDate: inp.scheduledDate,
          status: LessonStatus.SCHEDULED,
        })),
      );

      const result = await service.createBatch(inputs);

      expect(result).toHaveLength(3);
      expect(result[0].status).toBe(LessonStatus.SCHEDULED);
      expect(result[1].status).toBe(LessonStatus.SCHEDULED);
      expect(result[2].lessonNumber).toBe(3);
    });

    it('should throw BadRequestException for empty inputs', async () => {
      await expect(service.createBatch([])).rejects.toThrow(BadRequestException);
    });

    it('should validate time format in batch', async () => {
      const inputs = [
        { ...mockLessonInput, lessonNumber: 1, endTime: '25:00' },
      ];

      await expect(service.createBatch(inputs)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate endTime > startTime in batch', async () => {
      const inputs = [
        { ...mockLessonInput, lessonNumber: 1, endTime: '09:00' },
      ];

      await expect(service.createBatch(inputs)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Read ───

  describe('findOne', () => {
    it('should return a lesson when found', async () => {
      lessonRepo.findOneById.mockResolvedValue({ ...mockLesson });
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException when not found', async () => {
      lessonRepo.findOneById.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByClassCode', () => {
    it('should return lessons for a class', async () => {
      lessonRepo.findByClassCode.mockResolvedValue([
        { ...mockLesson, lessonNumber: 1 },
        { ...mockLesson, id: 2, lessonNumber: 2 },
      ]);
      const result = await service.findByClassCode('CL2026070001');
      expect(result).toHaveLength(2);
    });
  });

  // ─── Data Consistency: Enrollment Checks ───

  describe('ensureStudentEnrolled', () => {
    it('should pass when student is actively enrolled', async () => {
      enrollmentRepo.findByClassAndStudent.mockResolvedValue({
        classCode: 'CL2026070001',
        studentCode: 'STU001',
        status: EnrollmentStatus.ACTIVE,
      } as any);

      await expect(
        service.ensureStudentEnrolled('CL2026070001', 'STU001'),
      ).resolves.toBeUndefined();
    });

    it('should throw when student is not enrolled', async () => {
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(null);

      await expect(
        service.ensureStudentEnrolled('CL2026070001', 'STU001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when enrollment is not ACTIVE', async () => {
      enrollmentRepo.findByClassAndStudent.mockResolvedValue({
        classCode: 'CL2026070001',
        studentCode: 'STU001',
        status: EnrollmentStatus.WITHDRAWN,
      } as any);

      await expect(
        service.ensureStudentEnrolled('CL2026070001', 'STU001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ensureAllStudentsEnrolled', () => {
    it('should pass when all students are enrolled', async () => {
      enrollmentRepo.findActiveByClassAndStudentCodes.mockResolvedValue([
        { studentCode: 'STU001', status: EnrollmentStatus.ACTIVE } as any,
        { studentCode: 'STU002', status: EnrollmentStatus.ACTIVE } as any,
      ]);

      await expect(
        service.ensureAllStudentsEnrolled('CL2026070001', ['STU001', 'STU002']),
      ).resolves.toBeUndefined();
    });

    it('should throw when some students are not enrolled', async () => {
      enrollmentRepo.findActiveByClassAndStudentCodes.mockResolvedValue([
        { studentCode: 'STU001', status: EnrollmentStatus.ACTIVE } as any,
      ]);

      await expect(
        service.ensureAllStudentsEnrolled('CL2026070001', ['STU001', 'STU002']),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.ensureAllStudentsEnrolled('CL2026070001', ['STU001', 'STU002']),
      ).rejects.toThrow(/STU002/);
    });
  });

  // ─── Status Transitions ───

  describe('updateStatus', () => {
    it('should allow DRAFT -> SCHEDULED', async () => {
      lessonRepo.findOneById.mockResolvedValue({ ...mockLesson });
      lessonRepo.save.mockResolvedValue({
        ...mockLesson,
        status: LessonStatus.SCHEDULED,
      });

      const result = await service.updateStatus(1, LessonStatus.SCHEDULED, 1);
      expect(result.status).toBe(LessonStatus.SCHEDULED);
    });

    it('should allow SCHEDULED -> TEACHING (fills actualStartTime)', async () => {
      const scheduled = { ...mockLesson, status: LessonStatus.SCHEDULED };
      lessonRepo.findOneById.mockResolvedValue(scheduled);
      lessonRepo.save.mockResolvedValue({
        ...scheduled,
        status: LessonStatus.TEACHING,
        actualStartTime: new Date(),
      });

      const result = await service.updateStatus(1, LessonStatus.TEACHING, 1);
      expect(result.status).toBe(LessonStatus.TEACHING);
      expect(result.actualStartTime).not.toBeNull();
    });

    it('should allow TEACHING -> FINISHED (fills actualEndTime)', async () => {
      const teaching = {
        ...mockLesson,
        status: LessonStatus.TEACHING,
        actualStartTime: new Date(),
      };
      lessonRepo.findOneById.mockResolvedValue(teaching);
      lessonRepo.save.mockResolvedValue({
        ...teaching,
        status: LessonStatus.FINISHED,
        actualEndTime: new Date(),
      });

      const result = await service.updateStatus(1, LessonStatus.FINISHED, 1);
      expect(result.status).toBe(LessonStatus.FINISHED);
      expect(result.actualEndTime).not.toBeNull();
    });

    it('should allow FINISHED -> ARCHIVED', async () => {
      const finished = {
        ...mockLesson,
        status: LessonStatus.FINISHED,
        actualEndTime: new Date(),
      };
      lessonRepo.findOneById.mockResolvedValue(finished);
      lessonRepo.save.mockResolvedValue({
        ...finished,
        status: LessonStatus.ARCHIVED,
      });

      const result = await service.updateStatus(1, LessonStatus.ARCHIVED, 1);
      expect(result.status).toBe(LessonStatus.ARCHIVED);
    });

    it('should allow ARCHIVED -> FINISHED (reopen, requires reason)', async () => {
      const archived = { ...mockLesson, status: LessonStatus.ARCHIVED };
      lessonRepo.findOneById.mockResolvedValue(archived);
      lessonRepo.save.mockResolvedValue({
        ...archived,
        status: LessonStatus.FINISHED,
      });

      const result = await service.updateStatus(
        1,
        LessonStatus.FINISHED,
        1,
        '管理员确认补录出勤',
      );
      expect(result.status).toBe(LessonStatus.FINISHED);
    });

    it('should allow FINISHED -> SCHEDULED (reopen, safe — no money moved)', async () => {
      const finished = { ...mockLesson, status: LessonStatus.FINISHED };
      lessonRepo.findOneById.mockResolvedValue(finished);
      lessonRepo.save.mockResolvedValue({
        ...finished,
        status: LessonStatus.SCHEDULED,
      });

      const result = await service.updateStatus(
        1,
        LessonStatus.SCHEDULED,
        1,
        '家长反馈学生当天请假，需重新记录考勤',
      );
      expect(result.status).toBe(LessonStatus.SCHEDULED);
    });

    it('should allow SCHEDULED -> CANCELLED (with reason)', async () => {
      const scheduled = { ...mockLesson, status: LessonStatus.SCHEDULED };
      lessonRepo.findOneById.mockResolvedValue(scheduled);
      lessonRepo.save.mockResolvedValue({
        ...scheduled,
        status: LessonStatus.CANCELLED,
        cancelledReason: '老师生病',
      });

      const result = await service.updateStatus(
        1,
        LessonStatus.CANCELLED,
        1,
        '老师生病',
      );
      expect(result.status).toBe(LessonStatus.CANCELLED);
    });

    it('should allow CANCELLED -> SCHEDULED (reopen)', async () => {
      const cancelled = {
        ...mockLesson,
        status: LessonStatus.CANCELLED,
        cancelledReason: '老师生病',
      };
      lessonRepo.findOneById.mockResolvedValue(cancelled);
      lessonRepo.save.mockResolvedValue({
        ...cancelled,
        status: LessonStatus.SCHEDULED,
      });

      const result = await service.updateStatus(
        1,
        LessonStatus.SCHEDULED,
        1,
        '补课安排，重新排期',
      );
      expect(result.status).toBe(LessonStatus.SCHEDULED);
    });

    // ─── Illegal Transitions ───

    it('should block DRAFT -> TEACHING (must go through SCHEDULED)', async () => {
      lessonRepo.findOneById.mockResolvedValue({ ...mockLesson });

      await expect(
        service.updateStatus(1, LessonStatus.TEACHING, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block DRAFT -> FINISHED', async () => {
      lessonRepo.findOneById.mockResolvedValue({ ...mockLesson });

      await expect(
        service.updateStatus(1, LessonStatus.FINISHED, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block ARCHIVED -> SCHEDULED (must go through FINISHED)', async () => {
      const archived = { ...mockLesson, status: LessonStatus.ARCHIVED };
      lessonRepo.findOneById.mockResolvedValue(archived);

      await expect(
        service.updateStatus(1, LessonStatus.SCHEDULED, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block ARCHIVED -> TEACHING', async () => {
      const archived = { ...mockLesson, status: LessonStatus.ARCHIVED };
      lessonRepo.findOneById.mockResolvedValue(archived);

      await expect(
        service.updateStatus(1, LessonStatus.TEACHING, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block same-status transition', async () => {
      lessonRepo.findOneById.mockResolvedValue({ ...mockLesson });

      await expect(
        service.updateStatus(1, LessonStatus.DRAFT, 1),
      ).rejects.toThrow(BadRequestException);
    });

    // ─── Guard: CANCELLED requires reason ───

    it('should block CANCELLED without reason', async () => {
      const scheduled = { ...mockLesson, status: LessonStatus.SCHEDULED };
      lessonRepo.findOneById.mockResolvedValue(scheduled);

      await expect(
        service.updateStatus(1, LessonStatus.CANCELLED, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block CANCELLED with empty reason', async () => {
      const scheduled = { ...mockLesson, status: LessonStatus.SCHEDULED };
      lessonRepo.findOneById.mockResolvedValue(scheduled);

      await expect(
        service.updateStatus(1, LessonStatus.CANCELLED, 1, '  '),
      ).rejects.toThrow(BadRequestException);
    });

    // ─── Guard: ARCHIVED -> FINISHED requires reason ───

    it('should block ARCHIVED -> FINISHED without reason', async () => {
      const archived = { ...mockLesson, status: LessonStatus.ARCHIVED };
      lessonRepo.findOneById.mockResolvedValue(archived);

      await expect(
        service.updateStatus(1, LessonStatus.FINISHED, 1),
      ).rejects.toThrow(BadRequestException);
    });

    // ─── Guard: FINISHED -> SCHEDULED requires reason ───

    it('should block FINISHED -> SCHEDULED without reason', async () => {
      const finished = { ...mockLesson, status: LessonStatus.FINISHED };
      lessonRepo.findOneById.mockResolvedValue(finished);

      await expect(
        service.updateStatus(1, LessonStatus.SCHEDULED, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block FINISHED -> SCHEDULED with empty reason', async () => {
      const finished = { ...mockLesson, status: LessonStatus.FINISHED };
      lessonRepo.findOneById.mockResolvedValue(finished);

      await expect(
        service.updateStatus(1, LessonStatus.SCHEDULED, 1, '  '),
      ).rejects.toThrow(BadRequestException);
    });

    // ─── Guard: CANCELLED -> SCHEDULED requires reason ───

    it('should block CANCELLED -> SCHEDULED without reason', async () => {
      const cancelled = {
        ...mockLesson,
        status: LessonStatus.CANCELLED,
        cancelledReason: '老师生病',
      };
      lessonRepo.findOneById.mockResolvedValue(cancelled);

      await expect(
        service.updateStatus(1, LessonStatus.SCHEDULED, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block CANCELLED -> SCHEDULED with empty reason', async () => {
      const cancelled = {
        ...mockLesson,
        status: LessonStatus.CANCELLED,
        cancelledReason: '老师生病',
      };
      lessonRepo.findOneById.mockResolvedValue(cancelled);

      await expect(
        service.updateStatus(1, LessonStatus.SCHEDULED, 1, '  '),
      ).rejects.toThrow(BadRequestException);
    });

    // ─── Event Publishing ───

    describe('Event Publishing', () => {
      it('should publish lesson.completed on TEACHING -> FINISHED', async () => {
        const teaching = {
          ...mockLesson,
          status: LessonStatus.TEACHING,
          actualStartTime: new Date('2026-07-14T09:00:00Z'),
        };
        const finished = {
          ...teaching,
          status: LessonStatus.FINISHED,
          actualEndTime: new Date('2026-07-14T10:30:00Z'),
        };
        lessonRepo.findOneById.mockResolvedValue(teaching);
        lessonRepo.save.mockResolvedValue(finished);

        await service.updateStatus(1, LessonStatus.FINISHED, 1);

        expect(mockPublish).toHaveBeenCalledTimes(1);
        expect(mockPublish).toHaveBeenCalledWith(
          'lesson.completed',
          expect.objectContaining({
            lessonId: 1,
            classCode: 'CL2026070001',
            courseCode: 'CS2026070001',
            teacherId: 5001,
            scheduledDate: '2026-07-12',
            durationMinutes: 90,
          }),
        );
      });

      it('should publish lesson.finished on FINISHED -> ARCHIVED', async () => {
        const finished = {
          ...mockLesson,
          status: LessonStatus.FINISHED,
          actualEndTime: new Date('2026-07-14T10:30:00Z'),
        };
        const archived = {
          ...finished,
          status: LessonStatus.ARCHIVED,
        };
        lessonRepo.findOneById.mockResolvedValue(finished);
        lessonRepo.save.mockResolvedValue(archived);

        await service.updateStatus(1, LessonStatus.ARCHIVED, 5001);

        expect(mockPublish).toHaveBeenCalledTimes(1);
        expect(mockPublish).toHaveBeenCalledWith(
          'lesson.finished',
          expect.objectContaining({
            lessonId: 1,
            classCode: 'CL2026070001',
            courseCode: 'CS2026070001',
            teacherId: 5001,
            confirmedBy: 5001,
          }),
        );
      });

      it('should NOT publish events for non-lifecycle transitions', async () => {
        lessonRepo.findOneById.mockResolvedValue({ ...mockLesson });
        lessonRepo.save.mockResolvedValue({
          ...mockLesson,
          status: LessonStatus.SCHEDULED,
        });

        await service.updateStatus(1, LessonStatus.SCHEDULED, 1);

        expect(mockPublish).not.toHaveBeenCalled();
      });

      it('should NOT publish events for invalid transitions', async () => {
        lessonRepo.findOneById.mockResolvedValue({ ...mockLesson });

        await expect(
          service.updateStatus(1, LessonStatus.FINISHED, 1),
        ).rejects.toThrow(BadRequestException);

        expect(mockPublish).not.toHaveBeenCalled();
      });

      it('lesson.completed payload should have all EventSchema fields', async () => {
        const teaching = {
          ...mockLesson,
          status: LessonStatus.TEACHING,
          actualStartTime: new Date('2026-07-14T09:00:00Z'),
        };
        const finished = {
          ...teaching,
          status: LessonStatus.FINISHED,
          actualEndTime: new Date('2026-07-14T10:30:00Z'),
        };
        lessonRepo.findOneById.mockResolvedValue(teaching);
        lessonRepo.save.mockResolvedValue(finished);

        await service.updateStatus(1, LessonStatus.FINISHED, 1);

        const calls = mockPublish.mock.calls as unknown[][];
        const payload = calls[0][1] as Record<string, unknown>;
        expect(payload).toHaveProperty('lessonId');
        expect(payload).toHaveProperty('classCode');
        expect(payload).toHaveProperty('courseCode');
        expect(payload).toHaveProperty('teacherId');
        expect(payload).toHaveProperty('scheduledDate');
        expect(payload).toHaveProperty('actualStartTime');
        expect(payload).toHaveProperty('actualEndTime');
        expect(payload).toHaveProperty('durationMinutes');
      });

      it('lesson.finished payload should have all EventSchema fields', async () => {
        const finished = {
          ...mockLesson,
          status: LessonStatus.FINISHED,
          actualEndTime: new Date('2026-07-14T10:30:00Z'),
        };
        const archived = {
          ...finished,
          status: LessonStatus.ARCHIVED,
        };
        lessonRepo.findOneById.mockResolvedValue(finished);
        lessonRepo.save.mockResolvedValue(archived);

        await service.updateStatus(1, LessonStatus.ARCHIVED, 5001);

        const calls = mockPublish.mock.calls as unknown[][];
        const payload = calls[0][1] as Record<string, unknown>;
        expect(payload).toHaveProperty('lessonId');
        expect(payload).toHaveProperty('classCode');
        expect(payload).toHaveProperty('courseCode');
        expect(payload).toHaveProperty('teacherId');
        expect(payload).toHaveProperty('scheduledDate');
        expect(payload).toHaveProperty('actualStartTime');
        expect(payload).toHaveProperty('actualEndTime');
        expect(payload).toHaveProperty('durationMinutes');
        expect(payload).toHaveProperty('confirmedBy');
        expect(payload).toHaveProperty('confirmedAt');
      });
    });
  });
});
