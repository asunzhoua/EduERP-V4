import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExportService } from './export.service';
import { CsvWriter } from './utils/csv-writer.util';
import { ExcelWriter } from './utils/excel-writer.util';
import { Student } from '../student/entities/student.entity';
import { LessonEntity } from '../teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '../teaching/lesson-attendance/lesson-attendance.entity';
import { ContractEntity } from '../teaching/contract/contract.entity';
import { SalaryRecordEntity } from '../salary/entities/salary-record.entity';
import { EnrollmentEntity } from '../teaching/enrollment/enrollment.entity';
import { User } from '../identity/entities/user.entity';

describe('ExportService', () => {
  let service: ExportService;

  const mockFind = jest.fn();
  const mockFindOne = jest.fn();
  const mockCreateQueryBuilder = jest.fn();

  const mockRepo = {
    find: mockFind,
    findOne: mockFindOne,
    createQueryBuilder: mockCreateQueryBuilder,
  };

  beforeEach(async () => {
    // Reset mocks between tests
    mockFind.mockReset();
    mockFindOne.mockReset();
    mockCreateQueryBuilder.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        CsvWriter,
        ExcelWriter,
        { provide: getRepositoryToken(Student), useValue: { ...mockRepo } },
        { provide: getRepositoryToken(LessonEntity), useValue: { ...mockRepo } },
        { provide: getRepositoryToken(LessonAttendanceEntity), useValue: { ...mockRepo } },
        { provide: getRepositoryToken(ContractEntity), useValue: { ...mockRepo } },
        { provide: getRepositoryToken(SalaryRecordEntity), useValue: { ...mockRepo } },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: { ...mockRepo } },
        { provide: getRepositoryToken(User), useValue: { ...mockRepo } },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('CsvWriter', () => {
    it('should generate CSV with BOM and headers', () => {
      const writer = new CsvWriter();
      const data = [
        { name: '张三', age: 10 },
        { name: '李四', age: 12 },
      ];
      const buffer = writer.generate(data, ['name', 'age']);
      const content = buffer.toString('utf-8');
      expect(content.startsWith('\ufeff')).toBe(true);
      expect(content).toContain('name,age');
      expect(content).toContain('张三');
      expect(content).toContain('李四');
    });

    it('should escape commas and quotes in CSV', () => {
      const writer = new CsvWriter();
      const data = [{ name: '张,三', desc: '他说"你好"' }];
      const buffer = writer.generate(data, ['name', 'desc']);
      const content = buffer.toString('utf-8');
      expect(content).toContain('"张,三"');
      expect(content).toContain('"他说""你好"""');
    });

    it('should handle null values', () => {
      const writer = new CsvWriter();
      const data = [{ name: '张三', age: null }];
      const buffer = writer.generate(data, ['name', 'age']);
      const content = buffer.toString('utf-8');
      const lines = content.split('\n');
      expect(lines[1]).toContain('张三,');
    });
  });

  describe('ExcelWriter', () => {
    it('should generate an Excel buffer with headers', async () => {
      const writer = new ExcelWriter();
      const data = [
        { name: '张三', age: 10 },
        { name: '李四', age: 12 },
      ];
      const buffer = await writer.generate(data, '测试');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle empty data', async () => {
      const writer = new ExcelWriter();
      const buffer = await writer.generate([], '空数据');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('exportStudents', () => {
    it('should return a Buffer for CSV format', async () => {
      mockFind.mockResolvedValue([]);
      mockFindOne.mockResolvedValue(null);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      });

      // enrollmentRepo.find and contractRepo.find need to return empty too
      // Since we're using the same mock for all repos, find is already set to return []

      const result = await service.exportStudents({}, 'csv');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should return a Buffer for Excel format', async () => {
      mockFind.mockResolvedValue([]);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      });

      const result = await service.exportStudents({}, 'excel');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should filter by status', async () => {
      mockFind.mockResolvedValue([]);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      });

      const filters = { status: 'ACTIVE' };
      const result = await service.exportStudents(filters, 'csv');
      expect(result).toBeInstanceOf(Buffer);
      // Student repo should have been called with status filter
      const lastCall = mockFind.mock.calls[mockFind.mock.calls.length - 1];
      if (lastCall) {
        expect(lastCall[0].where.status).toBe('ACTIVE');
      }
    });
  });

  describe('exportLessons', () => {
    it('should return a Buffer for CSV format', async () => {
      mockFind.mockResolvedValue([]);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.exportLessons({}, 'csv');
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('exportConsumption', () => {
    it('should return a Buffer for CSV format', async () => {
      mockFind.mockResolvedValue([]);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.exportConsumption({}, 'csv');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should calculate consumed lessons correctly', async () => {
      const mockContracts = [
        {
          contractCode: 'CT001',
          studentCode: 'STU001',
          subject: 'MATH',
          totalLessons: 50,
          remainingLessons: 30,
          unitPrice: 100,
          status: 'ACTIVE',
          validFrom: '2026-01-01',
          validTo: null,
        },
      ];

      mockFind.mockResolvedValue(mockContracts);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockContracts),
      });

      const buffer = await service.exportConsumption({}, 'csv');
      const content = buffer.toString('utf-8');
      expect(content).toContain('CT001');
      expect(content).toContain('20'); // consumedLessons = 50 - 30
      expect(content).toContain('2000'); // consumedValue = 20 * 100
    });
  });

  describe('exportSalary', () => {
    it('should return a Buffer for CSV format', async () => {
      mockFind.mockResolvedValue([]);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.exportSalary({}, 'csv');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should include teacherName in export', async () => {
      const mockRecords = [
        { id: 1, teacherId: 101, lessonId: 1, lessonDate: '2026-07-01', duration: 2, amount: 100, salaryRuleId: 1, ruleVersion: 'v1', status: 'PAID', notes: null, createdBy: 1, createTime: new Date() },
        { id: 2, teacherId: 102, lessonId: 2, lessonDate: '2026-07-02', duration: 1, amount: 150, salaryRuleId: 2, ruleVersion: 'v1', status: 'PAID', notes: null, createdBy: 2, createTime: new Date() },
      ];

      const mockTeachers = [
        { id: 101, name: '张老师' },
        { id: 102, name: '李老师' },
      ];

      mockFind.mockResolvedValue(mockRecords);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockTeachers),
      });

      const result = await service.exportSalary({}, 'csv');
      expect(result).toBeInstanceOf(Buffer);
      const content = result.toString('utf-8');
      expect(content).toContain('teacherName');
      expect(content).toContain('张老师');
      expect(content).toContain('李老师');
    });

    it('should handle missing teacher gracefully', async () => {
      const mockRecords = [
        { id: 1, teacherId: 999, lessonId: 1, lessonDate: '2026-07-01', duration: 2, amount: 100, salaryRuleId: 1, ruleVersion: 'v1', status: 'PAID', notes: null, createdBy: 1, createTime: new Date() },
      ];

      mockFind.mockResolvedValue(mockRecords);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.exportSalary({}, 'csv');
      expect(result).toBeInstanceOf(Buffer);
      const content = result.toString('utf-8');
      expect(content).toContain('999');
      expect(content).toContain('Unknown');
    });
  });

  describe('exportFinance', () => {
    it('should return a Buffer for CSV format', async () => {
      mockFind.mockResolvedValue([]);
      mockCreateQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.exportFinance({}, 'csv');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should include revenue and salary data', async () => {
      const mockContracts = [
        {
          contractCode: 'CT001',
          studentCode: 'STU001',
          subject: 'MATH',
          totalLessons: 50,
          remainingLessons: 30,
          unitPrice: 100,
          totalAmount: 5000,
          status: 'ACTIVE',
        },
      ];

      const mockSalaryRecords = [
        {
          id: 1,
          teacherId: 1,
          lessonId: 101,
          salaryRuleId: 1,
          ruleVersion: 'v1',
          amount: 500,
          lessonDate: '2026-07-01',
          duration: 2,
          status: 'PAID',
          notes: null,
          createdBy: 1,
          createTime: new Date('2026-07-01'),
        },
      ];

      mockFind
        .mockResolvedValueOnce(mockContracts)  // contractRepo.find
        .mockResolvedValueOnce(mockSalaryRecords); // salaryRepo.find

      const buffer = await service.exportFinance({}, 'csv');
      const content = buffer.toString('utf-8');
      expect(content).toContain('CT001');
      expect(content).toContain('合同收入');
      expect(content).toContain('工资支出');
    });
  });
});
