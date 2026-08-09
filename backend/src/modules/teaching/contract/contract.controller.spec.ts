import { Test, TestingModule } from '@nestjs/testing';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { DataScopeService } from '@common/services/data-scope.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiResponse } from '@common/dto/api-response';

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
    findAll: jest.fn().mockResolvedValue({ items: [mockContract], total: 1 }),
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
    adjustLessons: jest.fn().mockResolvedValue({
      ...mockContract,
      totalLessons: 35,
      remainingLessons: 35,
    }),
    getConsumeRecords: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }),
    getRenewalWarnings: jest.fn().mockResolvedValue([]),
  };

  const mockDataScopeService = {
    verifyStudentAccess: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractController],
      providers: [
        {
          provide: ContractService,
          useValue: mockService,
        },
        {
          provide: DataScopeService,
          useValue: mockDataScopeService,
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
    mockService.findAll.mockResolvedValue({ items: [mockContract], total: 1 });
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
    mockService.adjustLessons.mockResolvedValue({
      ...mockContract,
      totalLessons: 35,
      remainingLessons: 35,
    });
    mockService.getConsumeRecords.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    mockService.getRenewalWarnings.mockResolvedValue([]);
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
      } as any;

      const result = await controller.create(dto);

      expect(result).toEqual(ApiResponse.success(mockContract, 'Contract created'));
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
      } as any;

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
    it('should return paginated contracts', async () => {
      const result = await controller.findAll({});

      expect(result).toEqual(ApiResponse.success({ items: [mockContract], total: 1 }));
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  // ─── findOneByCode - GET /contracts/:code ───

  describe('findOneByCode', () => {
    it('should return a contract by code', async () => {
      const result = await controller.findOneByCode('CTR2026070001');

      expect(result).toEqual(ApiResponse.success(mockContract));
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
      const mockReq = { user: { sub: 42 } };
      const result = await controller.freeze('CTR2026070001', mockReq);

      expect(result.data.status).toBe('FROZEN');
      expect(mockService.freeze).toHaveBeenCalledWith(
        'CTR2026070001',
        42,
      );
    });
  });

  // ─── unfreeze - PATCH /contracts/:code/unfreeze ───

  describe('unfreeze', () => {
    it('should unfreeze a contract', async () => {
      const mockReq = { user: { sub: 42 } };
      const result = await controller.unfreeze('CTR2026070001', mockReq);

      expect(result.data.status).toBe('ACTIVE');
      expect(mockService.unfreeze).toHaveBeenCalledWith(
        'CTR2026070001',
        42,
      );
    });
  });

  // ─── adjustLessons - PATCH /contracts/:code/lessons ───

  describe('adjustLessons', () => {
    it('should adjust lessons with operator id from req.user', async () => {
      const mockReq = { user: { sub: 42 } };
      const dto = {
        totalLessons: 35,
        remainingLessons: 35,
        reason: '家长续费',
      } as any;

      const result = await controller.adjustLessons('CTR2026070001', dto, mockReq);

      expect(result.data.totalLessons).toBe(35);
      expect(result.data.remainingLessons).toBe(35);
      expect(mockService.adjustLessons).toHaveBeenCalledWith(
        'CTR2026070001',
        dto,
        42,
      );
    });
  });

  // ─── findByStudentCode - GET /contracts/students/:studentCode/contracts ───

  describe('findByStudentCode', () => {
    it('should return contracts for a student', async () => {
      const mockReq = { user: { sub: 42, role: 'Admin' } };
      const result = await controller.findByStudentCode('STU20260001', mockReq);

      expect(result).toEqual(ApiResponse.success([mockContract]));
      expect(mockService.findByStudentCode).toHaveBeenCalledWith(
        'STU20260001',
      );
      expect(mockDataScopeService.verifyStudentAccess).toHaveBeenCalledWith(
        mockReq.user,
        'STU20260001',
      );
    });
  });

  // ─── getConsumeRecords - GET /contracts/:code/consume-records ───

  describe('getConsumeRecords', () => {
    it('should fetch contract, verify student access, then return records', async () => {
      const mockReq = { user: { sub: 7, role: 'Parent' } };
      const result = await controller.getConsumeRecords(
        'CTR2026070001',
        { page: 1, pageSize: 20 } as any,
        mockReq,
      );

      expect(mockService.findOneByCode).toHaveBeenCalledWith('CTR2026070001');
      expect(mockDataScopeService.verifyStudentAccess).toHaveBeenCalledWith(
        mockReq.user,
        'STU20260001',
      );
      expect(mockService.getConsumeRecords).toHaveBeenCalledWith(
        mockContract,
        1,
        20,
      );
      expect(result).toEqual(
        ApiResponse.success({ items: [], total: 0, page: 1, pageSize: 20 }),
      );
    });

    it('should propagate 403 when parent has no access to the contract student', async () => {
      mockDataScopeService.verifyStudentAccess.mockRejectedValue(
        new ForbiddenException('无权访问该学生的记录'),
      );

      await expect(
        controller.getConsumeRecords(
          'CTR2026070001',
          { page: 1, pageSize: 20 } as any,
          { user: { sub: 7, role: 'Parent' } } as any,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockService.getConsumeRecords).not.toHaveBeenCalled();
    });

    it('should propagate 404 when contract not found', async () => {
      mockService.findOneByCode.mockRejectedValue(
        new NotFoundException('Contract not found: code=INVALID'),
      );

      await expect(
        controller.getConsumeRecords(
          'INVALID',
          { page: 1, pageSize: 20 } as any,
          { user: { sub: 1, role: 'Teacher' } } as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getRenewalWarnings - GET /contracts/renewal-warnings ───

  describe('getRenewalWarnings', () => {
    it('should return warnings using default threshold', async () => {
      const result = await controller.getRenewalWarnings({});

      expect(mockService.getRenewalWarnings).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(ApiResponse.success([]));
    });

    it('should pass an explicit threshold query', async () => {
      await controller.getRenewalWarnings({ threshold: 3 });

      expect(mockService.getRenewalWarnings).toHaveBeenCalledWith(3);
    });
  });
});
