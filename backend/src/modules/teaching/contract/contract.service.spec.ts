import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContractService, CreateContractInput } from './contract.service';
import { ContractRepository } from './contract.repository';
import { ContractCodeGeneratorService } from './contract-code-generator.service';
import { ContractEntity } from './contract.entity';
import { ContractStatus } from './enums/contract-status.enum';
import { Subject } from '@common/enums/subject.enum';
import { LessonAttendanceEntity } from '../lesson-attendance/lesson-attendance.entity';
import { LessonEntity } from '../lesson/lesson.entity';
import { CourseEntity } from '../course/course.entity';
import { Student } from '@modules/student/entities/student.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ContractService', () => {
  let service: ContractService;
  let contractRepo: jest.Mocked<ContractRepository>;
  let codeGenerator: jest.Mocked<ContractCodeGeneratorService>;
  let attendanceRepo: jest.Mocked<any>;
  let lessonRepo: jest.Mocked<any>;
  let courseRepo: jest.Mocked<any>;
  let studentRepo: jest.Mocked<any>;
  let config: jest.Mocked<ConfigService>;

  const mockContractInput: CreateContractInput = {
    studentCode: 'ST2026010001',
    subject: Subject.MATH,
    totalLessons: 20,
    validFrom: '2026-07-01',
    validTo: '2026-12-31',
    unitPrice: 80,
    totalAmount: 1600,
  };

  const mockContract: ContractEntity = {
    id: 1,
    contractCode: 'CT2026070001',
    studentCode: 'ST2026010001',
    subject: Subject.MATH,
    totalLessons: 20,
    remainingLessons: 20,
    status: ContractStatus.ACTIVE,
    validFrom: '2026-07-01',
    validTo: '2026-12-31',
    unitPrice: 80,
    totalAmount: 1600,
    note: null,
    tags: null,
    createdBy: 0,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = {
      save: jest.fn(),
      findOneById: jest.fn(),
      findOneByCode: jest.fn(),
      findByStudentCode: jest.fn(),
      countByStudentCode: jest.fn(),
      findMany: jest.fn(),
      findActiveAtRisk: jest.fn(),
    };

    const mockCodeGen = {
      generateContractCode: jest.fn(),
    };

    attendanceRepo = {
      find: jest.fn(),
      count: jest.fn(),
    };
    lessonRepo = {
      find: jest.fn(),
    };
    courseRepo = {
      find: jest.fn(),
    };
    studentRepo = {
      find: jest.fn(),
    };
    config = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        { provide: ContractRepository, useValue: mockRepo },
        { provide: ContractCodeGeneratorService, useValue: mockCodeGen },
        {
          provide: getRepositoryToken(LessonAttendanceEntity),
          useValue: attendanceRepo,
        },
        { provide: getRepositoryToken(LessonEntity), useValue: lessonRepo },
        { provide: getRepositoryToken(CourseEntity), useValue: courseRepo },
        { provide: getRepositoryToken(Student), useValue: studentRepo },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
    contractRepo = module.get(ContractRepository);
    codeGenerator = module.get(ContractCodeGeneratorService);
  });

  // ─── Create ───

  describe('create', () => {
    it('should create a contract with ACTIVE status and remainingLessons = totalLessons', async () => {
      codeGenerator.generateContractCode.mockResolvedValue('CT2026070001');
      contractRepo.save.mockResolvedValue({ ...mockContract });

      const result = await service.create(mockContractInput);

      expect(result.status).toBe(ContractStatus.ACTIVE);
      expect(result.remainingLessons).toBe(20);
      expect(result.contractCode).toBe('CT2026070001');
      expect(result.studentCode).toBe('ST2026010001');
    });

    it('should reject totalLessons <= 0', async () => {
      await expect(
        service.create({ ...mockContractInput, totalLessons: 0 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({ ...mockContractInput, totalLessons: -5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Read ───

  describe('findOne', () => {
    it('should return a contract when found', async () => {
      contractRepo.findOneById.mockResolvedValue({ ...mockContract });
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException when not found', async () => {
      contractRepo.findOneById.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByCode', () => {
    it('should return a contract by code', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockContract });
      const result = await service.findOneByCode('CT2026070001');
      expect(result.contractCode).toBe('CT2026070001');
    });

    it('should throw NotFoundException when code not found', async () => {
      contractRepo.findOneByCode.mockResolvedValue(null);
      await expect(service.findOneByCode('CT0000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByStudentCode', () => {
    it('should return contracts for a student', async () => {
      contractRepo.findByStudentCode.mockResolvedValue([
        { ...mockContract },
        { ...mockContract, id: 2, contractCode: 'CT2026070002' },
      ]);
      const result = await service.findByStudentCode('ST2026010001');
      expect(result).toHaveLength(2);
    });
  });

  describe('findAll', () => {
    it('should return paginated contracts', async () => {
      contractRepo.findMany.mockResolvedValue({
        items: [{ ...mockContract }],
        total: 1,
      });
      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(contractRepo.findMany).toHaveBeenCalledWith({
        studentCode: undefined,
        subject: undefined,
        status: undefined,
        page: 1,
        pageSize: 20,
      });
    });

    it('should default page=1 pageSize=20 when not provided', async () => {
      contractRepo.findMany.mockResolvedValue({ items: [], total: 0 });
      await service.findAll({});
      expect(contractRepo.findMany).toHaveBeenCalledWith({
        studentCode: undefined,
        subject: undefined,
        status: undefined,
        page: 1,
        pageSize: 20,
      });
    });
  });

  // ─── Lesson Adjustment ───

  describe('adjustLessons', () => {
    const baseContract: ContractEntity = {
      ...mockContract,
      totalLessons: 20,
      remainingLessons: 20,
      status: ContractStatus.ACTIVE,
    };

    beforeEach(() => {
      contractRepo.save.mockImplementation((c: ContractEntity) =>
        Promise.resolve(c),
      );
    });

    it('should add lessons (total & remaining increase)', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...baseContract });

      const result = await service.adjustLessons(
        'CT2026070001',
        { totalLessons: 25, remainingLessons: 25, reason: '家长续费' },
        1,
      );

      expect(result.totalLessons).toBe(25);
      expect(result.remainingLessons).toBe(25);
      expect(result.status).toBe(ContractStatus.ACTIVE);
    });

    it('should reduce lessons when reason provided', async () => {
      const partial = { ...baseContract, remainingLessons: 15 };
      contractRepo.findOneByCode.mockResolvedValue(partial);

      const result = await service.adjustLessons(
        'CT2026070001',
        { totalLessons: 20, remainingLessons: 10, reason: '退款 5 节' },
        1,
      );

      expect(result.totalLessons).toBe(20);
      expect(result.remainingLessons).toBe(10);
    });

    it('should reject reducing without reason', async () => {
      const partial = { ...baseContract, remainingLessons: 15 };
      contractRepo.findOneByCode.mockResolvedValue(partial);

      await expect(
        service.adjustLessons(
          'CT2026070001',
          { remainingLessons: 10 },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative remaining', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...baseContract });

      await expect(
        service.adjustLessons(
          'CT2026070001',
          { remainingLessons: -1 },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject remaining exceeding total', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...baseContract });

      await expect(
        service.adjustLessons(
          'CT2026070001',
          { totalLessons: 20, remainingLessons: 25 },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject no lesson change', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...baseContract });

      await expect(
        service.adjustLessons(
          'CT2026070001',
          { totalLessons: 20, remainingLessons: 20 },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject REFUNDED contract', async () => {
      contractRepo.findOneByCode.mockResolvedValue({
        ...baseContract,
        status: ContractStatus.REFUNDED,
      });

      await expect(
        service.adjustLessons(
          'CT2026070001',
          { remainingLessons: 25 },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should revive EXHAUSTED -> ACTIVE when topped up', async () => {
      contractRepo.findOneByCode.mockResolvedValue({
        ...baseContract,
        totalLessons: 20,
        remainingLessons: 0,
        status: ContractStatus.EXHAUSTED,
      });

      const result = await service.adjustLessons(
        'CT2026070001',
        { totalLessons: 25, remainingLessons: 5, reason: '续费' },
        1,
      );

      expect(result.status).toBe(ContractStatus.ACTIVE);
      expect(result.remainingLessons).toBe(5);
    });

    it('should set status EXHAUSTED when remaining hits 0', async () => {
      const partial = { ...baseContract, remainingLessons: 5 };
      contractRepo.findOneByCode.mockResolvedValue(partial);

      const result = await service.adjustLessons(
        'CT2026070001',
        { remainingLessons: 0, reason: '退完剩余课时' },
        1,
      );

      expect(result.status).toBe(ContractStatus.EXHAUSTED);
      expect(result.remainingLessons).toBe(0);
    });

    it('should allow changing only total', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...baseContract });

      const result = await service.adjustLessons(
        'CT2026070001',
        { totalLessons: 30 },
        1,
      );

      expect(result.totalLessons).toBe(30);
      expect(result.remainingLessons).toBe(20);
    });

    it('should allow changing only remaining', async () => {
      contractRepo.findOneByCode.mockResolvedValue({
        ...baseContract,
        totalLessons: 30,
        remainingLessons: 20,
      });

      const result = await service.adjustLessons(
        'CT2026070001',
        { remainingLessons: 22 },
        1,
      );

      expect(result.totalLessons).toBe(30);
      expect(result.remainingLessons).toBe(22);
    });
  });

  // ─── Status Transitions ───

  describe('freeze', () => {
    it('should allow ACTIVE -> FROZEN with reason', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockContract });
      contractRepo.save.mockResolvedValue({
        ...mockContract,
        status: ContractStatus.FROZEN,
      });

      const result = await service.freeze('CT2026070001', 1, '家长要求暂停');
      expect(result.status).toBe(ContractStatus.FROZEN);
    });

    it('should block FROZEN without reason', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockContract });

      try {
        await service.freeze('CT2026070001', 1);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
      }
    });

    it('should block FROZEN with empty reason', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockContract });

      try {
        await service.freeze('CT2026070001', 1, '  ');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
      }
    });
  });

  describe('unfreeze', () => {
    it('should allow FROZEN -> ACTIVE', async () => {
      const frozen = { ...mockContract, status: ContractStatus.FROZEN };
      contractRepo.findOneByCode.mockResolvedValue(frozen);
      contractRepo.save.mockResolvedValue({
        ...frozen,
        status: ContractStatus.ACTIVE,
      });

      const result = await service.unfreeze('CT2026070001', 1);
      expect(result.status).toBe(ContractStatus.ACTIVE);
    });
  });

  // ─── Illegal Transitions ───

  describe('illegal transitions', () => {
    it('should allow ACTIVE -> FROZEN (valid admin action)', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockContract });
      contractRepo.save.mockResolvedValue({
        ...mockContract,
        status: ContractStatus.FROZEN,
      });

      const result = await service.freeze('CT2026070001', 1, 'reason');
      expect(result.status).toBe(ContractStatus.FROZEN);
    });

    it('should block EXHAUSTED -> ACTIVE (must go through REFUNDED)', async () => {
      const exhausted = {
        ...mockContract,
        status: ContractStatus.EXHAUSTED,
      };
      contractRepo.findOneByCode.mockResolvedValue(exhausted);

      try {
        await service.unfreeze('CT2026070001', 1);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
      }
    });

    it('should block FROZEN -> FROZEN (same-status)', async () => {
      const frozen = { ...mockContract, status: ContractStatus.FROZEN };
      contractRepo.findOneByCode.mockResolvedValue(frozen);

      try {
        await service.freeze('CT2026070001', 1, 'reason');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
      }
    });
  });

  // ─── Consume Records (E: 课时消耗流水) ───

  describe('getConsumeRecords', () => {
    const attendance: any = {
      id: 1,
      lessonId: 11,
      studentCode: 'ST2026010001',
      classCode: 'CL1',
      teacherId: 1,
      workflowState: 'CHECKED_IN',
      status: 'PRESENT',
      deductedContractId: 1,
      checkInTime: new Date('2026-08-01T10:00:00.000Z'),
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      operator: 1,
      source: 'API',
      createdBy: 1,
    };

    beforeEach(() => {
      lessonRepo.find.mockResolvedValue([]);
      courseRepo.find.mockResolvedValue([]);
    });

    it('should return paginated consume records with lesson/course enrichment', async () => {
      attendanceRepo.count.mockResolvedValue(2);
      attendanceRepo.find.mockResolvedValue([{ ...attendance }]);
      lessonRepo.find.mockResolvedValue([
        {
          id: 11,
          courseCode: 'C1',
          scheduledDate: '2026-08-01',
          startTime: '09:00',
          endTime: '10:30',
          isMakeup: false,
          topic: '二次函数',
        },
      ]);
      courseRepo.find.mockResolvedValue([
        { courseCode: 'C1', name: '初中数学', subject: 'MATH' },
      ]);

      const result = await service.getConsumeRecords(mockContract, 1, 20);

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.lessonDate).toBe('2026-08-01');
      expect(item.startTime).toBe('09:00');
      expect(item.endTime).toBe('10:30');
      expect(item.courseName).toBe('初中数学');
      expect(item.subject).toBe('MATH');
      expect(item.lessonType).toBe('NORMAL');
      expect(item.lessonTypeLabel).toBe('正常');
      expect(item.lessonsConsumed).toBe(1);
      expect(item.topic).toBe('二次函数');
      expect(item.status).toBe('PRESENT');
      expect(item.deductedAt).toBe('2026-08-01T10:00:00.000Z');
    });

    it('should mark makeup lessons', async () => {
      attendanceRepo.count.mockResolvedValue(1);
      attendanceRepo.find.mockResolvedValue([{ ...attendance }]);
      lessonRepo.find.mockResolvedValue([
        {
          id: 11,
          courseCode: 'C1',
          scheduledDate: '2026-08-01',
          startTime: '09:00',
          endTime: '10:30',
          isMakeup: true,
          topic: null,
        },
      ]);
      courseRepo.find.mockResolvedValue([
        { courseCode: 'C1', name: '初中数学', subject: 'MATH' },
      ]);

      const result = await service.getConsumeRecords(mockContract, 1, 20);

      expect(result.items[0].lessonType).toBe('MAKEUP');
      expect(result.items[0].lessonTypeLabel).toBe('补课');
    });

    it('should return empty list when contract has no deductions', async () => {
      attendanceRepo.count.mockResolvedValue(0);
      attendanceRepo.find.mockResolvedValue([]);

      const result = await service.getConsumeRecords(mockContract, 1, 20);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should pass pagination to attendance query', async () => {
      attendanceRepo.count.mockResolvedValue(0);
      attendanceRepo.find.mockResolvedValue([]);

      await service.getConsumeRecords(mockContract, 2, 10);

      expect(attendanceRepo.find).toHaveBeenCalledWith({
        where: { deductedContractId: 1 },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });
  });

  // ─── Renewal Warnings (A: 续费预警) ───

  describe('getRenewalWarnings', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const atRiskContract = {
      ...mockContract,
      id: 1,
      contractCode: 'CT2026070001',
      studentCode: 'ST2026010001',
      totalLessons: 20,
      remainingLessons: 3,
      status: ContractStatus.ACTIVE,
    };

    beforeEach(() => {
      contractRepo.findActiveAtRisk.mockResolvedValue([{ ...atRiskContract }]);
      studentRepo.find.mockResolvedValue([
        { studentCode: 'ST2026010001', name: '张三', deleted: false },
      ]);
      lessonRepo.find.mockResolvedValue([
        {
          id: 12,
          courseCode: 'C1',
          scheduledDate: '2026-08-01',
          startTime: '09:00',
          endTime: '10:30',
        },
      ]);
      courseRepo.find.mockResolvedValue([
        { courseCode: 'C1', name: '初中数学', subject: 'MATH' },
      ]);
    });

    it('should use config default threshold when none passed', async () => {
      config.get.mockReturnValue(5);
      attendanceRepo.find.mockResolvedValue([]);

      await service.getRenewalWarnings();

      expect(config.get).toHaveBeenCalledWith('app.renewal.warningThreshold', 5);
      expect(contractRepo.findActiveAtRisk).toHaveBeenCalledWith(5);
    });

    it('should estimate days left from 30-day consumption rate', async () => {
      attendanceRepo.find.mockResolvedValue([
        {
          deductedContractId: 1,
          lessonId: 12,
          checkInTime: new Date(now - 1 * day),
          createdAt: new Date(now - 1 * day),
        },
        {
          deductedContractId: 1,
          lessonId: 11,
          checkInTime: new Date(now - 5 * day),
          createdAt: new Date(now - 5 * day),
        },
        {
          deductedContractId: 1,
          lessonId: 10,
          checkInTime: new Date(now - 10 * day),
          createdAt: new Date(now - 10 * day),
        },
        {
          deductedContractId: 1,
          lessonId: 9,
          checkInTime: new Date(now - 40 * day),
          createdAt: new Date(now - 40 * day),
        },
      ]);

      const result = await service.getRenewalWarnings(5);

      expect(result).toHaveLength(1);
      const w = result[0];
      expect(w.studentName).toBe('张三');
      expect(w.courseName).toBe('初中数学');
      expect(w.remainingLessons).toBe(3);
      expect(w.lastDeductedAt).toBe(new Date(now - 1 * day).toISOString());
      // 30-day rate = 3/30 = 0.1 per day → days = ceil(3 / 0.1) = 30
      expect(w.estimatedDaysLeft).toBe(30);
      // remaining 3 > floor(5/2) = 2 → WARN
      expect(w.warningLevel).toBe('WARN');
    });

    it('should return null days left when no recent consumption', async () => {
      attendanceRepo.find.mockResolvedValue([]);

      const result = await service.getRenewalWarnings(5);

      expect(result).toHaveLength(1);
      expect(result[0].estimatedDaysLeft).toBeNull();
      expect(result[0].lastDeductedAt).toBeNull();
      expect(result[0].courseName).toBeNull();
    });

    it('should mark CRITICAL when remaining <= threshold/2', async () => {
      contractRepo.findActiveAtRisk.mockResolvedValue([
        { ...atRiskContract, remainingLessons: 2 },
      ]);
      attendanceRepo.find.mockResolvedValue([]);

      const result = await service.getRenewalWarnings(5);

      expect(result[0].remainingLessons).toBe(2);
      expect(result[0].warningLevel).toBe('CRITICAL');
    });

    it('should handle bigint ids returned as strings (MySQL bigint PK / FK)', async () => {
      // TypeORM 对 MySQL bigint 列返回 string；按 Number 归键后仍须命中 map。
      contractRepo.findActiveAtRisk.mockResolvedValue([
        { ...atRiskContract, id: '1' },
      ]);
      attendanceRepo.find.mockResolvedValue([
        {
          deductedContractId: '1',
          lessonId: 12,
          checkInTime: new Date(now - 1 * day),
          createdAt: new Date(now - 1 * day),
        },
        {
          deductedContractId: '1',
          lessonId: 11,
          checkInTime: new Date(now - 5 * day),
          createdAt: new Date(now - 5 * day),
        },
        {
          deductedContractId: '1',
          lessonId: 10,
          checkInTime: new Date(now - 10 * day),
          createdAt: new Date(now - 10 * day),
        },
      ]);

      const result = await service.getRenewalWarnings(5);

      expect(result).toHaveLength(1);
      const w = result[0];
      expect(w.courseName).toBe('初中数学');
      expect(w.lastDeductedAt).toBe(new Date(now - 1 * day).toISOString());
      expect(w.estimatedDaysLeft).toBe(30);
    });

    it('should return empty when threshold is 0 (no ACTIVE contract below 0)', async () => {
      contractRepo.findActiveAtRisk.mockResolvedValue([]);

      const result = await service.getRenewalWarnings(0);

      expect(result).toEqual([]);
      expect(attendanceRepo.find).not.toHaveBeenCalled();
    });

    it('should not query attendance/students when no at-risk contract', async () => {
      contractRepo.findActiveAtRisk.mockResolvedValue([]);

      const result = await service.getRenewalWarnings(5);

      expect(result).toEqual([]);
      expect(attendanceRepo.find).not.toHaveBeenCalled();
      expect(studentRepo.find).not.toHaveBeenCalled();
    });
  });
});
