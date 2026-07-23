import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Student } from '@modules/student/entities/student.entity';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  const mockAnalyticsService = {
    getStudentMetrics: jest.fn(),
    getTeacherMetrics: jest.fn(),
    getInstitutionMetrics: jest.fn(),
    getStudentTrend: jest.fn(),
    getTeacherTrend: jest.fn(),
    getInstitutionTrend: jest.fn(),
  };

  const mockStudentRepository = {
    findOne: jest.fn(),
  };

  // Helper: create a mock req with a given role
  const mockReq = (sub: number, role: string) => ({ user: { sub, role } });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepository },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /analytics/student/:studentCode ───

  describe('getStudentMetrics', () => {
    it('should return ApiResponse.success with student metrics', async () => {
      const mockMetrics = {
        metrics: [
          { name: 'dau', value: 5, unit: '人' },
          { name: 'wau', value: 20, unit: '人' },
          { name: 'mau', value: 80, unit: '人' },
          { name: 'totalAttendance', value: 42, unit: '次' },
          { name: 'attendanceRate', value: 85.5, unit: '%' },
          { name: 'absenceRate', value: 10.2, unit: '%' },
          { name: 'lateRate', value: 4.3, unit: '%' },
          { name: 'courseProgress', value: 60, unit: '%' },
        ],
      };
      mockAnalyticsService.getStudentMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getStudentMetrics('STU-001', mockReq(1, 'Teacher'));

      expect(result.code).toBe(0);
      expect(result.message).toBe('success');
      expect(result.data).toEqual(mockMetrics);
      expect(mockAnalyticsService.getStudentMetrics).toHaveBeenCalledWith('STU-001');
    });
  });

  // ─── GET /analytics/teacher/:teacherId ───

  describe('getTeacherMetrics', () => {
    it('should return ApiResponse.success with teacher metrics', async () => {
      const mockMetrics = {
        metrics: [
          { name: 'teachingCount', value: 42, unit: '次' },
          { name: 'classCount', value: 3, unit: '个' },
          { name: 'studentCount', value: 15, unit: '人' },
        ],
      };
      mockAnalyticsService.getTeacherMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getTeacherMetrics(100, mockReq(100, 'Teacher'));

      expect(result.code).toBe(0);
      expect(result.message).toBe('success');
      expect(result.data).toEqual(mockMetrics);
      expect(mockAnalyticsService.getTeacherMetrics).toHaveBeenCalledWith(100);
    });
  });

  // ─── GET /analytics/institution ───

  describe('getInstitutionMetrics', () => {
    it('should return ApiResponse.success with institution metrics', async () => {
      const mockMetrics = {
        metrics: [
          { name: 'totalStudents', value: 150, unit: '人' },
          { name: 'activeStudents', value: 85, unit: '人' },
          { name: 'totalCourses', value: 12, unit: '个' },
          { name: 'totalClasses', value: 25, unit: '个' },
        ],
      };
      mockAnalyticsService.getInstitutionMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getInstitutionMetrics();

      expect(result.code).toBe(0);
      expect(result.message).toBe('success');
      expect(result.data).toEqual(mockMetrics);
      expect(mockAnalyticsService.getInstitutionMetrics).toHaveBeenCalled();
    });
  });

  // ─── GET /analytics/student/:studentCode/trend ───

  describe('getStudentTrend', () => {
    it('should return ApiResponse.success with student trend data', async () => {
      const mockTrend = {
        learningTrend: [
          { date: '2026-07-17', value: 3 },
          { date: '2026-07-18', value: 2 },
        ],
        attendanceTrend: [
          { date: '2026-07-17', value: 85.5 },
          { date: '2026-07-18', value: 90.0 },
        ],
      };
      mockAnalyticsService.getStudentTrend.mockResolvedValue(mockTrend);

      const result = await controller.getStudentTrend('STU-001', '7', mockReq(1, 'Teacher'));

      expect(result.code).toBe(0);
      expect(result.message).toBe('success');
      expect(result.data).toEqual(mockTrend);
      expect(mockAnalyticsService.getStudentTrend).toHaveBeenCalledWith('STU-001', 7);
    });

    it('should default to 7 days when days param is missing', async () => {
      mockAnalyticsService.getStudentTrend.mockResolvedValue({
        learningTrend: [],
        attendanceTrend: [],
      });

      await controller.getStudentTrend('STU-001', undefined, mockReq(1, 'Teacher'));

      expect(mockAnalyticsService.getStudentTrend).toHaveBeenCalledWith('STU-001', 7);
    });
  });

  // ─── GET /analytics/teacher/:teacherId/trend ───

  describe('getTeacherTrend', () => {
    it('should return ApiResponse.success with teacher trend data', async () => {
      const mockTrend = {
        lessonTrend: [
          { date: '2026-07-17', value: 5 },
          { date: '2026-07-18', value: 3 },
        ],
        attendanceTrend: [
          { date: '2026-07-17', value: 92.0 },
          { date: '2026-07-18', value: 88.5 },
        ],
      };
      mockAnalyticsService.getTeacherTrend.mockResolvedValue(mockTrend);

      const result = await controller.getTeacherTrend(100, '7', mockReq(100, 'Teacher'));

      expect(result.code).toBe(0);
      expect(result.message).toBe('success');
      expect(result.data).toEqual(mockTrend);
      expect(mockAnalyticsService.getTeacherTrend).toHaveBeenCalledWith(100, 7);
    });
  });

  // ─── GET /analytics/institution/trend ───

  describe('getInstitutionTrend', () => {
    it('should return ApiResponse.success with institution trend data', async () => {
      const mockTrend = {
        lessonTrend: [
          { date: '2026-07-17', value: 10 },
          { date: '2026-07-18', value: 8 },
        ],
        enrollmentTrend: [
          { date: '2026-07-17', value: 2 },
          { date: '2026-07-18', value: 1 },
        ],
      };
      mockAnalyticsService.getInstitutionTrend.mockResolvedValue(mockTrend);

      const result = await controller.getInstitutionTrend('7');

      expect(result.code).toBe(0);
      expect(result.message).toBe('success');
      expect(result.data).toEqual(mockTrend);
      expect(mockAnalyticsService.getInstitutionTrend).toHaveBeenCalledWith(7);
    });
  });

  // ─── Data Permission: Student Ownership Check ───

  describe('verifyStudentAccess', () => {
    it('should allow Student to access their own data', async () => {
      mockStudentRepository.findOne.mockResolvedValue({ userId: 42 });
      mockAnalyticsService.getStudentMetrics.mockResolvedValue({ metrics: [] });

      const result = await controller.getStudentMetrics('STU-001', mockReq(42, 'Student'));
      expect(result.code).toBe(0);
    });

    it('should reject Student accessing another student data', async () => {
      mockStudentRepository.findOne.mockResolvedValue({ userId: 99 });

      await expect(
        controller.getStudentMetrics('STU-001', mockReq(42, 'Student')),
      ).rejects.toThrow('无权访问该学生数据');
    });

    it('should reject Student when studentCode not found', async () => {
      mockStudentRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.getStudentMetrics('FAKE', mockReq(42, 'Student')),
      ).rejects.toThrow('学生不存在');
    });

    it('should allow Parent to access their child data', async () => {
      mockStudentRepository.findOne.mockResolvedValue({ userId: 42 });
      mockAnalyticsService.getStudentMetrics.mockResolvedValue({ metrics: [] });

      const result = await controller.getStudentMetrics('STU-001', mockReq(42, 'Parent'));
      expect(result.code).toBe(0);
    });

    it('should allow Teacher to access any student data without ownership check', async () => {
      mockAnalyticsService.getStudentMetrics.mockResolvedValue({ metrics: [] });

      const result = await controller.getStudentMetrics('STU-001', mockReq(1, 'Teacher'));
      expect(result.code).toBe(0);
      // Should NOT call findOne for Teacher role
      expect(mockStudentRepository.findOne).not.toHaveBeenCalled();
    });
  });
});
