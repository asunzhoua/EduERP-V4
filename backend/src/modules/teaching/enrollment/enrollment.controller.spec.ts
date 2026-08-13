import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { ClassService } from '../class/class.service';
import { DataScopeService } from '@common/services/data-scope.service';
import { ApiResponse } from '@common/dto/api-response';

describe('EnrollmentController', () => {
  let controller: EnrollmentController;
  let service: {
    enroll: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    withdraw: jest.Mock;
    transfer: jest.Mock;
    findByClassCode: jest.Mock;
    findByStudentCode: jest.Mock;
    findCandidates: jest.Mock;
  };
  let dataScopeService: { verifyStudentAccess: jest.Mock };
  let classService: { assertPrimaryTeacher: jest.Mock };

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
    findAll: jest.fn().mockResolvedValue({ items: [mockEnrollment], total: 1 }),
    findOne: jest.fn().mockResolvedValue(mockEnrollment),
    withdraw: jest.fn().mockResolvedValue({
      ...mockEnrollment,
      status: 'WITHDRAWN',
      withdrawReason: '个人原因',
    }),
    transfer: jest.fn().mockResolvedValue({
      source: { id: 1 },
      target: { id: 2 },
    }),
    findByClassCode: jest.fn().mockResolvedValue([mockEnrollment]),
    findByStudentCode: jest.fn().mockResolvedValue([mockEnrollment]),
    findCandidates: jest.fn().mockResolvedValue([mockEnrollment]),
  };

  const mockDataScopeService = {
    verifyStudentAccess: jest.fn().mockResolvedValue(undefined),
  };

  const mockClassService = {
    assertPrimaryTeacher: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentController],
      providers: [
        { provide: EnrollmentService, useValue: mockEnrollmentService },
        { provide: DataScopeService, useValue: mockDataScopeService },
        { provide: ClassService, useValue: mockClassService },
      ],
    }).compile();

    controller = module.get(EnrollmentController);
    service = module.get(EnrollmentService);
    dataScopeService = module.get(DataScopeService);
    classService = module.get(ClassService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock resolved values after clearAllMocks
    mockEnrollmentService.enroll.mockResolvedValue(mockEnrollment);
    mockEnrollmentService.findAll.mockResolvedValue({
      items: [mockEnrollment],
      total: 1,
    });
    mockEnrollmentService.findOne.mockResolvedValue(mockEnrollment);
    mockEnrollmentService.withdraw.mockResolvedValue({
      ...mockEnrollment,
      status: 'WITHDRAWN',
      withdrawReason: '个人原因',
    });
    mockEnrollmentService.transfer.mockResolvedValue({
      source: { id: 1 },
      target: { id: 2 },
    });
    mockEnrollmentService.findByClassCode.mockResolvedValue([mockEnrollment]);
    mockEnrollmentService.findByStudentCode.mockResolvedValue([mockEnrollment]);
    mockEnrollmentService.findCandidates.mockResolvedValue([mockEnrollment]);
    mockClassService.assertPrimaryTeacher.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // 1. enroll - POST
  describe('enroll', () => {
    it('should enroll a student into a class (admin)', async () => {
      const dto = {
        classCode: 'CLS001',
        studentCode: 'STU001',
        contractCode: 'CTR001',
      };
      const mockReq = { user: { sub: 42, role: 'Admin' } };

      const result = await controller.enroll(dto, mockReq);

      expect(result).toEqual(
        ApiResponse.success(mockEnrollment, 'Student enrolled'),
      );
      expect(service.enroll).toHaveBeenCalledWith({
        classCode: 'CLS001',
        studentCode: 'STU001',
        contractCode: 'CTR001',
        operatedBy: 42,
      });
      expect(classService.assertPrimaryTeacher).not.toHaveBeenCalled();
    });

    it('should verify PRIMARY ownership for teacher enroll', async () => {
      const dto = {
        classCode: 'CLS001',
        studentCode: 'STU001',
        contractCode: 'CTR001',
      };
      const mockReq = { user: { sub: 2, role: 'Teacher' } };

      const result = await controller.enroll(dto, mockReq);

      expect(classService.assertPrimaryTeacher).toHaveBeenCalledWith(
        'CLS001',
        2,
      );
      expect(service.enroll).toHaveBeenCalledWith({
        classCode: 'CLS001',
        studentCode: 'STU001',
        contractCode: 'CTR001',
        operatedBy: 2,
      });
      expect(result).toEqual(
        ApiResponse.success(mockEnrollment, 'Student enrolled'),
      );
    });
  });

  // candidates - GET /enrollments/candidates
  describe('candidates', () => {
    it('should return teacher-owned candidates for a teacher', async () => {
      const mockReq = { user: { sub: 2, role: 'Teacher' } };

      const result = await controller.candidates('CLS001', '', mockReq);

      expect(service.findCandidates).toHaveBeenCalledWith({
        teacherId: 2,
        classCode: 'CLS001',
        keyword: '',
      });
      expect(result).toEqual(ApiResponse.success([mockEnrollment]));
    });

    it('should return all candidates for an admin (no teacherId)', async () => {
      const mockReq = { user: { sub: 1, role: 'Admin' } };

      const result = await controller.candidates('CLS001', undefined, mockReq);

      expect(service.findCandidates).toHaveBeenCalledWith({
        teacherId: undefined,
        classCode: 'CLS001',
        keyword: undefined,
      });
      expect(result).toEqual(ApiResponse.success([mockEnrollment]));
    });
  });

  // findAll - GET /enrollments
  describe('findAll', () => {
    it('should return paginated enrollments', async () => {
      const result = await controller.findAll({});

      expect(result).toEqual(
        ApiResponse.success({ items: [mockEnrollment], total: 1 }),
      );
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  // 2. findOne - GET :id
  describe('findOne', () => {
    it('should return an enrollment by id', async () => {
      const result = await controller.findOne(1);

      expect(result).toEqual(ApiResponse.success(mockEnrollment));
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  // 3. withdraw - POST :id/withdraw
  describe('withdraw', () => {
    it('should withdraw an enrollment (admin)', async () => {
      const dto = { reason: '个人原因' };
      const mockReq = { user: { sub: 42, role: 'Admin' } };

      const result = await controller.withdraw(1, dto, mockReq);

      expect(result.data.status).toBe('WITHDRAWN');
      expect(service.withdraw).toHaveBeenCalledWith(1, '个人原因', 42);
      expect(classService.assertPrimaryTeacher).not.toHaveBeenCalled();
    });

    it('should verify PRIMARY ownership for teacher withdraw', async () => {
      const dto = { reason: '教师调整班级' };
      const mockReq = { user: { sub: 2, role: 'Teacher' } };

      const result = await controller.withdraw(1, dto, mockReq);

      expect(classService.assertPrimaryTeacher).toHaveBeenCalledWith(
        'CLS001',
        2,
      );
      expect(service.withdraw).toHaveBeenCalledWith(1, '教师调整班级', 2);
      expect(result.data.status).toBe('WITHDRAWN');
    });
  });

  // 4. transfer - POST :id/transfer
  describe('transfer', () => {
    it('should transfer an enrollment to another class', async () => {
      const dto = { targetClassCode: 'CL2026070002', reason: '换班' };
      const mockReq = { user: { sub: 9 } };

      const result = await controller.transfer(1, dto, mockReq);

      expect(result).toEqual(
        ApiResponse.success(
          { source: { id: 1 }, target: { id: 2 } },
          '调班成功',
        ),
      );
      expect(result.message).toBe('调班成功');
      expect(service.transfer).toHaveBeenCalledWith(
        1,
        'CL2026070002',
        '换班',
        9,
      );
    });
  });

  // 5. findByClassCode - GET classes/:code/enrollments
  describe('findByClass', () => {
    it('should return enrollments for a class', async () => {
      const result = await controller.findByClass('CLS001');

      expect(result).toEqual(ApiResponse.success([mockEnrollment]));
      expect(service.findByClassCode).toHaveBeenCalledWith('CLS001');
    });
  });

  // 6. findByStudentCode - GET students/:studentCode/enrollments
  describe('findByStudent', () => {
    it('should return enrollments for a student', async () => {
      const mockReq = { user: { sub: 1, role: 'Admin' } };

      const result = await controller.findByStudent('STU001', mockReq);

      expect(dataScopeService.verifyStudentAccess).toHaveBeenCalledWith(
        mockReq.user,
        'STU001',
      );
      expect(result).toEqual(ApiResponse.success([mockEnrollment]));
      expect(service.findByStudentCode).toHaveBeenCalledWith('STU001');
    });

    it('should deny access for unauthorized student', async () => {
      mockDataScopeService.verifyStudentAccess.mockRejectedValueOnce(
        new Error('Forbidden'),
      );
      const mockReq = { user: { sub: 2, role: 'Student' } };

      await expect(controller.findByStudent('STU001', mockReq)).rejects.toThrow(
        'Forbidden',
      );
    });
  });
});
