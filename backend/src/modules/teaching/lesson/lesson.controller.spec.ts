import { Test, TestingModule } from '@nestjs/testing';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { LessonRepository } from './lesson.repository';
import { LessonStatus } from './enums/lesson-status.enum';
import { ClassService } from '../class/class.service';
import { LessonAttendanceService } from '../lesson-attendance/lesson-attendance.service';
import { TeacherRole } from '@common/enums/teacher-role.enum';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

describe('LessonController', () => {
  let controller: LessonController;
  let service: jest.Mocked<LessonService>;

  const mockLesson = {
    id: 42,
    classCode: 'TEST01',
    lessonNumber: 3,
    status: LessonStatus.SCHEDULED,
    courseCode: 'CS101',
    scheduledDate: '2026-09-01',
    startTime: '09:00',
    endTime: '10:30',
    teacherId: 7,
  };

  const mockLessonService = {
    create: jest.fn(),
    findByClassCode: jest.fn(),
    findByClassCodeAndLessonNumber: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockLessonRepository = {
    findMaxLessonNumber: jest.fn(),
  };

  const mockClassService = {
    findByCode: jest.fn(),
    getTeachers: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
    assignTeacher: jest.fn(),
    removeTeacher: jest.fn(),
  };

  const mockLessonAttendanceService = {
    autoCreateForLesson: jest.fn(),
    batchRollCall: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonController],
      providers: [
        { provide: LessonService, useValue: mockLessonService },
        { provide: LessonRepository, useValue: mockLessonRepository },
        { provide: ClassService, useValue: mockClassService },
        {
          provide: LessonAttendanceService,
          useValue: mockLessonAttendanceService,
        },
      ],
    }).compile();

    controller = module.get(LessonController);
    service = module.get(LessonService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Existing tests ───

  it('findByClass should return lessons', async () => {
    const result = [{ id: 1, lessonNumber: 1, status: 'SCHEDULED' }];
    service.findByClassCode = jest.fn().mockResolvedValue(result);
    expect(await controller.findByClass('TEST01')).toBe(result);
  });

  // ─── findOne ───

  describe('findOne', () => {
    it('should call findByClassCodeAndLessonNumber with code and lessonNumber', async () => {
      service.findByClassCodeAndLessonNumber.mockResolvedValue(mockLesson as any);
      const result = await controller.findOne('TEST01', 3);

      expect(service.findByClassCodeAndLessonNumber).toHaveBeenCalledWith('TEST01', 3);
      expect(result).toBe(mockLesson);
    });

    it('should propagate errors from the service', async () => {
      service.findByClassCodeAndLessonNumber.mockRejectedValue(
        new Error('Lesson not found'),
      );

      await expect(controller.findOne('TEST01', 99)).rejects.toThrow('Lesson not found');
      expect(service.findByClassCodeAndLessonNumber).toHaveBeenCalledWith('TEST01', 99);
    });
  });

  // ─── start ───

  describe('start', () => {
    it('should look up the lesson then call updateStatus with TEACHING', async () => {
      service.findByClassCodeAndLessonNumber.mockResolvedValue(mockLesson as any);
      const updated = { ...mockLesson, status: LessonStatus.TEACHING };
      service.updateStatus.mockResolvedValue(updated as any);

      const result = await controller.start('TEST01', 3);

      expect(service.findByClassCodeAndLessonNumber).toHaveBeenCalledWith('TEST01', 3);
      expect(service.updateStatus).toHaveBeenCalledWith(42, LessonStatus.TEACHING, 0);
      expect(result).toBe(updated);
    });

    it('should throw if lesson is not found', async () => {
      service.findByClassCodeAndLessonNumber.mockRejectedValue(
        new Error('Lesson not found'),
      );

      await expect(controller.start('TEST01', 99)).rejects.toThrow('Lesson not found');
      expect(service.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ─── complete ───

  describe('complete', () => {
    it('should look up the lesson then call updateStatus with FINISHED', async () => {
      service.findByClassCodeAndLessonNumber.mockResolvedValue(mockLesson as any);
      const updated = { ...mockLesson, status: LessonStatus.FINISHED };
      service.updateStatus.mockResolvedValue(updated as any);

      const result = await controller.complete('TEST01', 3);

      expect(service.findByClassCodeAndLessonNumber).toHaveBeenCalledWith('TEST01', 3);
      expect(service.updateStatus).toHaveBeenCalledWith(42, LessonStatus.FINISHED, 0);
      expect(result).toBe(updated);
    });

    it('should throw if lesson is not found', async () => {
      service.findByClassCodeAndLessonNumber.mockRejectedValue(
        new Error('Lesson not found'),
      );

      await expect(controller.complete('TEST01', 99)).rejects.toThrow('Lesson not found');
      expect(service.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ─── confirm ───

  describe('confirm', () => {
    it('should look up the lesson then call updateStatus with ARCHIVED', async () => {
      service.findByClassCodeAndLessonNumber.mockResolvedValue(mockLesson as any);
      const updated = { ...mockLesson, status: LessonStatus.ARCHIVED };
      service.updateStatus.mockResolvedValue(updated as any);

      const result = await controller.confirm('TEST01', 3);

      expect(service.findByClassCodeAndLessonNumber).toHaveBeenCalledWith('TEST01', 3);
      expect(service.updateStatus).toHaveBeenCalledWith(42, LessonStatus.ARCHIVED, 0);
      expect(result).toBe(updated);
    });

    it('should throw if lesson is not found', async () => {
      service.findByClassCodeAndLessonNumber.mockRejectedValue(
        new Error('Lesson not found'),
      );

      await expect(controller.confirm('TEST01', 99)).rejects.toThrow('Lesson not found');
      expect(service.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ─── cancel ───

  describe('cancel', () => {
    it('should look up the lesson then call updateStatus with CANCELLED and reason', async () => {
      service.findByClassCodeAndLessonNumber.mockResolvedValue(mockLesson as any);
      const updated = { ...mockLesson, status: LessonStatus.CANCELLED };
      service.updateStatus.mockResolvedValue(updated as any);

      const body = { reason: '教师请假' };
      const result = await controller.cancel('TEST01', 3, body as any);

      expect(service.findByClassCodeAndLessonNumber).toHaveBeenCalledWith('TEST01', 3);
      expect(service.updateStatus).toHaveBeenCalledWith(
        42,
        LessonStatus.CANCELLED,
        0,
        '教师请假',
      );
      expect(result).toBe(updated);
    });

    it('should throw if lesson is not found', async () => {
      service.findByClassCodeAndLessonNumber.mockRejectedValue(
        new Error('Lesson not found'),
      );

      await expect(
        controller.cancel('TEST01', 99, { reason: '教师请假' } as any),
      ).rejects.toThrow('Lesson not found');
      expect(service.updateStatus).not.toHaveBeenCalled();
    });

    it('should propagate the reason from the request body', async () => {
      service.findByClassCodeAndLessonNumber.mockResolvedValue(mockLesson as any);
      const updated = { ...mockLesson, status: LessonStatus.CANCELLED };
      service.updateStatus.mockResolvedValue(updated as any);

      const reason = '教室不可用，需要调课';
      await controller.cancel('TEST01', 3, { reason } as any);

      expect(service.updateStatus).toHaveBeenCalledWith(
        42,
        LessonStatus.CANCELLED,
        0,
        reason,
      );
    });
  });

  // ─── createMakeup ───

  describe('createMakeup', () => {
    it('should call create with classCode from param, isMakeup=true, and body fields', async () => {
      const makeupLesson = {
        id: 100,
        classCode: 'TEST01',
        courseCode: 'CS101',
        lessonNumber: 99,
        status: 'DRAFT',
        scheduledDate: '2026-08-01',
        startTime: '14:00',
        endTime: '15:30',
        teacherId: 7,
        isMakeup: true,
        originLessonId: 42,
      };
      service.create = jest.fn().mockResolvedValue(makeupLesson);

      const body = {
        courseCode: 'CS101',
        lessonNumber: 99,
        scheduledDate: '2026-08-01',
        startTime: '14:00',
        endTime: '15:30',
        teacherId: 7,
        originLessonId: 42,
      };

      const result = await controller.createMakeup('TEST01', body as any);

      expect(service.create).toHaveBeenCalledWith({
        classCode: 'TEST01',
        courseCode: 'CS101',
        lessonNumber: 99,
        scheduledDate: '2026-08-01',
        startTime: '14:00',
        endTime: '15:30',
        teacherId: 7,
        isMakeup: true,
        originLessonId: 42,
        createdBy: 0,
      });
      expect(result).toBe(makeupLesson);
    });

    it('should pass originLessonId as undefined when not provided', async () => {
      const makeupLesson = { id: 101, isMakeup: true };
      service.create = jest.fn().mockResolvedValue(makeupLesson);

      const body = {
        courseCode: 'CS101',
        lessonNumber: 10,
        scheduledDate: '2026-08-01',
        startTime: '09:00',
        endTime: '10:30',
        teacherId: 1,
      };

      await controller.createMakeup('TEST01', body as any);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          classCode: 'TEST01',
          isMakeup: true,
          originLessonId: undefined,
        }),
      );
    });

    it('should propagate errors from the service', async () => {
      service.create = jest.fn().mockRejectedValue(
        new Error('Class not found: TEST01'),
      );

      const body = {
        courseCode: 'CS101',
        lessonNumber: 1,
        scheduledDate: '2026-08-01',
        startTime: '09:00',
        endTime: '10:30',
        teacherId: 1,
      };

      await expect(
        controller.createMakeup('TEST01', body as any),
      ).rejects.toThrow('Class not found: TEST01');
    });
  });
});
