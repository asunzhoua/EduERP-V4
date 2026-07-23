import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherDashboardController } from './teacher-dashboard.controller';
import { TeacherAssignmentEntity } from '../teacher-assignment/teacher-assignment.entity';
import { ClassEntity } from '../class/class.entity';
import { LessonEntity } from '../lesson/lesson.entity';
import { LessonAttendanceEntity } from '../lesson-attendance/lesson-attendance.entity';

describe('TeacherDashboardController', () => {
  let controller: TeacherDashboardController;

  const mockTeacherAssignmentRepo = {
    find: jest.fn(),
  };

  const mockClassRepo = {
    find: jest.fn(),
  };

  const mockLessonRepo = {
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockLessonAttendanceRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeacherDashboardController],
      providers: [
        {
          provide: getRepositoryToken(TeacherAssignmentEntity),
          useValue: mockTeacherAssignmentRepo,
        },
        {
          provide: getRepositoryToken(ClassEntity),
          useValue: mockClassRepo,
        },
        {
          provide: getRepositoryToken(LessonEntity),
          useValue: mockLessonRepo,
        },
        {
          provide: getRepositoryToken(LessonAttendanceEntity),
          useValue: mockLessonAttendanceRepo,
        },
      ],
    }).compile();

    controller = module.get<TeacherDashboardController>(TeacherDashboardController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── getDashboard — GET /teacher/dashboard ───

  describe('getDashboard', () => {
    it('should return zeros when teacher has no assignments', async () => {
      mockTeacherAssignmentRepo.find.mockResolvedValue([]);

      const mockReq = { user: { sub: 100 } };
      const result = await controller.getDashboard(mockReq);

      expect(result).toBeDefined();
      expect(result.data!.todayLessons).toBe(0);
      expect(result.data!.pendingAttendance).toBe(0);
      expect(result.data!.totalStudents).toBe(0);
    });

    it('should return dashboard stats when teacher has assignments', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockTeacherAssignmentRepo.find.mockResolvedValue([
        { classCode: 'CLS-001', teacherId: 100 },
        { classCode: 'CLS-002', teacherId: 100 },
      ]);

      mockLessonRepo.count.mockResolvedValue(3);
      mockLessonRepo.find.mockResolvedValue([
        { id: 1, classCode: 'CLS-001' },
        { id: 2, classCode: 'CLS-001' },
        { id: 3, classCode: 'CLS-002' },
      ]);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ lessonId: 1 }]),
      };
      mockLessonAttendanceRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      mockClassRepo.find.mockResolvedValue([
        { classCode: 'CLS-001', currentStudents: 15 },
        { classCode: 'CLS-002', currentStudents: 10 },
      ]);

      const mockReq = { user: { sub: 100 } };
      const result = await controller.getDashboard(mockReq);

      expect(result).toBeDefined();
      expect(result.data!.todayLessons).toBe(3);
      expect(result.data!.pendingAttendance).toBe(2); // 3 total - 1 with attendance
      expect(result.data!.totalStudents).toBe(25); // 15 + 10
    });

    it('should handle no lessons today', async () => {
      mockTeacherAssignmentRepo.find.mockResolvedValue([
        { classCode: 'CLS-001', teacherId: 100 },
      ]);

      mockLessonRepo.count.mockResolvedValue(0);
      mockLessonRepo.find.mockResolvedValue([]);

      const mockReq = { user: { sub: 100 } };
      const result = await controller.getDashboard(mockReq);

      expect(result.data!.todayLessons).toBe(0);
      expect(result.data!.pendingAttendance).toBe(0);
    });
  });
});
