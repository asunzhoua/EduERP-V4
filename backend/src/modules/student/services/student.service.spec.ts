import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentRepository } from '../student.repository';
import { Student } from '../entities/student.entity';
import { StudentParent } from '../entities/student-parent.entity';
import { StudentAuditLog } from '../entities/student-audit-log.entity';
import { StudentCodeGeneratorService } from './student-code-generator.service';
import { ImportService } from '@utils/services/import.service';
import { StudentStatus } from '../enums/student-status.enum';
import { CreatedSource } from '@common/enums/created-source.enum';
import { AuditAction } from '@common/enums/audit-action.enum';
import { ContractRepository } from '@modules/teaching/contract/contract.repository';
import { LessonAttendanceRepository } from '@modules/teaching/lesson-attendance/lesson-attendance.repository';
import { LeaveRequestEntity } from '@modules/teaching/leave-request/leave-request.entity';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { PointsService } from '@modules/points/points.service';
import { FeedbackService } from '@modules/feedback/feedback.service';

describe('StudentService', () => {
  let service: StudentService;
  let studentRepo: jest.Mocked<StudentRepository>;
  let studentParentRepo: jest.Mocked<any>;
  let studentAuditLogRepo: jest.Mocked<any>;
  let codeGenerator: jest.Mocked<StudentCodeGeneratorService>;
  let importService: jest.Mocked<ImportService>;
  let lessonAttendanceRepo: jest.Mocked<any>;
  let lessonRepo: jest.Mocked<any>;
  let classRepo: jest.Mocked<any>;
  let courseRepo: jest.Mocked<any>;
  let pointsService: jest.Mocked<any>;
  let feedbackService: jest.Mocked<any>;

  const mockStudent: Student = {
    id: 1,
    studentCode: 'STU2026070001',
    name: '张三',
    gender: 'MALE',
    birthDate: '2015-01-01',
    phone: '13800138000',
    email: null,
    school: null,
    grade: null,
    tags: null,
    note: null,
    status: StudentStatus.ACTIVE,
    createdBy: 1,
    createdSource: CreatedSource.API,
    updatedBy: 1,
    deleted: false,
    createTime: new Date(),
    updateTime: new Date(),
    version: 1,
  } as Student;

  beforeEach(async () => {
    const mockStudentRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    };

    const mockParentRepo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const mockAuditLogRepo = {
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockCodeGenerator = {
      generateStudentCode: jest.fn().mockResolvedValue('STU2026070001'),
    };

    const mockImportService = {
      parseBuffer: jest.fn(),
      validateRows: jest.fn(),
    };

    const mockContractRepo = {
      findByStudentCode: jest.fn().mockResolvedValue([]),
    };

    const mockAttendanceRepo = {
      findByStudentCode: jest.fn().mockResolvedValue([]),
    };

    const mockLeaveRequestRepo = {
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockEnrollmentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const mockCourseRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockLessonRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockClassRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockPointsService = {
      getSummary: jest.fn().mockResolvedValue({
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        transactions: [],
      }),
    };

    const mockFeedbackService = {
      findByStudentCode: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        { provide: StudentRepository, useValue: mockStudentRepo },
        {
          provide: getRepositoryToken(StudentParent),
          useValue: mockParentRepo,
        },
        {
          provide: getRepositoryToken(StudentAuditLog),
          useValue: mockAuditLogRepo,
        },
        { provide: StudentCodeGeneratorService, useValue: mockCodeGenerator },
        { provide: ImportService, useValue: mockImportService },
        { provide: ContractRepository, useValue: mockContractRepo },
        { provide: LessonAttendanceRepository, useValue: mockAttendanceRepo },
        {
          provide: getRepositoryToken(LeaveRequestEntity),
          useValue: mockLeaveRequestRepo,
        },
        {
          provide: getRepositoryToken(EnrollmentEntity),
          useValue: mockEnrollmentRepo,
        },
        { provide: getRepositoryToken(CourseEntity), useValue: mockCourseRepo },
        { provide: getRepositoryToken(LessonEntity), useValue: mockLessonRepo },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
        { provide: PointsService, useValue: mockPointsService },
        { provide: FeedbackService, useValue: mockFeedbackService },
      ],
    }).compile();

    service = module.get<StudentService>(StudentService);
    studentRepo = module.get(StudentRepository);
    studentParentRepo = module.get(getRepositoryToken(StudentParent));
    studentAuditLogRepo = module.get(getRepositoryToken(StudentAuditLog));
    codeGenerator = module.get(StudentCodeGeneratorService);
    importService = module.get(ImportService);
    lessonAttendanceRepo = module.get(LessonAttendanceRepository);
    lessonRepo = module.get(getRepositoryToken(LessonEntity));
    classRepo = module.get(getRepositoryToken(ClassEntity));
    courseRepo = module.get(getRepositoryToken(CourseEntity));
    pointsService = module.get(PointsService);
    feedbackService = module.get(FeedbackService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── create ───

  describe('create', () => {
    it('should create a student with auto-generated code', async () => {
      studentRepo.save.mockResolvedValue(mockStudent);

      const result = await service.create(
        { name: '张三', gender: 'MALE' as any, birthDate: '2015-01-01' },
        1,
      );

      expect(result).toEqual(mockStudent);
      expect(codeGenerator.generateStudentCode).toHaveBeenCalled();
      expect(studentRepo.save).toHaveBeenCalled();
    });
  });

  // ─── findAll ───

  describe('findAll', () => {
    it('should return paginated results', async () => {
      studentRepo.findAndCount.mockResolvedValue([[mockStudent], 1]);

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  // ─── findById ───

  describe('findById', () => {
    it('should return student by id', async () => {
      studentRepo.findById.mockResolvedValue(mockStudent);

      const result = await service.findById(1);

      expect(result).toEqual(mockStudent);
    });

    it('should throw NotFoundException when not found', async () => {
      studentRepo.findById.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───

  describe('update', () => {
    it('should update student fields', async () => {
      studentRepo.findById.mockResolvedValue(mockStudent);
      studentRepo.save.mockResolvedValue({
        ...mockStudent,
        name: '李四',
      });

      const result = await service.update(1, { name: '李四' }, 1);

      expect(result.name).toBe('李四');
      expect(studentRepo.save).toHaveBeenCalled();
    });
  });

  // ─── updateStatus ───

  describe('updateStatus', () => {
    it('should update status', async () => {
      studentRepo.findById.mockResolvedValue(mockStudent);
      studentRepo.save.mockResolvedValue({
        ...mockStudent,
        status: StudentStatus.PAUSED,
      });

      const result = await service.updateStatus(
        1,
        { status: StudentStatus.PAUSED },
        1,
      );

      expect(result.status).toBe(StudentStatus.PAUSED);
    });

    it('should throw when student is GRADUATED', async () => {
      studentRepo.findById.mockResolvedValue({
        ...mockStudent,
        status: StudentStatus.GRADUATED,
      });

      await expect(
        service.updateStatus(1, { status: StudentStatus.ACTIVE } as any, 1),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(1, { status: StudentStatus.ACTIVE } as any, 1),
      ).rejects.toThrow('已毕业');
    });
  });

  // ─── softDelete ───

  describe('softDelete', () => {
    it('should soft delete student', async () => {
      studentRepo.findById.mockResolvedValue(mockStudent);
      studentRepo.save.mockResolvedValue({
        ...mockStudent,
        deleted: true,
      });

      await service.softDelete(1, 1);

      expect(studentRepo.save).toHaveBeenCalled();
      const savedStudent = studentRepo.save.mock.calls[0][0];
      expect(savedStudent.deleted).toBe(true);
    });
  });

  // ─── getStudentLessons (shared self/child assembly) ───

  describe('getStudentLessons', () => {
    const att = [
      { id: 1, lessonId: 10, studentCode: 'STU2026070001', status: 'PRESENT' },
      { id: 2, lessonId: 11, studentCode: 'STU2026070001', status: 'ABSENT' },
      { id: 3, lessonId: 12, studentCode: 'STU2026070001', status: 'LATE' },
    ];
    const lessons = [
      {
        id: 10,
        classCode: 'CL1',
        courseCode: 'C1',
        scheduledDate: '2026-08-05',
        startTime: '09:00',
        endTime: '10:00',
      },
      {
        id: 11,
        classCode: 'CL1',
        courseCode: 'C1',
        scheduledDate: '2026-08-07',
        startTime: '09:00',
        endTime: '10:00',
      },
      {
        id: 12,
        classCode: 'CL1',
        courseCode: 'C1',
        scheduledDate: '2026-08-10',
        startTime: '09:00',
        endTime: '10:00',
      },
    ];

    it('returns records sorted by date desc with class/course names', async () => {
      lessonAttendanceRepo.findByStudentCode.mockResolvedValue(att);
      lessonRepo.find.mockResolvedValue(lessons);
      classRepo.find.mockResolvedValue([{ classCode: 'CL1', name: '一班' }]);
      courseRepo.find.mockResolvedValue([{ courseCode: 'C1', name: '数学' }]);

      const result = await service.getStudentLessons('STU2026070001');
      expect(result).toHaveLength(3);
      expect(result[0].lessonDate).toBe('2026-08-10');
      expect(result[2].lessonDate).toBe('2026-08-05');
      expect(result[0].className).toBe('一班');
      expect(result[0].courseName).toBe('数学');
    });

    it('filters by from/to date range', async () => {
      lessonAttendanceRepo.findByStudentCode.mockResolvedValue(att);
      lessonRepo.find.mockResolvedValue(lessons);
      classRepo.find.mockResolvedValue([{ classCode: 'CL1', name: '一班' }]);
      courseRepo.find.mockResolvedValue([{ courseCode: 'C1', name: '数学' }]);

      const result = await service.getStudentLessons(
        'STU2026070001',
        '2026-08-01',
        '2026-08-08',
      );
      expect(result).toHaveLength(2);
      expect(result[0].lessonDate).toBe('2026-08-07');
      expect(result[1].lessonDate).toBe('2026-08-05');
    });
  });

  // ─── child-scoped endpoints (assertParentChild) ───

  describe('child-scoped', () => {
    beforeEach(() => {
      studentParentRepo.findOne.mockResolvedValue({
        id: 1,
        parentId: 1,
        studentId: 2,
      });
      studentRepo.findById.mockResolvedValue({ ...mockStudent, id: 2 });
    });

    it('getChildLessons delegates to getStudentLessons with child code', async () => {
      lessonAttendanceRepo.findByStudentCode.mockResolvedValue([]);
      const result = await service.getChildLessons(1, 2);
      expect(result).toEqual([]);
      expect(lessonAttendanceRepo.findByStudentCode).toHaveBeenCalledWith(
        'STU2026070001',
      );
    });

    it('getChildPoints delegates to points service', async () => {
      pointsService.getSummary.mockResolvedValue({ balance: 50 });
      const result = await service.getChildPoints(1, 2);
      expect(result).toEqual({ balance: 50 });
      expect(pointsService.getSummary).toHaveBeenCalledWith('STU2026070001');
    });

    it('getChildFeedback delegates to feedback service', async () => {
      feedbackService.findByStudentCode.mockResolvedValue([{ id: 1 }]);
      const result = await service.getChildFeedback(1, 2);
      expect(result).toEqual([{ id: 1 }]);
      expect(feedbackService.findByStudentCode).toHaveBeenCalledWith(
        'STU2026070001',
      );
    });

    it('throws ForbiddenException when no parent-child relationship', async () => {
      studentParentRepo.findOne.mockResolvedValue(null);
      await expect(service.getChildLessons(1, 2)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getChildPoints(1, 2)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getChildFeedback(1, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
