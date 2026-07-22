import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TeacherAssignmentService } from './teacher-assignment.service';
import { TeacherAssignmentRepository } from './teacher-assignment.repository';
import { TeacherAssignmentEntity } from './teacher-assignment.entity';
import { TeacherRole } from '@common/enums/teacher-role.enum';

describe('TeacherAssignmentService', () => {
  let service: TeacherAssignmentService;
  let repo: jest.Mocked<TeacherAssignmentRepository>;

  const mockAssignment: TeacherAssignmentEntity = {
    id: 1,
    classCode: 'CLS-001',
    teacherId: 100,
    role: TeacherRole.PRIMARY,
    effectiveFrom: '2026-07-15',
    effectiveTo: null,
    assignedBy: 5001,
    reason: null,
    createTime: new Date(),
    updateTime: new Date(),
  } as TeacherAssignmentEntity;

  beforeEach(async () => {
    const mockRepo = {
      save: jest.fn(),
      findByClass: jest.fn(),
      findActiveByClass: jest.fn(),
      findActivePrimary: jest.fn(),
      findActiveByClassAndTeacher: jest.fn(),
      countActivePrimary: jest.fn(),
      endAssignment: jest.fn(),
      repo: { create: jest.fn(), find: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherAssignmentService,
        { provide: TeacherAssignmentRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TeacherAssignmentService>(TeacherAssignmentService);
    repo = module.get(TeacherAssignmentRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── assign ───

  describe('assign', () => {
    it('should assign a teacher to a class', async () => {
      repo.findActiveByClassAndTeacher.mockResolvedValue(null);
      repo.findActivePrimary.mockResolvedValue(null);
      ((repo as any).repo.create as jest.Mock).mockReturnValue(mockAssignment);
      repo.save.mockResolvedValue(mockAssignment);

      const result = await service.assign({
        classCode: 'CLS-001',
        teacherId: 100,
        role: TeacherRole.PRIMARY,
        assignedBy: 5001,
      });

      expect(result).toEqual(mockAssignment);
      expect(repo.findActiveByClassAndTeacher).toHaveBeenCalledWith('CLS-001', 100);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw when teacher already assigned to class', async () => {
      repo.findActiveByClassAndTeacher.mockResolvedValue(mockAssignment);

      await expect(
        service.assign({
          classCode: 'CLS-001',
          teacherId: 100,
          role: TeacherRole.SUBSTITUTE,
          assignedBy: 5001,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.assign({
          classCode: 'CLS-001',
          teacherId: 100,
          role: TeacherRole.SUBSTITUTE,
          assignedBy: 5001,
        }),
      ).rejects.toThrow('already assigned');
    });

    it('should throw when assigning PRIMARY but one already exists', async () => {
      repo.findActiveByClassAndTeacher.mockResolvedValue(null);
      repo.findActivePrimary.mockResolvedValue({ ...mockAssignment, teacherId: 200 } as TeacherAssignmentEntity);

      await expect(
        service.assign({
          classCode: 'CLS-001',
          teacherId: 100,
          role: TeacherRole.PRIMARY,
          assignedBy: 5001,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.assign({
          classCode: 'CLS-001',
          teacherId: 100,
          role: TeacherRole.PRIMARY,
          assignedBy: 5001,
        }),
      ).rejects.toThrow('already has a PRIMARY teacher');
    });

    it('should allow SUBSTITUTE when PRIMARY exists', async () => {
      repo.findActiveByClassAndTeacher.mockResolvedValue(null);
      repo.findActivePrimary.mockResolvedValue({ ...mockAssignment, teacherId: 200 } as TeacherAssignmentEntity);
      ((repo as any).repo.create as jest.Mock).mockReturnValue({ ...mockAssignment, role: TeacherRole.SUBSTITUTE });
      repo.save.mockResolvedValue({ ...mockAssignment, role: TeacherRole.SUBSTITUTE } as TeacherAssignmentEntity);

      const result = await service.assign({
        classCode: 'CLS-001',
        teacherId: 100,
        role: TeacherRole.SUBSTITUTE,
        assignedBy: 5001,
      });

      expect(result.role).toBe(TeacherRole.SUBSTITUTE);
    });
  });

  // ─── unassign ───

  describe('unassign', () => {
    it('should end assignment', async () => {
      repo.endAssignment.mockResolvedValue(undefined);

      await service.unassign(1);

      expect(repo.endAssignment).toHaveBeenCalledWith(1, expect.any(String));
    });
  });

  // ─── findActiveByClass ───

  describe('findActiveByClass', () => {
    it('should return active assignments', async () => {
      repo.findActiveByClass.mockResolvedValue([mockAssignment]);

      const result = await service.findActiveByClass('CLS-001');

      expect(result).toHaveLength(1);
      expect(repo.findActiveByClass).toHaveBeenCalledWith('CLS-001');
    });
  });

  // ─── findActivePrimary ───

  describe('findActivePrimary', () => {
    it('should return primary teacher', async () => {
      repo.findActivePrimary.mockResolvedValue(mockAssignment);

      const result = await service.findActivePrimary('CLS-001');

      expect(result).toEqual(mockAssignment);
    });

    it('should return null when no primary', async () => {
      repo.findActivePrimary.mockResolvedValue(null);

      const result = await service.findActivePrimary('CLS-001');

      expect(result).toBeNull();
    });
  });

  // ─── countActivePrimary ───

  describe('countActivePrimary', () => {
    it('should return count', async () => {
      repo.countActivePrimary.mockResolvedValue(1);

      const result = await service.countActivePrimary('CLS-001');

      expect(result).toBe(1);
    });
  });

  // ─── findAllByClass ───

  describe('findAllByClass', () => {
    it('should return all assignments', async () => {
      repo.findByClass.mockResolvedValue([mockAssignment]);

      const result = await service.findAllByClass('CLS-001');

      expect(result).toHaveLength(1);
    });
  });

  // ─── findAll ───

  describe('findAll', () => {
    it('should return all assignments ordered by createTime DESC', async () => {
      ((repo as any).repo.find as jest.Mock).mockResolvedValue([mockAssignment]);

      const result = await service.findAll();

      expect(result).toEqual([mockAssignment]);
      expect((repo as any).repo.find).toHaveBeenCalledWith({
        order: { createTime: 'DESC' },
      });
    });

    it('should return empty array when no assignments', async () => {
      ((repo as any).repo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });
});
