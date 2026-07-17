import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClassService } from './class.service';
import { ClassRepository } from './class.repository';
import { ClassCodeGeneratorService } from './class-code-generator.service';
import { TeacherAssignmentService } from '../teacher-assignment/teacher-assignment.service';
import { ClassEntity } from './class.entity';
import { ClassStatus } from './enums/class-status.enum';
import { TeacherRole } from '@common/enums/teacher-role.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ClassService', () => {
  let service: ClassService;
  let classRepo: jest.Mocked<ClassRepository>;
  let codeGenerator: jest.Mocked<ClassCodeGeneratorService>;
  let teacherService: jest.Mocked<TeacherAssignmentService>;
  let mockRawCreate: jest.Mock;

  const mockClass: ClassEntity = {
    id: 1,
    classCode: 'CL2026070001',
    courseCode: 'CS2026070001',
    name: '周六上午10点班',
    status: ClassStatus.DRAFT,
    startDate: '2026-07-12',
    totalLessons: 20,
    defaultDuration: 60,
    dayOfWeek: [6],
    startTime: '10:00',
    endTime: '11:30',
    maxStudents: 20,
    room: null,
    tags: null,
    note: null,
    cancelledReason: null,
    createdBy: 1,
    createTime: new Date(),
    updatedBy: null,
    updateTime: new Date(),
    version: 1,
    deleted: false,
  };

  beforeEach(async () => {
    mockRawCreate = jest.fn();
    const mockClassRepo = {
      raw: { create: mockRawCreate },
      save: jest.fn(),
      findOneByCode: jest.fn(),
      findMany: jest.fn(),
    };

    const mockCodeGenerator = {
      generateClassCode: jest.fn(),
    };

    const mockTeacherService = {
      countActivePrimary: jest.fn(),
      assign: jest.fn(),
      unassign: jest.fn(),
      findActiveByClass: jest.fn(),
      findActivePrimary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassService,
        { provide: ClassRepository, useValue: mockClassRepo },
        { provide: ClassCodeGeneratorService, useValue: mockCodeGenerator },
        { provide: TeacherAssignmentService, useValue: mockTeacherService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ClassService>(ClassService);
    classRepo = module.get(ClassRepository);
    codeGenerator = module.get(ClassCodeGeneratorService);
    teacherService = module.get(TeacherAssignmentService);
  });

  // ─── Create ───

  describe('create', () => {
    it('should create a class with DRAFT status and auto-generated code', async () => {
      codeGenerator.generateClassCode.mockResolvedValue('CL2026070001');
      mockRawCreate.mockReturnValue({ ...mockClass });
      classRepo.save.mockResolvedValue({ ...mockClass });

      const result = await service.create(
        {
          courseCode: 'CS2026070001',
          name: '周六上午10点班',
          startDate: '2026-07-12',
          totalLessons: 20,
          defaultDuration: 60,
          dayOfWeek: [6],
          startTime: '10:00',
          endTime: '11:30',
        },
        1,
      );

      expect(result.classCode).toBe('CL2026070001');
      expect(result.status).toBe(ClassStatus.DRAFT);
      expect(codeGenerator.generateClassCode).toHaveBeenCalled();
    });
  });

  // ─── Read ───

  describe('findByCode', () => {
    it('should return a class when found', async () => {
      classRepo.findOneByCode.mockResolvedValue({ ...mockClass });
      const result = await service.findByCode('CL2026070001');
      expect(result.classCode).toBe('CL2026070001');
    });

    it('should throw NotFoundException when not found', async () => {
      classRepo.findOneByCode.mockResolvedValue(null);
      await expect(service.findByCode('CL0000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Status Transitions ───

  describe('updateStatus', () => {
    it('should allow DRAFT -> ACTIVE when guards are met', async () => {
      const draft = {
        ...mockClass,
        totalLessons: 20,
        dayOfWeek: [6],
        startTime: '10:00',
        endTime: '11:30',
        startDate: '2026-07-12',
      };
      classRepo.findOneByCode.mockResolvedValue(draft);
      classRepo.save.mockResolvedValue({
        ...draft,
        status: ClassStatus.ACTIVE,
      });
      teacherService.countActivePrimary.mockResolvedValue(1);

      const result = await service.updateStatus(
        'CL2026070001',
        ClassStatus.ACTIVE,
        1,
      );
      expect(result.status).toBe(ClassStatus.ACTIVE);
    });

    it('should block DRAFT -> ACTIVE without PRIMARY teacher', async () => {
      const draft = { ...mockClass };
      classRepo.findOneByCode.mockResolvedValue(draft);
      teacherService.countActivePrimary.mockResolvedValue(0);

      await expect(
        service.updateStatus('CL2026070001', ClassStatus.ACTIVE, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block DRAFT -> ACTIVE without schedule (dayOfWeek empty)', async () => {
      const draft = { ...mockClass, dayOfWeek: [] as number[] };
      classRepo.findOneByCode.mockResolvedValue(draft);
      teacherService.countActivePrimary.mockResolvedValue(1);

      await expect(
        service.updateStatus('CL2026070001', ClassStatus.ACTIVE, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block DRAFT -> ACTIVE without totalLessons', async () => {
      const draft = { ...mockClass, totalLessons: 0 };
      classRepo.findOneByCode.mockResolvedValue(draft);
      teacherService.countActivePrimary.mockResolvedValue(1);

      await expect(
        service.updateStatus('CL2026070001', ClassStatus.ACTIVE, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow ACTIVE -> COMPLETED', async () => {
      const active = { ...mockClass, status: ClassStatus.ACTIVE };
      classRepo.findOneByCode.mockResolvedValue(active);
      classRepo.save.mockResolvedValue({
        ...active,
        status: ClassStatus.COMPLETED,
      });

      const result = await service.updateStatus(
        'CL2026070001',
        ClassStatus.COMPLETED,
        1,
      );
      expect(result.status).toBe(ClassStatus.COMPLETED);
    });

    it('should allow ACTIVE -> CANCELLED with reason', async () => {
      const active = { ...mockClass, status: ClassStatus.ACTIVE };
      classRepo.findOneByCode.mockResolvedValue(active);
      classRepo.save.mockResolvedValue({
        ...active,
        status: ClassStatus.CANCELLED,
        cancelledReason: '生源不足',
      });

      const result = await service.updateStatus(
        'CL2026070001',
        ClassStatus.CANCELLED,
        1,
        '生源不足',
      );
      expect(result.status).toBe(ClassStatus.CANCELLED);
    });

    it('should block ACTIVE -> CANCELLED without reason', async () => {
      const active = { ...mockClass, status: ClassStatus.ACTIVE };
      classRepo.findOneByCode.mockResolvedValue(active);

      await expect(
        service.updateStatus('CL2026070001', ClassStatus.CANCELLED, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow CANCELLED -> ACTIVE (admin override)', async () => {
      const cancelled = {
        ...mockClass,
        status: ClassStatus.CANCELLED,
        dayOfWeek: [6],
        startTime: '10:00',
        endTime: '11:30',
        startDate: '2026-07-12',
        totalLessons: 20,
      };
      classRepo.findOneByCode.mockResolvedValue(cancelled);
      classRepo.save.mockResolvedValue({
        ...cancelled,
        status: ClassStatus.ACTIVE,
      });
      teacherService.countActivePrimary.mockResolvedValue(1);

      const result = await service.updateStatus(
        'CL2026070001',
        ClassStatus.ACTIVE,
        1,
      );
      expect(result.status).toBe(ClassStatus.ACTIVE);
    });

    it('should block DRAFT -> COMPLETED (not a valid transition)', async () => {
      const draft = { ...mockClass };
      classRepo.findOneByCode.mockResolvedValue(draft);

      await expect(
        service.updateStatus('CL2026070001', ClassStatus.COMPLETED, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block COMPLETED -> any (terminal state)', async () => {
      const completed = { ...mockClass, status: ClassStatus.COMPLETED };
      classRepo.findOneByCode.mockResolvedValue(completed);

      await expect(
        service.updateStatus('CL2026070001', ClassStatus.ACTIVE, 1),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatus(
          'CL2026070001',
          ClassStatus.CANCELLED,
          1,
          'reason',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block same-status transition', async () => {
      const draft = { ...mockClass };
      classRepo.findOneByCode.mockResolvedValue(draft);

      await expect(
        service.updateStatus('CL2026070001', ClassStatus.DRAFT, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Soft Delete ───

  describe('remove', () => {
    it('should soft delete a DRAFT class', async () => {
      const draft = { ...mockClass };
      classRepo.findOneByCode.mockResolvedValue(draft);
      classRepo.save.mockResolvedValue({ ...draft, deleted: true });

      await service.remove('CL2026070001', 1);
      expect(classRepo.save).toHaveBeenCalled();
    });

    it('should reject soft delete of ACTIVE class', async () => {
      const active = { ...mockClass, status: ClassStatus.ACTIVE };
      classRepo.findOneByCode.mockResolvedValue(active);

      await expect(service.remove('CL2026070001', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject soft delete of COMPLETED class', async () => {
      const completed = { ...mockClass, status: ClassStatus.COMPLETED };
      classRepo.findOneByCode.mockResolvedValue(completed);

      await expect(service.remove('CL2026070001', 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Update (DRAFT only) ───

  describe('update', () => {
    it('should update DRAFT class fields', async () => {
      const draft = { ...mockClass };
      classRepo.findOneByCode.mockResolvedValue(draft);
      classRepo.save.mockResolvedValue({ ...draft, name: '新名称' });

      const result = await service.update(
        'CL2026070001',
        { name: '新名称' },
        1,
      );
      expect(result.name).toBe('新名称');
    });

    it('should reject update of ACTIVE class', async () => {
      const active = { ...mockClass, status: ClassStatus.ACTIVE };
      classRepo.findOneByCode.mockResolvedValue(active);

      await expect(
        service.update('CL2026070001', { name: '新名称' }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Teacher Management ───

  describe('assignTeacher', () => {
    it('should delegate to TeacherAssignmentService', async () => {
      classRepo.findOneByCode.mockResolvedValue({ ...mockClass });
      teacherService.assign.mockResolvedValue({
        id: 1,
        classCode: 'CL2026070001',
        teacherId: 5001,
        role: TeacherRole.PRIMARY,
        effectiveFrom: '2026-07-14',
        effectiveTo: null,
        assignedBy: 1,
        reason: null,
        createTime: new Date(),
      });

      const result = await service.assignTeacher({
        classCode: 'CL2026070001',
        teacherId: 5001,
        role: TeacherRole.PRIMARY,
        assignedBy: 1,
      });

      expect(teacherService.assign).toHaveBeenCalled();
      expect(result.teacherId).toBe(5001);
    });

    it('should throw NotFoundException if class does not exist', async () => {
      classRepo.findOneByCode.mockResolvedValue(null);

      await expect(
        service.assignTeacher({
          classCode: 'CL0000000000',
          teacherId: 5001,
          role: TeacherRole.PRIMARY,
          assignedBy: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
