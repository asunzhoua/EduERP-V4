import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { LoginLog } from '@modules/identity/entities/login-log.entity';
import { Student } from '@modules/student/entities/student.entity';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { TeacherAssignmentEntity } from '@modules/teaching/teacher-assignment/teacher-assignment.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { AttendanceStatus } from '@modules/teaching/lesson-attendance/enums/attendance-status.enum';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockLoginLogRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockStudentRepo = {
    count: jest.fn(),
  };

  const mockEnrollmentRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLessonRepo = {
    count: jest.fn(),
  };

  const mockLessonAttendanceRepo = {
    find: jest.fn(),
  };

  const mockTeacherAssignmentRepo = {
    find: jest.fn(),
  };

  const mockCourseRepo = {
    count: jest.fn(),
  };

  const mockClassRepo = {
    find: jest.fn(),
    count: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(LoginLog), useValue: mockLoginLogRepo },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: mockEnrollmentRepo },
        { provide: getRepositoryToken(LessonEntity), useValue: mockLessonRepo },
        { provide: getRepositoryToken(LessonAttendanceEntity), useValue: mockLessonAttendanceRepo },
        { provide: getRepositoryToken(TeacherAssignmentEntity), useValue: mockTeacherAssignmentRepo },
        { provide: getRepositoryToken(CourseEntity), useValue: mockCourseRepo },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getStudentMetrics ───

  describe('getStudentMetrics', () => {
    it('should return all 8 student metrics with correct structure', async () => {
      // Mock DAU/WAU/MAU query builder chain
      const mockQbChain = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
      };
      mockLoginLogRepo.createQueryBuilder
        .mockReturnValueOnce({ ...mockQbChain, getRawOne: jest.fn().mockResolvedValue({ count: '5' }) })
        .mockReturnValueOnce({ ...mockQbChain, getRawOne: jest.fn().mockResolvedValue({ count: '20' }) })
        .mockReturnValueOnce({ ...mockQbChain, getRawOne: jest.fn().mockResolvedValue({ count: '80' }) });

      // Mock attendance data
      mockLessonAttendanceRepo.find.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.ONLINE },
        { status: null },
      ]);

      // Mock enrollments
      mockEnrollmentRepo.find.mockResolvedValue([
        { classCode: 'CLS-001', status: EnrollmentStatus.ACTIVE },
      ]);

      // Mock lesson count
      mockLessonRepo.count.mockResolvedValue(8);

      // Mock class data
      mockClassRepo.find.mockResolvedValue([
        { classCode: 'CLS-001', totalLessons: 20 },
      ]);

      const result = await service.getStudentMetrics('STU-001');

      expect(result.metrics).toHaveLength(8);
      expect(result.metrics[0]).toEqual({ name: 'dau', value: 5, unit: '人' });
      expect(result.metrics[1]).toEqual({ name: 'wau', value: 20, unit: '人' });
      expect(result.metrics[2]).toEqual({ name: 'mau', value: 80, unit: '人' });
      expect(result.metrics[3]).toEqual({ name: 'totalAttendance', value: 4, unit: '次' }); // PRESENT+PRESENT+LATE+ONLINE
      expect(result.metrics[4].name).toBe('attendanceRate');
      expect(result.metrics[5].name).toBe('absenceRate');
      expect(result.metrics[6].name).toBe('lateRate');
      expect(result.metrics[7]).toEqual({ name: 'courseProgress', value: 40, unit: '%' }); // 8/20 = 40%
    });

    it('should handle empty attendance data (division by zero protection)', async () => {
      const mockQbChain = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '0' }),
      };
      mockLoginLogRepo.createQueryBuilder
        .mockReturnValueOnce(mockQbChain)
        .mockReturnValueOnce(mockQbChain)
        .mockReturnValueOnce(mockQbChain);

      mockLessonAttendanceRepo.find.mockResolvedValue([]);
      mockEnrollmentRepo.find.mockResolvedValue([]);

      const result = await service.getStudentMetrics('STU-EMPTY');

      expect(result.metrics).toHaveLength(8);
      // All rates should be 0 when no records
      expect(result.metrics.find(m => m.name === 'attendanceRate')!.value).toBe(0);
      expect(result.metrics.find(m => m.name === 'absenceRate')!.value).toBe(0);
      expect(result.metrics.find(m => m.name === 'lateRate')!.value).toBe(0);
      expect(result.metrics.find(m => m.name === 'courseProgress')!.value).toBe(0);
    });

    it('should calculate attendance rates correctly', async () => {
      const mockQbChain = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '0' }),
      };
      mockLoginLogRepo.createQueryBuilder
        .mockReturnValueOnce(mockQbChain)
        .mockReturnValueOnce(mockQbChain)
        .mockReturnValueOnce(mockQbChain);

      // 10 records: 6 PRESENT, 2 LATE, 1 ABSENT, 1 LEAVE
      mockLessonAttendanceRepo.find.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.LEAVE },
      ]);
      mockEnrollmentRepo.find.mockResolvedValue([]);

      const result = await service.getStudentMetrics('STU-RATES');

      // presentCount = 6 (PRESENT) + 2 (LATE) = 8
      // totalRecords = 10
      // attendanceRate = 8/10 * 100 = 80%
      // absenceRate = 1/10 * 100 = 10%
      // lateRate = 2/10 * 100 = 20%
      expect(result.metrics.find(m => m.name === 'attendanceRate')!.value).toBe(80);
      expect(result.metrics.find(m => m.name === 'absenceRate')!.value).toBe(10);
      expect(result.metrics.find(m => m.name === 'lateRate')!.value).toBe(20);
    });
  });

  // ─── getTeacherMetrics ───

  describe('getTeacherMetrics', () => {
    it('should return 3 teacher metrics', async () => {
      mockLessonRepo.count.mockResolvedValue(42);
      mockTeacherAssignmentRepo.find.mockResolvedValue([
        { classCode: 'CLS-001', teacherId: 100 },
        { classCode: 'CLS-001', teacherId: 100 }, // duplicate class
        { classCode: 'CLS-002', teacherId: 100 },
      ]);

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '15' }),
      };
      mockEnrollmentRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getTeacherMetrics(100);

      expect(result.metrics).toHaveLength(3);
      expect(result.metrics[0]).toEqual({ name: 'teachingCount', value: 42, unit: '次' });
      expect(result.metrics[1]).toEqual({ name: 'classCount', value: 2, unit: '个' }); // 2 distinct classes
      expect(result.metrics[2]).toEqual({ name: 'studentCount', value: 15, unit: '人' });
    });

    it('should handle teacher with no assignments', async () => {
      mockLessonRepo.count.mockResolvedValue(0);
      mockTeacherAssignmentRepo.find.mockResolvedValue([]);

      const result = await service.getTeacherMetrics(999);

      expect(result.metrics).toHaveLength(3);
      expect(result.metrics[0]).toEqual({ name: 'teachingCount', value: 0, unit: '次' });
      expect(result.metrics[1]).toEqual({ name: 'classCount', value: 0, unit: '个' });
      expect(result.metrics[2]).toEqual({ name: 'studentCount', value: 0, unit: '人' });
    });
  });

  // ─── getInstitutionMetrics ───

  describe('getInstitutionMetrics', () => {
    it('should return 4 institution metrics', async () => {
      mockStudentRepo.count.mockResolvedValue(150);
      mockCourseRepo.count.mockResolvedValue(12);
      mockClassRepo.count.mockResolvedValue(25);

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '85' }),
      };
      mockEnrollmentRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getInstitutionMetrics();

      expect(result.metrics).toHaveLength(4);
      expect(result.metrics[0]).toEqual({ name: 'totalStudents', value: 150, unit: '人' });
      expect(result.metrics[1]).toEqual({ name: 'activeStudents', value: 85, unit: '人' });
      expect(result.metrics[2]).toEqual({ name: 'totalCourses', value: 12, unit: '个' });
      expect(result.metrics[3]).toEqual({ name: 'totalClasses', value: 25, unit: '个' });
    });

    it('should handle empty institution data', async () => {
      mockStudentRepo.count.mockResolvedValue(0);
      mockCourseRepo.count.mockResolvedValue(0);
      mockClassRepo.count.mockResolvedValue(0);

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '0' }),
      };
      mockEnrollmentRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getInstitutionMetrics();

      expect(result.metrics).toHaveLength(4);
      expect(result.metrics.every(m => m.value === 0)).toBe(true);
    });
  });
});
