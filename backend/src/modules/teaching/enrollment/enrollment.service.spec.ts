import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentService, EnrollInput, VALID_ENROLLMENT_TRANSITIONS } from './enrollment.service';
import { EnrollmentRepository } from './enrollment.repository';
import { ContractRepository } from '../contract/contract.repository';
import { EnrollmentEntity } from './enrollment.entity';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { ContractEntity } from '../contract/contract.entity';
import { ContractStatus } from '../contract/enums/contract-status.enum';
import { StudentRepository } from '../../student/student.repository';
import { Subject } from '@common/enums/subject.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let enrollmentRepo: jest.Mocked<EnrollmentRepository>;
  let contractRepo: jest.Mocked<ContractRepository>;
  let studentRepo: jest.Mocked<StudentRepository>;

  const mockEnrollInput: EnrollInput = {
    classCode: 'CL2026070001',
    studentCode: 'ST2026010001',
    contractCode: 'CT2026070001',
  };

  const mockEnrollment: EnrollmentEntity = {
    id: 1,
    classCode: 'CL2026070001',
    studentCode: 'ST2026010001',
    contractCode: 'CT2026070001',
    status: EnrollmentStatus.ACTIVE,
    withdrawReason: null,
    enrolledBy: 0,
    enrolledAt: new Date(),
  };

  const mockActiveContract: ContractEntity = {
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
    const mockEnrollmentRepo = {
      save: jest.fn(),
      findOneById: jest.fn(),
      findByClassCode: jest.fn(),
      findByStudentCode: jest.fn(),
      findByClassAndStudent: jest.fn(),
      countActiveByClassCode: jest.fn(),
    };

    const mockContractRepo = {
      save: jest.fn(),
      findOneById: jest.fn(),
      findOneByCode: jest.fn(),
      findByStudentCode: jest.fn(),
      countByStudentCode: jest.fn(),
    };

    const mockStudentRepo = {
      raw: {
        find: jest.fn(),
      },
      save: jest.fn(),
      findById: jest.fn(),
      findByStudentCode: jest.fn(),
      findAndCount: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentService,
        { provide: EnrollmentRepository, useValue: mockEnrollmentRepo },
        { provide: ContractRepository, useValue: mockContractRepo },
        { provide: StudentRepository, useValue: mockStudentRepo },
      ],
    }).compile();

    service = module.get<EnrollmentService>(EnrollmentService);
    enrollmentRepo = module.get(EnrollmentRepository);
    contractRepo = module.get(ContractRepository);
    studentRepo = module.get(StudentRepository);
  });

  // ─── Enroll ───

  describe('enroll', () => {
    it('should create enrollment with ACTIVE status', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(null);
      enrollmentRepo.save.mockResolvedValue({ ...mockEnrollment });

      const result = await service.enroll(mockEnrollInput);

      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
      expect(result.classCode).toBe('CL2026070001');
      expect(result.studentCode).toBe('ST2026010001');
      expect(result.contractCode).toBe('CT2026070001');
    });

    it('should reject when contract not found', async () => {
      contractRepo.findOneByCode.mockResolvedValue(null);

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when contract is not ACTIVE', async () => {
      const frozenContract = {
        ...mockActiveContract,
        status: ContractStatus.FROZEN,
      };
      contractRepo.findOneByCode.mockResolvedValue(frozenContract);

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject duplicate ACTIVE enrollment', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      enrollmentRepo.findByClassAndStudent.mockResolvedValue({
        ...mockEnrollment,
      });

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow re-enrollment after withdrawal', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      const withdrawn = {
        ...mockEnrollment,
        status: EnrollmentStatus.WITHDRAWN,
      };
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(withdrawn);
      enrollmentRepo.save.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.ACTIVE,
      });

      const result = await service.enroll(mockEnrollInput);
      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
    });
  });

  // ─── Read ───

  describe('findOne', () => {
    it('should return enrollment when found', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException when not found', async () => {
      enrollmentRepo.findOneById.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByClassCode', () => {
    it('should return enrollments for a class', async () => {
      enrollmentRepo.findByClassCode.mockResolvedValue([
        { ...mockEnrollment },
        { ...mockEnrollment, id: 2, studentCode: 'ST2026010002' },
      ]);
      const result = await service.findByClassCode('CL2026070001');
      expect(result).toHaveLength(2);
    });
  });

  describe('findByStudentCode', () => {
    it('should return enrollments for a student', async () => {
      enrollmentRepo.findByStudentCode.mockResolvedValue([
        { ...mockEnrollment },
      ]);
      const result = await service.findByStudentCode('ST2026010001');
      expect(result).toHaveLength(1);
    });
  });

  // ─── Withdraw ───

  describe('withdraw', () => {
    it('should allow ACTIVE -> WITHDRAWN with reason', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });
      enrollmentRepo.save.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.WITHDRAWN,
        withdrawReason: '转到其他机构',
      });

      const result = await service.withdraw(1, '转到其他机构', 1);
      expect(result.status).toBe(EnrollmentStatus.WITHDRAWN);
      expect(result.withdrawReason).toBe('转到其他机构');
    });

    it('should block withdrawal of non-ACTIVE enrollment', async () => {
      const withdrawn = {
        ...mockEnrollment,
        status: EnrollmentStatus.WITHDRAWN,
      };
      enrollmentRepo.findOneById.mockResolvedValue(withdrawn);

      await expect(service.withdraw(1, 'reason', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block withdrawal without reason', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });

      await expect(service.withdraw(1, '', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block withdrawal with empty reason', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });

      await expect(service.withdraw(1, '  ', 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── State Transition Table ───

  describe('VALID_ENROLLMENT_TRANSITIONS', () => {
    it('should have transitions for all 3 statuses', () => {
      expect(Object.keys(VALID_ENROLLMENT_TRANSITIONS)).toHaveLength(3);
    });

    it('ACTIVE should transition to WITHDRAWN only', () => {
      expect(VALID_ENROLLMENT_TRANSITIONS[EnrollmentStatus.ACTIVE]).toEqual([
        EnrollmentStatus.WITHDRAWN,
      ]);
    });

    it('WITHDRAWN should be terminal', () => {
      expect(VALID_ENROLLMENT_TRANSITIONS[EnrollmentStatus.WITHDRAWN]).toEqual([]);
    });

    it('COMPLETED should be terminal (not activated)', () => {
      expect(VALID_ENROLLMENT_TRANSITIONS[EnrollmentStatus.COMPLETED]).toEqual([]);
    });
  });

  // ─── Contract Ownership Validation ───

  describe('Contract ownership validation', () => {
    it('should reject when contract belongs to different student', async () => {
      const otherStudentContract = {
        ...mockActiveContract,
        studentCode: 'ST9999999999',
      };
      contractRepo.findOneByCode.mockResolvedValue(otherStudentContract);

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        'does not belong to student',
      );
    });
  });
});
