import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';

describe('EnrollmentController', () => {
  let controller: EnrollmentController;
  let service: EnrollmentService;

  const mockEnrollment = {
    id: 1,
    classCode: 'CLS001',
    studentCode: 'STU001',
    contractCode: 'CTR001',
    status: 'ACTIVE',
    withdrawReason: null,
    enrolledBy: 0,
  };

  const mockEnrollmentService = {
    enroll: jest.fn().mockResolvedValue(mockEnrollment),
    findOne: jest.fn().mockResolvedValue(mockEnrollment),
    withdraw: jest.fn().mockResolvedValue({
      ...mockEnrollment,
      status: 'WITHDRAWN',
      withdrawReason: '个人原因',
    }),
    findByClassCode: jest.fn().mockResolvedValue([mockEnrollment]),
    findByStudentCode: jest.fn().mockResolvedValue([mockEnrollment]),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentController],
      providers: [
        { provide: EnrollmentService, useValue: mockEnrollmentService },
      ],
    }).compile();

    controller = module.get(EnrollmentController);
    service = module.get(EnrollmentService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock resolved values after clearAllMocks
    mockEnrollmentService.enroll.mockResolvedValue(mockEnrollment);
    mockEnrollmentService.findOne.mockResolvedValue(mockEnrollment);
    mockEnrollmentService.withdraw.mockResolvedValue({
      ...mockEnrollment,
      status: 'WITHDRAWN',
      withdrawReason: '个人原因',
    });
    mockEnrollmentService.findByClassCode.mockResolvedValue([mockEnrollment]);
    mockEnrollmentService.findByStudentCode.mockResolvedValue([mockEnrollment]);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // 1. enroll - POST
  describe('enroll', () => {
    it('should enroll a student into a class', async () => {
      const dto = {
        classCode: 'CLS001',
        studentCode: 'STU001',
        contractCode: 'CTR001',
      };

      const result = await controller.enroll(dto);

      expect(result).toEqual(mockEnrollment);
      expect(service.enroll).toHaveBeenCalledWith({
        classCode: 'CLS001',
        studentCode: 'STU001',
        contractCode: 'CTR001',
      });
    });
  });

  // 2. findOne - GET :id
  describe('findOne', () => {
    it('should return an enrollment by id', async () => {
      const result = await controller.findOne(1);

      expect(result).toEqual(mockEnrollment);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  // 3. withdraw - POST :id/withdraw
  describe('withdraw', () => {
    it('should withdraw an enrollment', async () => {
      const dto = { reason: '个人原因' };

      const result = await controller.withdraw(1, dto);

      expect(result.status).toBe('WITHDRAWN');
      expect(service.withdraw).toHaveBeenCalledWith(1, '个人原因', 0);
    });
  });

  // 4. findByClassCode - GET classes/:code/enrollments
  describe('findByClass', () => {
    it('should return enrollments for a class', async () => {
      const result = await controller.findByClass('CLS001');

      expect(result).toEqual([mockEnrollment]);
      expect(service.findByClassCode).toHaveBeenCalledWith('CLS001');
    });
  });

  // 5. findByStudentCode - GET students/:studentCode/enrollments
  describe('findByStudent', () => {
    it('should return enrollments for a student', async () => {
      const result = await controller.findByStudent('STU001');

      expect(result).toEqual({ code: 0, message: 'success', data: [mockEnrollment] });
      expect(service.findByStudentCode).toHaveBeenCalledWith('STU001');
    });
  });
});
