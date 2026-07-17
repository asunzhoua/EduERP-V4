import { Test, TestingModule } from '@nestjs/testing';
import { ContractService, CreateContractInput } from './contract.service';
import { ContractRepository } from './contract.repository';
import { ContractCodeGeneratorService } from './contract-code-generator.service';
import { ContractEntity } from './contract.entity';
import { ContractStatus } from './enums/contract-status.enum';
import { Subject } from '@common/enums/subject.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ContractService', () => {
  let service: ContractService;
  let contractRepo: jest.Mocked<ContractRepository>;
  let codeGenerator: jest.Mocked<ContractCodeGeneratorService>;

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
    };

    const mockCodeGen = {
      generateContractCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        { provide: ContractRepository, useValue: mockRepo },
        { provide: ContractCodeGeneratorService, useValue: mockCodeGen },
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
});
