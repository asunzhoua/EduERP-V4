import { Test, TestingModule } from '@nestjs/testing';
import { StudentController } from './student.controller';
import { StudentService } from './services/student.service';
import { ContractRepository } from '../teaching/contract/contract.repository';
import { LessonAttendanceRepository } from '../teaching/lesson-attendance/lesson-attendance.repository';
import { LessonEntity } from '../teaching/lesson/lesson.entity';
import { EnrollmentEntity } from '../teaching/enrollment/enrollment.entity';
import { TeacherAssignmentEntity } from '../teaching/teacher-assignment/teacher-assignment.entity';
import { ClassEntity } from '../teaching/class/class.entity';
import { CourseEntity } from '../teaching/course/course.entity';
import { User } from '../identity/entities/user.entity';
import { PointsService } from '../points/points.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { ParentCreateStudentDto } from './dto/parent-create-student.dto';
import { ParentUpdateStudentDto } from './dto/parent-update-student.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { AuthedRequest } from '@common/types/authed-request';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('StudentController', () => {
  let controller: StudentController;
  let service: Record<string, jest.Mock>;

  const mockStudent = { id: 1, name: '张三', studentCode: 'STU20240001' };
  const mockReq = { user: { sub: 1 } };

  const mockContractRepository = {
    findByStudentCode: jest.fn().mockResolvedValue([]),
  };
  const mockAttendanceRepository = {
    findByStudentCode: jest.fn().mockResolvedValue([]),
  };
  const mockLessonRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const mockEnrollmentRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const mockTeacherAssignmentRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const mockUserRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const mockClassRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const mockCourseRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const mockPointsService = {
    getSummary: jest.fn().mockResolvedValue({
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      transactions: [],
    }),
    listOnSaleProducts: jest.fn().mockResolvedValue([]),
    exchange: jest.fn().mockResolvedValue({ id: 1 }),
  };

  beforeAll(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockStudent),
      findAll: jest.fn().mockResolvedValue({ items: [mockStudent], total: 1 }),
      findById: jest.fn().mockResolvedValue(mockStudent),
      findByUserId: jest.fn().mockResolvedValue(mockStudent),
      update: jest.fn().mockResolvedValue(mockStudent),
      updateStatus: jest.fn().mockResolvedValue(mockStudent),
      softDelete: jest.fn().mockResolvedValue(undefined),
      linkParent: jest
        .fn()
        .mockResolvedValue({ id: 1, studentId: 1, parentId: 2 }),
      unlinkParent: jest.fn().mockResolvedValue(undefined),
      getParents: jest.fn().mockResolvedValue([{ id: 2, name: '李四' }]),
      getStudentsByParent: jest.fn().mockResolvedValue([mockStudent]),
      importStudents: jest.fn().mockResolvedValue({ success: 1, failed: 0 }),
      getStudentLessons: jest.fn().mockResolvedValue([]),
      getStudentPoints: jest.fn().mockResolvedValue({ balance: 0 }),
      getStudentFeedback: jest.fn().mockResolvedValue([]),
      getChildLessons: jest.fn().mockResolvedValue([]),
      getChildPoints: jest.fn().mockResolvedValue({ balance: 0 }),
      getChildFeedback: jest.fn().mockResolvedValue([]),
      getChildForParent: jest.fn().mockResolvedValue(mockStudent),
      updateChild: jest.fn().mockResolvedValue(mockStudent),
      unlinkChild: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [
        { provide: StudentService, useValue: service },
        { provide: ContractRepository, useValue: mockContractRepository },
        {
          provide: LessonAttendanceRepository,
          useValue: mockAttendanceRepository,
        },
        {
          provide: getRepositoryToken(LessonEntity),
          useValue: mockLessonRepository,
        },
        {
          provide: getRepositoryToken(EnrollmentEntity),
          useValue: mockEnrollmentRepository,
        },
        {
          provide: getRepositoryToken(TeacherAssignmentEntity),
          useValue: mockTeacherAssignmentRepository,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        {
          provide: getRepositoryToken(ClassEntity),
          useValue: mockClassRepository,
        },
        {
          provide: getRepositoryToken(CourseEntity),
          useValue: mockCourseRepository,
        },
        { provide: PointsService, useValue: mockPointsService },
      ],
    }).compile();

    controller = module.get(StudentController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('POST /students - create', async () => {
    const dto = { name: '张三', gender: 'M', birthDate: '2015-01-01' };
    const result = await controller.create(
      dto as unknown as CreateStudentDto,
      mockReq,
    );
    expect(result.code).toBe(0);
    expect(result.data!).toEqual(mockStudent);
    expect(service.create).toHaveBeenCalledWith(dto, 1);
  });

  it('POST /students/my-children - parent creates and binds self', async () => {
    const dto = {
      name: '小红',
      gender: 'FEMALE',
      birthDate: '2016-03-01',
      grade: '一年级',
    };
    service.create.mockResolvedValue(mockStudent);
    const result = await controller.createMyChild(
      dto as unknown as ParentCreateStudentDto,
      mockReq,
    );
    expect(result.code).toBe(0);
    expect(result.data!).toEqual(mockStudent);
    expect(service.create).toHaveBeenCalledWith(
      { ...dto, parentIds: [1] },
      1,
      'API',
    );
  });

  it('GET /students - findAll', async () => {
    const result = await controller.findAll(
      { page: 1 },
      {
        user: { role: 'Admin', sub: 1 },
      },
    );
    expect(result.code).toBe(0);
    expect(result.data!.items).toHaveLength(1);
  });

  it('GET /students/:id - findOne', async () => {
    const result = await controller.findOne(1);
    expect(result.code).toBe(0);
    expect(result.data!).toEqual(mockStudent);
    expect(service.findById).toHaveBeenCalledWith(1);
  });

  it('PUT /students/:id - update', async () => {
    const dto = { name: '张三丰' };
    const result = await controller.update(1, dto, mockReq);
    expect(result.code).toBe(0);
    expect(result.data).toEqual(mockStudent);
    expect(service.update).toHaveBeenCalledWith(1, dto, 1);
  });

  it('PATCH /students/:id/status - updateStatus', async () => {
    const dto = { status: 'INACTIVE' };
    const result = await controller.updateStatus(
      1,
      dto as unknown as UpdateStudentStatusDto,
      mockReq,
    );
    expect(result.code).toBe(0);
    expect(service.updateStatus).toHaveBeenCalledWith(1, dto, 1);
  });

  it('DELETE /students/:id - remove', async () => {
    const result = await controller.remove(1, mockReq);
    expect(result.code).toBe(0);
    expect(result.data).toBeNull();
    expect(service.softDelete).toHaveBeenCalledWith(1, 1);
  });

  it('POST /students/:id/parents - linkParent', async () => {
    const result = await controller.linkParent(1, 2, '父亲', true);
    expect(result.code).toBe(0);
    expect(service.linkParent).toHaveBeenCalledWith(1, 2, '父亲', true);
  });

  it('DELETE /students/:id/parents/:parentId - unlinkParent', async () => {
    const result = await controller.unlinkParent(1, 2);
    expect(result.code).toBe(0);
    expect(result.data).toBeNull();
    expect(service.unlinkParent).toHaveBeenCalledWith(1, 2);
  });

  it('GET /students/:id/parents - getParents', async () => {
    const result = await controller.getParents(1);
    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(service.getParents).toHaveBeenCalledWith(1);
  });

  it('GET /students/parents/:parentId/students - getStudentsByParent', async () => {
    const result = await controller.getStudentsByParent(2);
    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(service.getStudentsByParent).toHaveBeenCalledWith(2);
  });

  it('POST /students/import - import', async () => {
    const file = { buffer: Buffer.from('data'), originalname: 'students.xlsx' };
    const result = await controller.import(
      file as unknown as Express.Multer.File,
      mockReq,
    );
    expect(result.code).toBe(0);
    expect(result.data).toEqual({ success: 1, failed: 0 });
    expect(service.importStudents).toHaveBeenCalledWith(
      file.buffer,
      file.originalname,
      1,
    );
  });

  it('GET self/attendance - maps deductionSkippedReason', async () => {
    service.findByUserId.mockResolvedValue(mockStudent);
    mockAttendanceRepository.findByStudentCode.mockResolvedValue([
      {
        id: 1,
        lessonId: 10,
        studentCode: 'STU20240001',
        status: 'PRESENT',
        deductionSkippedReason: 'NO_ACTIVE_CONTRACT',
      },
    ]);
    mockLessonRepository.find.mockResolvedValue([
      {
        id: 10,
        classCode: 'CL1',
        courseCode: 'C1',
        scheduledDate: '2026-08-06',
        startTime: '09:00',
        endTime: '10:00',
      },
    ]);
    mockClassRepository.find.mockResolvedValue([
      { classCode: 'CL1', name: '一班' },
    ]);
    mockCourseRepository.find.mockResolvedValue([
      { courseCode: 'C1', name: '数学' },
    ]);

    const result = await controller.getSelfAttendance(mockReq);
    expect(result.code).toBe(0);
    expect(result.data![0]).toMatchObject({
      id: 1,
      status: 'PRESENT',
      deductionSkippedReason: 'NO_ACTIVE_CONTRACT',
    });
  });

  it('GET self/lessons - delegates to service (shared assembly)', async () => {
    service.findByUserId.mockResolvedValue(mockStudent);
    service.getStudentLessons.mockResolvedValue([
      { lessonId: 1, lessonDate: '2026-08-10', className: '一班' },
    ]);

    const result = await controller.getSelfLessons(
      mockReq,
      '2026-08-01',
      '2026-08-31',
    );
    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(service.getStudentLessons).toHaveBeenCalledWith(
      'STU20240001',
      '2026-08-01',
      '2026-08-31',
    );
  });

  it('GET self/lessons - 404 when no linked student', async () => {
    service.findByUserId.mockResolvedValue(null);
    const result = await controller.getSelfLessons(mockReq);
    expect(result.code).toBe(404);
    expect(service.getStudentLessons).not.toHaveBeenCalled();
  });

  it('GET self/points - delegates to service', async () => {
    service.findByUserId.mockResolvedValue(mockStudent);
    service.getStudentPoints.mockResolvedValue({ balance: 30 });

    const result = await controller.getSelfPoints(mockReq);
    expect(result.code).toBe(0);
    expect(service.getStudentPoints).toHaveBeenCalledWith('STU20240001');
  });

  it('GET self/feedback - delegates to service', async () => {
    service.findByUserId.mockResolvedValue(mockStudent);
    service.getStudentFeedback.mockResolvedValue([{ id: 1 }]);

    const result = await controller.getSelfFeedback(mockReq);
    expect(result.code).toBe(0);
    expect(service.getStudentFeedback).toHaveBeenCalledWith('STU20240001');
  });

  it('GET /students/:childId/lessons - delegates to service', async () => {
    service.getChildLessons.mockResolvedValue([{ lessonId: 1 }]);

    const result = await controller.getChildLessons(
      5,
      { sub: 2 } as unknown as AuthedRequest['user'],
      '2026-08-01',
      '2026-08-31',
    );
    expect(result.code).toBe(0);
    expect(service.getChildLessons).toHaveBeenCalledWith(
      2,
      5,
      '2026-08-01',
      '2026-08-31',
    );
  });

  it('GET /students/:childId/points - delegates to service', async () => {
    service.getChildPoints.mockResolvedValue({ balance: 50 });

    const result = await controller.getChildPoints(5, {
      sub: 2,
    } as unknown as AuthedRequest['user']);
    expect(result.code).toBe(0);
    expect(service.getChildPoints).toHaveBeenCalledWith(2, 5);
  });

  it('GET /students/:childId/feedback - delegates to service', async () => {
    service.getChildFeedback.mockResolvedValue([{ id: 1 }]);

    const result = await controller.getChildFeedback(5, {
      sub: 2,
    } as unknown as AuthedRequest['user']);
    expect(result.code).toBe(0);
    expect(service.getChildFeedback).toHaveBeenCalledWith(2, 5);
  });

  it('GET /students/my-children/:childId - getChildForParent', async () => {
    service.getChildForParent.mockResolvedValue(mockStudent);

    const result = await controller.getChildForParent(5, {
      sub: 2,
    } as unknown as AuthedRequest['user']);
    expect(result.code).toBe(0);
    expect(result.data).toEqual(mockStudent);
    expect(service.getChildForParent).toHaveBeenCalledWith(2, 5);
  });

  it('PUT /students/my-children/:childId - updateChild', async () => {
    const dto = { name: '小红', grade: '二年级' };
    service.updateChild.mockResolvedValue({ ...mockStudent, name: '小红' });

    const result = await controller.updateChild(
      5,
      dto as unknown as ParentUpdateStudentDto,
      { sub: 2 } as unknown as AuthedRequest['user'],
    );
    expect(result.code).toBe(0);
    expect(result.message).toBe('保存成功');
    expect(service.updateChild).toHaveBeenCalledWith(2, 5, dto);
  });

  it('DELETE /students/my-children/:childId - unlinkChild', async () => {
    const result = await controller.unlinkChild(5, {
      sub: 2,
    } as unknown as AuthedRequest['user']);
    expect(result.code).toBe(0);
    expect(result.data).toBeNull();
    expect(service.unlinkChild).toHaveBeenCalledWith(2, 5);
  });

  it('GET /students/:childId/points-mall/products - verifies binding then lists products', async () => {
    service.getChildForParent.mockResolvedValue(mockStudent);
    mockPointsService.listOnSaleProducts.mockResolvedValue([
      { id: 7, name: '铅笔盒' },
    ]);

    const result = await controller.getChildPointsMallProducts(5, {
      sub: 2,
    } as unknown as AuthedRequest['user']);
    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(service.getChildForParent).toHaveBeenCalledWith(2, 5);
    expect(mockPointsService.listOnSaleProducts).toHaveBeenCalled();
  });

  it('POST /students/:childId/points-mall/exchange - exchanges with child info', async () => {
    service.getChildForParent.mockResolvedValue(mockStudent);
    mockPointsService.exchange.mockResolvedValue({ id: 99 });

    const result = await controller.exchangeChildPoints(
      5,
      { productId: 7, quantity: 2 },
      { sub: 2 } as unknown as AuthedRequest['user'],
    );
    expect(result.code).toBe(0);
    expect(result.data).toEqual({ id: 99 });
    expect(service.getChildForParent).toHaveBeenCalledWith(2, 5);
    expect(mockPointsService.exchange).toHaveBeenCalledWith(
      'STU20240001',
      '张三',
      7,
      2,
      2,
    );
  });

  it('POST /students/:childId/points-mall/exchange - 400 without productId', async () => {
    service.getChildForParent.mockResolvedValue(mockStudent);

    const result = await controller.exchangeChildPoints(
      5,
      {},
      { sub: 2 } as unknown as AuthedRequest['user'],
    );
    expect(result.code).toBe(400);
    expect(mockPointsService.exchange).not.toHaveBeenCalled();
  });
});
