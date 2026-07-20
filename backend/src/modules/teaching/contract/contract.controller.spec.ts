import { Test, TestingModule } from '@nestjs/testing';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { NotFoundException } from '@nestjs/common';

describe('ContractController', () => {
  let controller: ContractController;
  let service: ContractService;

  const mockContract = {
    id: 1,
    contractCode: 'CTR2026070001',
    studentCode: 'STU20260001',
    subject: 'MATH',
    totalLessons: 30,
    remainingLessons: 30,
    status: 'ACTIVE',
    validFrom: '2026-07-01',
    validTo: null,
    unitPrice: 200.0,
    totalAmount: 6000.0,
    note: null,
    tags: null,
    createdBy: 0,
    createdAt: new Date(),
  };

  const mockService = {
    create: jest.fn().mockResolvedValue(mockContract),
    findOneByCode: jest.fn().mockResolvedValue(mockContract),
    findByStudentCode: jest.fn().mockResolvedValue([mockContract]),
    freeze: jest.fn().mockResolvedValue({
      ...mockContract,
      status: 'FROZEN',
    }),
    unfreeze: jest.fn().mockResolvedValue({
      ...mockContract,
      status: 'ACTIVE',
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractController],
      providers: [
        {
          provide: ContractService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get(ContractController);
    service = module.get(ContractService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock resolved values after clearAllMocks
    mockService.create.mockResolvedValue(mockContract);
    mockService.findOneByCode.mockResolvedValue(mockContract);
    mockService.findByStudentCode.mockResolvedValue([mockContract]);
    mockService.freeze.mockResolvedValue({
      ...mockContract,
      status: 'FROZEN',
    });
    mockService.unfreeze.mockResolvedValue({
      ...mockContract,
      status: 'ACTIVE',
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── create - POST /contracts ───

  describe('create', () => {
    it('should create a contract', async () => {
      const dto = {
        studentCode: 'STU20260001',
        subject: 'MATH',
        totalLessons: 30,
        validFrom: '2026-07-01',
        validTo: null,
        unitPrice: 200.0,
        totalAmount: 6000.0,
        note: null,
        tags: null,
      };

      const result = await controller.create(dto);

      expect(result).toEqual(mockContract);
      expect(mockService.create).toHaveBeenCalledWith({
        studentCode: 'STU20260001',
        subject: 'MATH',
        totalLessons: 30,
        validFrom: '2026-07-01',
        validTo: null,
        unitPrice: 200.0,
        totalAmount: 6000.0,
        note: null,
        tags: null,
      });
    });

    it('should map nullish dto fields to null', async () => {
      const dto = {
        studentCode: 'STU20260002',
        subject: 'ENGLISH',
        totalLessons: 20,
        validFrom: '2026-08-01',
        validTo: undefined,
        unitPrice: undefined,
        totalAmount: undefined,
        note: undefined,
        tags: undefined,
      };

      await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith({
        studentCode: 'STU20260002',
        subject: 'ENGLISH',
        totalLessons: 20,
        validFrom: '2026-08-01',
        validTo: null,
        unitPrice: null,
        totalAmount: null,
        note: null,
        tags: null,
      });
    });
  });

  // ─── findAll - GET /contracts ───

  describe('findAll', () => {
    it('should return an empty array', () => {
      const result = controller.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─── findOneByCode - GET /contracts/:code ───

  describe('findOneByCode', () => {
    it('should return a contract by code', async () => {
      const result = await controller.findOneByCode('CTR2026070001');

      expect(result).toEqual(mockContract);
      expect(mockService.findOneByCode).toHaveBeenCalledWith(
        'CTR2026070001',
      );
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockService.findOneByCode.mockRejectedValue(
        new NotFoundException('Contract not found: code=INVALID'),
      );

      await expect(
        controller.findOneByCode('INVALID'),
      ).rejects.toThrow(NotFoundException);

      expect(mockService.findOneByCode).toHaveBeenCalledWith('INVALID');
    });
  });

  // ─── freeze - PATCH /contracts/:code/freeze ───

  describe('freeze', () => {
    it('should freeze a contract', async () => {
      const result = await controller.freeze('CTR2026070001');

      expect(result.status).toBe('FROZEN');
      expect(mockService.freeze).toHaveBeenCalledWith(
        'CTR2026070001',
        0,
      );
    });
  });

  // ─── unfreeze - PATCH /contracts/:code/unfreeze ───

  describe('unfreeze', () => {
    it('should unfreeze a contract', async () => {
      const result = await controller.unfreeze('CTR2026070001');

      expect(result.status).toBe('ACTIVE');
      expect(mockService.unfreeze).toHaveBeenCalledWith(
        'CTR2026070001',
        0,
      );
    });
  });

  // ─── findByStudentCode - GET /contracts/students/:studentCode/contracts ───

  describe('findByStudentCode', () => {
    it('should return contracts for a student', async () => {
      const result = await controller.findByStudentCode('STU20260001');

      expect(result).toEqual([mockContract]);
      expect(mockService.findByStudentCode).toHaveBeenCalledWith(
        'STU20260001',
      );
    });
  });
});
