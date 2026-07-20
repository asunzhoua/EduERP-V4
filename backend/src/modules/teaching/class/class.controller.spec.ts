import { Test, TestingModule } from '@nestjs/testing';
import { ClassController } from './class.controller';
import { ClassService } from './class.service';
import { ApiResponse } from '@common/dto/api-response';
import { ClassStatus } from './enums/class-status.enum';
import { TeacherRole } from '@common/enums/teacher-role.enum';
import { EnrollmentService } from '../enrollment/enrollment.service';

describe('ClassController', () => {
  let controller: ClassController;
  let service: ClassService;

  const mockClassService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByCode: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
    assignTeacher: jest.fn(),
    removeTeacher: jest.fn(),
    getTeachers: jest.fn(),
  };

  const mockEnrollmentService = {
    findStudentsByClassCode: jest.fn(),
    enroll: jest.fn(),
    findByClassCode: jest.fn(),
    findByStudentCode: jest.fn(),
    findOne: jest.fn(),
    withdraw: jest.fn(),
  };

  const mockRequest = { user: { sub: 1 } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassController],
      providers: [
        { provide: ClassService, useValue: mockClassService },
        { provide: EnrollmentService, useValue: mockEnrollmentService },
      ],
    }).compile();

    controller = module.get(ClassController);
    service = module.get(ClassService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── 1. create ───

  describe('create', () => {
    it('should create a class and return success response', async () => {
      const dto = {
        courseCode: 'CS2026070001',
        name: '周六上午10点班',
        startDate: '2026-07-12',
        totalLessons: 20,
        defaultDuration: 60,
        dayOfWeek: [6],
        startTime: '10:00',
        endTime: '11:30',
      };
      const created = { classCode: 'CLS20260712001', ...dto, status: ClassStatus.DRAFT };
      mockClassService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any, mockRequest);

      expect(result).toBeInstanceOf(ApiResponse);
      expect(result.code).toBe(0);
      expect(result.message).toBe('Class created');
      expect(result.data).toEqual(created);
      expect(mockClassService.create).toHaveBeenCalledWith(dto, 1);
    });
  });

  // ─── 2. findAll ───

  describe('findAll', () => {
    it('should return paginated class list', async () => {
      const query = { page: 1, pageSize: 20 };
      const paged = {
        items: [{ classCode: 'CLS001', name: 'Test Class' }],
        total: 1,
      };
      mockClassService.findAll.mockResolvedValue(paged);

      const result = await controller.findAll(query as any);

      expect(result.code).toBe(0);
      expect(result.data).toEqual(paged);
      expect(mockClassService.findAll).toHaveBeenCalledWith(query);
    });
  });

  // ─── 3. findOne ───

  describe('findOne', () => {
    it('should return a class by code', async () => {
      const cls = { classCode: 'CLS001', name: 'Test Class', status: ClassStatus.DRAFT };
      mockClassService.findByCode.mockResolvedValue(cls);

      const result = await controller.findOne('CLS001');

      expect(result.code).toBe(0);
      expect(result.data).toEqual(cls);
      expect(mockClassService.findByCode).toHaveBeenCalledWith('CLS001');
    });
  });

  // ─── 4. update ───

  describe('update', () => {
    it('should update a class and return success response', async () => {
      const dto = { name: 'Updated Class' };
      const updated = { classCode: 'CLS001', name: 'Updated Class', status: ClassStatus.DRAFT };
      mockClassService.update.mockResolvedValue(updated);

      const result = await controller.update('CLS001', dto as any, mockRequest);

      expect(result.code).toBe(0);
      expect(result.message).toBe('Class updated');
      expect(result.data).toEqual(updated);
      expect(mockClassService.update).toHaveBeenCalledWith('CLS001', dto, 1);
    });
  });

  // ─── 5. updateStatus ───

  describe('updateStatus', () => {
    it('should change class status and return success response', async () => {
      const dto = { status: ClassStatus.ACTIVE };
      const updated = { classCode: 'CLS001', status: ClassStatus.ACTIVE };
      mockClassService.updateStatus.mockResolvedValue(updated);

      const result = await controller.updateStatus('CLS001', dto as any, mockRequest);

      expect(result.code).toBe(0);
      expect(result.message).toBe('Status updated');
      expect(result.data).toEqual(updated);
      expect(mockClassService.updateStatus).toHaveBeenCalledWith(
        'CLS001',
        ClassStatus.ACTIVE,
        1,
        undefined,
      );
    });
  });

  // ─── 6. assignTeacher ───

  describe('assignTeacher', () => {
    it('should assign a teacher to a class', async () => {
      const dto = { teacherId: 5001, role: TeacherRole.PRIMARY, reason: '主讲教师' };
      const assignment = { id: 1, classCode: 'CLS001', teacherId: 5001, role: TeacherRole.PRIMARY };
      mockClassService.assignTeacher.mockResolvedValue(assignment);

      const result = await controller.assignTeacher('CLS001', dto as any, mockRequest);

      expect(result.code).toBe(0);
      expect(result.message).toBe('Teacher assigned');
      expect(result.data).toEqual(assignment);
      expect(mockClassService.assignTeacher).toHaveBeenCalledWith({
        classCode: 'CLS001',
        teacherId: 5001,
        role: TeacherRole.PRIMARY,
        assignedBy: 1,
        reason: '主讲教师',
      });
    });
  });

  // ─── 7. removeTeacher ───

  describe('removeTeacher', () => {
    it('should remove a teacher assignment from a class', async () => {
      mockClassService.removeTeacher.mockResolvedValue(undefined);

      const result = await controller.removeTeacher('CLS001', '10', mockRequest);

      expect(result.code).toBe(0);
      expect(result.message).toBe('Teacher assignment ended');
      expect(result.data).toBeNull();
      expect(mockClassService.removeTeacher).toHaveBeenCalledWith(10);
    });
  });

  // ─── 8. getTeachers ───

  describe('getTeachers', () => {
    it('should return active teachers for a class', async () => {
      const teachers = [
        { id: 1, teacherId: 5001, role: TeacherRole.PRIMARY },
        { id: 2, teacherId: 5002, role: TeacherRole.ASSISTANT },
      ];
      mockClassService.getTeachers.mockResolvedValue(teachers);

      const result = await controller.getTeachers('CLS001');

      expect(result.code).toBe(0);
      expect(result.data).toEqual(teachers);
      expect(mockClassService.getTeachers).toHaveBeenCalledWith('CLS001');
    });
  });

  // ─── 9. remove ───

  describe('remove', () => {
    it('should soft-delete a class and return success response', async () => {
      mockClassService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('CLS001', mockRequest);

      expect(result.code).toBe(0);
      expect(result.message).toBe('Class deleted');
      expect(result.data).toBeNull();
      expect(mockClassService.remove).toHaveBeenCalledWith('CLS001', 1);
    });
  });
});
