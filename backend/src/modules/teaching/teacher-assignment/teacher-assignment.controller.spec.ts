import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherAssignmentController } from './teacher-assignment.controller';
import { TeacherAssignmentService } from './teacher-assignment.service';
import { TeacherAssignmentEntity } from './teacher-assignment.entity';
import { TeacherRole } from '@common/enums/teacher-role.enum';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';

describe('TeacherAssignmentController', () => {
  let controller: TeacherAssignmentController;
  let service: jest.Mocked<TeacherAssignmentService>;
  let repo: jest.Mocked<Repository<TeacherAssignmentEntity>>;

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
  } as TeacherAssignmentEntity;

  const mockService = {
    assign: jest.fn<Promise<TeacherAssignmentEntity>, [any]>(),
    unassign: jest.fn<Promise<void>, [number]>(),
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

      const result = await controller.create(dto);

      expect(result).toEqual(mockAssignment);
      expect(service.assign).toHaveBeenCalledWith({
        classCode: 'CLS-001',
        teacherId: 100,
        role: TeacherRole.PRIMARY,
        assignedBy: 0,
        reason: '新学期安排',
      });
    });

    it('should assign without reason when optional', async () => {
      const dto: CreateTeacherAssignmentDto = {
        classCode: 'CLS-002',
        teacherId: 200,
        role: TeacherRole.SUBSTITUTE,
      };

      await controller.create(dto);

      expect(service.assign).toHaveBeenCalledWith({
        classCode: 'CLS-002',
        teacherId: 200,
        role: TeacherRole.SUBSTITUTE,
        assignedBy: 0,
        reason: undefined,
      });
    });
  });

  // ─── findAll — GET /teacher-assignments ───

  describe('findAll', () => {
    it('should return an empty array', () => {
      const result = controller.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─── findOne — GET /teacher-assignments/:id ───

  describe('findOne', () => {
    it('should return a teacher assignment by id', async () => {
      const result = await controller.findOne(1);

      expect(result).toEqual(mockAssignment);
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('should throw NotFoundException when assignment does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(controller.findOne(999)).rejects.toThrow(
        'Teacher assignment #999 not found',
      );
    });
  });

  // ─── remove — DELETE /teacher-assignments/:id ───

  describe('remove', () => {
    it('should unassign a teacher (end dated)', async () => {
      await controller.remove(1);

      expect(service.unassign).toHaveBeenCalledWith(1);
    });
  });
});
