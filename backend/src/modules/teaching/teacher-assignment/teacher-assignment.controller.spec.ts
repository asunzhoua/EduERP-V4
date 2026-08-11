import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeacherAssignmentController } from './teacher-assignment.controller';
import { TeacherAssignmentService } from './teacher-assignment.service';
import { TeacherAssignmentEntity } from './teacher-assignment.entity';
import { TeacherRole } from '@common/enums/teacher-role.enum';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { ApiResponse } from '@common/dto/api-response';

describe('TeacherAssignmentController', () => {
  let controller: TeacherAssignmentController;
  let service: {
    assign: jest.Mock;
    unassign: jest.Mock;
    findAll: jest.Mock;
    findActiveByClass: jest.Mock;
    findActivePrimary: jest.Mock;
    findAllByClass: jest.Mock;
    countActivePrimary: jest.Mock;
  };
  let repo: { findOneBy: jest.Mock };

  const mockAssignment: TeacherAssignmentEntity = {
    id: 1,
    classCode: 'CLS-001',
    teacherId: 100,
    role: TeacherRole.PRIMARY,
    effectiveFrom: '2026-07-15',
    effectiveTo: null,
    assignedBy: 0,
    reason: null,
    createTime: new Date('2026-07-15'),
  };

  const mockService = {
    assign: jest.fn<Promise<TeacherAssignmentEntity>, [any]>(),
    unassign: jest.fn<Promise<void>, [number]>(),
    findAll: jest.fn<Promise<TeacherAssignmentEntity[]>, []>(),
    findActiveByClass: jest.fn(),
    findActivePrimary: jest.fn(),
    findAllByClass: jest.fn(),
    countActivePrimary: jest.fn(),
  };

  const mockRepo = {
    findOneBy: jest.fn<Promise<TeacherAssignmentEntity | null>, [any]>(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeacherAssignmentController],
      providers: [
        { provide: TeacherAssignmentService, useValue: mockService },
        {
          provide: getRepositoryToken(TeacherAssignmentEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    controller = module.get(TeacherAssignmentController);
    service = module.get(TeacherAssignmentService);
    repo = module.get(getRepositoryToken(TeacherAssignmentEntity));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default mock implementations
    mockService.assign.mockResolvedValue(mockAssignment);
    mockService.unassign.mockResolvedValue(undefined);
    mockService.findAll.mockResolvedValue([mockAssignment]);
    mockRepo.findOneBy.mockResolvedValue(mockAssignment);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── create — POST /teacher-assignments ───

  describe('create', () => {
    it('should assign a teacher to a class', async () => {
      const dto: CreateTeacherAssignmentDto = {
        classCode: 'CLS-001',
        teacherId: 100,
        role: TeacherRole.PRIMARY,
        reason: '新学期安排',
      };
      const mockReq = { user: { sub: 42 } };

      const result = await controller.create(dto, mockReq);

      expect(result).toEqual(
        ApiResponse.success(mockAssignment, 'Teacher assigned'),
      );
      expect(service.assign).toHaveBeenCalledWith({
        classCode: 'CLS-001',
        teacherId: 100,
        role: TeacherRole.PRIMARY,
        assignedBy: 42,
        reason: '新学期安排',
      });
    });

    it('should assign without reason when optional', async () => {
      const dto: CreateTeacherAssignmentDto = {
        classCode: 'CLS-002',
        teacherId: 200,
        role: TeacherRole.SUBSTITUTE,
      };
      const mockReq = { user: { sub: 42 } };

      await controller.create(dto, mockReq);

      expect(service.assign).toHaveBeenCalledWith({
        classCode: 'CLS-002',
        teacherId: 200,
        role: TeacherRole.SUBSTITUTE,
        assignedBy: 42,
        reason: undefined,
      });
    });
  });

  // ─── findAll — GET /teacher-assignments ───

  describe('findAll', () => {
    it('should return all teacher assignments', async () => {
      const mockReq = { user: { sub: 42, role: 'Admin' } };
      const result = await controller.findAll(mockReq);

      expect(result).toEqual(ApiResponse.success([mockAssignment]));
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should return empty array when no assignments exist', async () => {
      mockService.findAll.mockResolvedValue([]);
      const mockReq = { user: { sub: 42, role: 'Admin' } };

      const result = await controller.findAll(mockReq);

      expect(result).toEqual(ApiResponse.success([]));
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should filter by teacherId when user is Teacher', async () => {
      const mockReq = { user: { sub: 100, role: 'Teacher' } };
      const result = await controller.findAll(mockReq);

      expect(result).toEqual(ApiResponse.success([mockAssignment]));
      expect(service.findAll).toHaveBeenCalledWith(100);
    });
  });

  // ─── findOne — GET /teacher-assignments/:id ───

  describe('findOne', () => {
    it('should return a teacher assignment by id', async () => {
      const mockReq = { user: { sub: 42, role: 'Admin' } };
      const result = await controller.findOne(1, mockReq);

      expect(result).toEqual(ApiResponse.success(mockAssignment));
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('should throw NotFoundException when assignment does not exist', async () => {
      const mockReq = { user: { sub: 42, role: 'Admin' } };
      mockRepo.findOneBy.mockResolvedValue(null);

      await expect(controller.findOne(999, mockReq)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.findOne(999, mockReq)).rejects.toThrow(
        'Teacher assignment #999 not found',
      );
    });

    it('should return null when Teacher accesses another teacher assignment', async () => {
      const mockReq = { user: { sub: 200, role: 'Teacher' } };
      const result = await controller.findOne(1, mockReq);

      expect(result).toEqual(ApiResponse.success(null));
    });

    it('should return assignment when Teacher accesses own assignment', async () => {
      const mockReq = { user: { sub: 100, role: 'Teacher' } };
      const result = await controller.findOne(1, mockReq);

      expect(result).toEqual(ApiResponse.success(mockAssignment));
    });
  });

  // ─── remove — DELETE /teacher-assignments/:id ───

  describe('remove', () => {
    it('should unassign a teacher (end dated)', async () => {
      const result = await controller.remove(1);

      expect(service.unassign).toHaveBeenCalledWith(1);
      expect(result).toEqual(
        ApiResponse.success(undefined, 'Teacher assignment ended'),
      );
    });
  });
});
