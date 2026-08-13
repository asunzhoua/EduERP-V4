import { Test, TestingModule } from '@nestjs/testing';
import {
  EnrollmentService,
  EnrollInput,
  VALID_ENROLLMENT_TRANSITIONS,
} from './enrollment.service';
import { EnrollmentRepository } from './enrollment.repository';
import { ContractRepository } from '../contract/contract.repository';
import { EnrollmentEntity } from './enrollment.entity';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { ContractEntity } from '../contract/contract.entity';
import { ContractStatus } from '../contract/enums/contract-status.enum';
import { StudentRepository } from '../../student/student.repository';
import { Subject } from '@common/enums/subject.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClassEntity } from '../class/class.entity';
import { ClassStatus } from '../class/enums/class-status.enum';
import { CourseEntity } from '../course/course.entity';
import { LessonEntity } from '../lesson/lesson.entity';
import { EntityManager } from 'typeorm';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let enrollmentRepo: {
    save: jest.Mock;
    findOneById: jest.Mock;
    findByClassCode: jest.Mock;
    findByStudentCode: jest.Mock;
    findByClassAndStudent: jest.Mock;
    countActiveByClassCode: jest.Mock;
    findActiveByStudentCode: jest.Mock;
    findMany: jest.Mock;
  };
  let studentRepo: {
    raw: { find: jest.Mock; createQueryBuilder: jest.Mock };
  };
  let contractRepo: {
    save: jest.Mock;
    findOneById: jest.Mock;
    findOneByCode: jest.Mock;
    findByStudentCode: jest.Mock;
    countByStudentCode: jest.Mock;
    findActiveByStudentCodeIn: jest.Mock;
  };
  type MockClassRepo = { find: jest.Mock; findOne: jest.Mock };
  type MockCourseRepo = { find: jest.Mock };
  type MockLessonRepo = { createQueryBuilder: jest.Mock };
  let classRepo: MockClassRepo;
  let courseRepo: MockCourseRepo;
  let lessonRepo: MockLessonRepo;
  let emRepoMock: { count: jest.Mock; save: jest.Mock };

  const mockEnrollInput: EnrollInput = {
    classCode: 'CL2026070001',
    studentCode: 'ST2026010001',
    contractCode: 'CT2026070001',
    operatedBy: 42,
  };

  const mockEnrollment: EnrollmentEntity = {
    id: 1,
    classCode: 'CL2026070001',
    studentCode: 'ST2026010001',
    contractCode: 'CT2026070001',
    status: EnrollmentStatus.ACTIVE,
    withdrawReason: null,
    enrolledBy: 0,
    enrolledAt: new Date(),
  };

  const mockClass = {
    id: 1,
    classCode: 'CL2026070002',
    name: '目标班级',
    status: ClassStatus.ACTIVE,
    maxStudents: 20,
    deleted: false,
  };

  const mockActiveContract: ContractEntity = {
    id: 1,
    contractCode: 'CT2026070001',
    studentCode: 'ST2026010001',
    subject: Subject.MATH,
    totalLessons: 20,
    remainingLessons: 20,
    status: ContractStatus.ACTIVE,
    validFrom: '2026-07-01',
    validTo: '2026-12-31',
    unitPrice: 80,
    totalAmount: 1600,
    note: null,
    tags: null,
    createdBy: 0,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    emRepoMock = {
      count: jest.fn(),
      save: jest.fn(),
    };
    emRepoMock.save.mockImplementation((e: any) => Promise.resolve(e));

    const mockEnrollmentRepo = {
      save: jest.fn(),
      findOneById: jest.fn(),
      findByClassCode: jest.fn(),
      findByStudentCode: jest.fn(),
      findByClassAndStudent: jest.fn(),
      countActiveByClassCode: jest.fn(),
      findActiveByStudentCode: jest.fn(),
      findMany: jest.fn(),
      inTransaction: jest.fn((fn: (em: EntityManager) => Promise<unknown>) =>
        fn({ getRepository: () => emRepoMock } as unknown as EntityManager),
      ),
    };

    const mockContractRepo = {
      save: jest.fn(),
      findOneById: jest.fn(),
      findOneByCode: jest.fn(),
      findByStudentCode: jest.fn(),
      countByStudentCode: jest.fn(),
      findActiveByStudentCodeIn: jest.fn(),
    };

    const mockStudentRepo = {
      raw: {
        find: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
      save: jest.fn(),
      findById: jest.fn(),
      findByStudentCode: jest.fn(),
      findAndCount: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    };

    const mockClassRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockCourseRepo = {
      find: jest.fn(),
    };

    const mockLessonRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentService,
        { provide: EnrollmentRepository, useValue: mockEnrollmentRepo },
        { provide: ContractRepository, useValue: mockContractRepo },
        { provide: StudentRepository, useValue: mockStudentRepo },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
        { provide: getRepositoryToken(CourseEntity), useValue: mockCourseRepo },
        { provide: getRepositoryToken(LessonEntity), useValue: mockLessonRepo },
      ],
    }).compile();

    service = module.get<EnrollmentService>(EnrollmentService);
    enrollmentRepo = module.get(EnrollmentRepository);
    contractRepo = module.get(ContractRepository);
    studentRepo = module.get(StudentRepository);
    classRepo = module.get<MockClassRepo>(getRepositoryToken(ClassEntity));
    courseRepo = module.get<MockCourseRepo>(getRepositoryToken(CourseEntity));
    lessonRepo = module.get<MockLessonRepo>(getRepositoryToken(LessonEntity));
  });

  // ─── Enroll ───

  describe('enroll', () => {
    beforeEach(() => {
      // 目标班级存在且 ACTIVE，容量未满，学生无排班冲突
      classRepo.findOne.mockResolvedValue({ ...mockClass });
      enrollmentRepo.countActiveByClassCode.mockResolvedValue(0);
      enrollmentRepo.findActiveByStudentCode.mockResolvedValue([]);
    });

    it('should create enrollment with ACTIVE status', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(null);
      enrollmentRepo.save.mockResolvedValue({
        ...mockEnrollment,
        enrolledBy: 42,
      });

      const result = await service.enroll(mockEnrollInput);

      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
      expect(result.classCode).toBe('CL2026070001');
      expect(result.studentCode).toBe('ST2026010001');
      expect(result.contractCode).toBe('CT2026070001');
      expect(result.enrolledBy).toBe(42);
    });

    it('should create enrollment without contract (contractCode optional)', async () => {
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(null);
      enrollmentRepo.save.mockResolvedValue({ ...mockEnrollment });

      const result = await service.enroll({
        classCode: 'CL2026070001',
        studentCode: 'ST2026010001',
        contractCode: undefined,
        operatedBy: 42,
      });

      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
      expect(contractRepo.findOneByCode).not.toHaveBeenCalled();
    });
    it('should reject when contract not found', async () => {
      contractRepo.findOneByCode.mockResolvedValue(null);

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when contract is not ACTIVE', async () => {
      const frozenContract = {
        ...mockActiveContract,
        status: ContractStatus.FROZEN,
      };
      contractRepo.findOneByCode.mockResolvedValue(frozenContract);

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject duplicate ACTIVE enrollment', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      enrollmentRepo.findByClassAndStudent.mockResolvedValue({
        ...mockEnrollment,
      });

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow re-enrollment after withdrawal', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      const withdrawn = {
        ...mockEnrollment,
        status: EnrollmentStatus.WITHDRAWN,
      };
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(withdrawn);
      enrollmentRepo.save.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.ACTIVE,
      });

      const result = await service.enroll(mockEnrollInput);
      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
    });

    it('should reject when target class does not exist', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(null);
      classRepo.findOne.mockResolvedValue(null);

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when target class is not ACTIVE', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(null);
      classRepo.findOne.mockResolvedValue({
        ...mockClass,
        status: ClassStatus.DRAFT,
      });

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when class is full', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(null);
      enrollmentRepo.countActiveByClassCode.mockResolvedValue(20);

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(/已满/);
    });

    it('should reject when student has schedule conflict with another class', async () => {
      contractRepo.findOneByCode.mockResolvedValue({ ...mockActiveContract });
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(null);
      enrollmentRepo.findActiveByStudentCode.mockResolvedValue([
        { id: 9, classCode: 'CL2026070002', status: EnrollmentStatus.ACTIVE },
      ]);
      // 目标班级有上课时间
      classRepo.findOne.mockResolvedValue({
        ...mockClass,
        classCode: 'CL2026070001',
        dayOfWeek: [1],
        startTime: '09:00',
        endTime: '10:00',
      });
      // 冲突班级：同星期、时段重叠
      classRepo.find.mockResolvedValue([
        {
          classCode: 'CL2026070002',
          name: '冲突班级',
          dayOfWeek: [1],
          startTime: '09:30',
          endTime: '10:30',
        },
      ]);

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        /学生排班冲突/,
      );
    });
  });

  // ─── Read ───

  describe('findOne', () => {
    it('should return enrollment when found', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException when not found', async () => {
      enrollmentRepo.findOneById.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByClassCode', () => {
    it('should return enrollments for a class', async () => {
      enrollmentRepo.findByClassCode.mockResolvedValue([
        { ...mockEnrollment },
        { ...mockEnrollment, id: 2, studentCode: 'ST2026010002' },
      ]);
      const result = await service.findByClassCode('CL2026070001');
      expect(result).toHaveLength(2);
    });
  });

  describe('findByStudentCode', () => {
    it('should return enrollments for a student', async () => {
      enrollmentRepo.findByStudentCode.mockResolvedValue([
        { ...mockEnrollment },
      ]);

      // Mock classRepo.find to return a class with courseCode
      classRepo.find.mockResolvedValue([
        {
          classCode: 'CL2026070001',
          courseCode: 'CS2026070001',
          name: '数学思维训练班',
          totalLessons: 24,
        },
      ]);

      // Mock courseRepo.find to return a course
      courseRepo.find.mockResolvedValue([
        {
          courseCode: 'CS2026070001',
          name: '数学思维训练',
        },
      ]);

      // Mock lessonRepo.createQueryBuilder chain
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            classCode: 'CL2026070001',
            count: '10',
          },
        ]),
      };
      lessonRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = (await service.findByStudentCode(
        'ST2026010001',
      )) as unknown as Array<{
        className: string;
        courseName: string;
        completedLessons: number;
        totalLessons: number;
      }>;
      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('数学思维训练班');
      expect(result[0].courseName).toBe('数学思维训练');
      expect(result[0].completedLessons).toBe(10);
      expect(result[0].totalLessons).toBe(24);
    });
  });

  // ─── findAll ───

  describe('findAll', () => {
    it('should return paginated enrollments', async () => {
      enrollmentRepo.findMany.mockResolvedValue({
        items: [{ ...mockEnrollment }],
        total: 1,
      });
      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(enrollmentRepo.findMany).toHaveBeenCalledWith({
        classCode: undefined,
        studentCode: undefined,
        status: undefined,
        page: 1,
        pageSize: 20,
      });
    });

    it('should default page=1 pageSize=20 when not provided', async () => {
      enrollmentRepo.findMany.mockResolvedValue({ items: [], total: 0 });
      await service.findAll({});
      expect(enrollmentRepo.findMany).toHaveBeenCalledWith({
        classCode: undefined,
        studentCode: undefined,
        status: undefined,
        page: 1,
        pageSize: 20,
      });
    });
  });

  // ─── findCandidates ───

  describe('findCandidates', () => {
    const mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      studentRepo.raw.createQueryBuilder.mockReturnValue(mockQb);
      mockQb.getMany.mockResolvedValue([
        {
          studentCode: 'ST2026010001',
          name: '小明',
          gender: '男',
          phone: '13800000001',
          school: '一小',
          grade: '一年级',
        },
      ]);
      contractRepo.findActiveByStudentCodeIn.mockResolvedValue([
        { ...mockActiveContract },
      ]);
    });

    it('should build teacher-scoped query and attach active contracts', async () => {
      const result = (await service.findCandidates({
        teacherId: 2,
        classCode: 'CL2026070001',
        keyword: '小明',
      })) as unknown as Array<{
        studentCode: string;
        contracts: Array<{ contractCode: string }>;
      }>;

      expect(mockQb.andWhere).toHaveBeenCalled();
      const calls = mockQb.andWhere.mock.calls as Array<[string, unknown]>;
      expect(calls[0][0]).toContain('teacher_assignment');
      expect(result).toHaveLength(1);
      expect(result[0].contracts).toHaveLength(1);
      expect(result[0].contracts[0].contractCode).toBe('CT2026070001');
    });

    it('should return empty candidates when no students', async () => {
      mockQb.getMany.mockResolvedValue([]);

      const result = (await service.findCandidates({
        teacherId: 2,
        classCode: 'CL2026070001',
      })) as unknown as Array<{
        studentCode: string;
        contracts: Array<{ contractCode: string }>;
      }>;

      expect(result).toEqual([]);
      expect(contractRepo.findActiveByStudentCodeIn).not.toHaveBeenCalled();
    });
  });

  // ─── Withdraw ───

  describe('withdraw', () => {
    it('should allow ACTIVE -> WITHDRAWN with reason', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });
      enrollmentRepo.save.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.WITHDRAWN,
        withdrawReason: '转到其他机构',
      });

      const result = await service.withdraw(1, '转到其他机构', 1);
      expect(result.status).toBe(EnrollmentStatus.WITHDRAWN);
      expect(result.withdrawReason).toBe('转到其他机构');
    });

    it('should block withdrawal of non-ACTIVE enrollment', async () => {
      const withdrawn = {
        ...mockEnrollment,
        status: EnrollmentStatus.WITHDRAWN,
      };
      enrollmentRepo.findOneById.mockResolvedValue(withdrawn);

      await expect(service.withdraw(1, 'reason', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block withdrawal without reason', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });

      await expect(service.withdraw(1, '', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block withdrawal with empty reason', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });

      await expect(service.withdraw(1, '  ', 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Suspend ───

  describe('suspend', () => {
    it('should allow ACTIVE -> SUSPEND with reason', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });
      enrollmentRepo.save.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.SUSPEND,
        withdrawReason: '因事请假一个月',
      });

      const result = await service.suspend(1, '因事请假一个月', 1);
      expect(result.status).toBe(EnrollmentStatus.SUSPEND);
      expect(result.withdrawReason).toBe('因事请假一个月');
    });

    it('should block suspension without reason', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });

      await expect(service.suspend(1, '', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block suspension with empty reason', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });

      await expect(service.suspend(1, '  ', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block suspension of non-ACTIVE enrollment', async () => {
      const suspended = {
        ...mockEnrollment,
        status: EnrollmentStatus.SUSPEND,
      };
      enrollmentRepo.findOneById.mockResolvedValue(suspended);

      await expect(service.suspend(1, 'reason', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block suspension of WITHDRAWN enrollment', async () => {
      const withdrawn = {
        ...mockEnrollment,
        status: EnrollmentStatus.WITHDRAWN,
      };
      enrollmentRepo.findOneById.mockResolvedValue(withdrawn);

      await expect(service.suspend(1, 'reason', 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Resume ───

  describe('resume', () => {
    it('should allow SUSPEND -> ACTIVE', async () => {
      const suspended = {
        ...mockEnrollment,
        status: EnrollmentStatus.SUSPEND,
        withdrawReason: '因事请假',
      };
      enrollmentRepo.findOneById.mockResolvedValue(suspended);
      enrollmentRepo.save.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.ACTIVE,
        withdrawReason: null,
      });

      const result = await service.resume(1, 1);
      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
      expect(result.withdrawReason).toBeNull();
    });

    it('should block resume of ACTIVE enrollment', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });

      await expect(service.resume(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('should block resume of WITHDRAWN enrollment', async () => {
      const withdrawn = {
        ...mockEnrollment,
        status: EnrollmentStatus.WITHDRAWN,
      };
      enrollmentRepo.findOneById.mockResolvedValue(withdrawn);

      await expect(service.resume(1, 1)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── State Transition Table ───

  describe('VALID_ENROLLMENT_TRANSITIONS', () => {
    it('should have transitions for all 4 statuses', () => {
      expect(Object.keys(VALID_ENROLLMENT_TRANSITIONS)).toHaveLength(4);
    });

    it('ACTIVE should transition to WITHDRAWN and SUSPEND', () => {
      expect(VALID_ENROLLMENT_TRANSITIONS[EnrollmentStatus.ACTIVE]).toEqual([
        EnrollmentStatus.WITHDRAWN,
        EnrollmentStatus.SUSPEND,
      ]);
    });

    it('WITHDRAWN should be terminal', () => {
      expect(VALID_ENROLLMENT_TRANSITIONS[EnrollmentStatus.WITHDRAWN]).toEqual(
        [],
      );
    });

    it('SUSPEND should transition to ACTIVE only', () => {
      expect(VALID_ENROLLMENT_TRANSITIONS[EnrollmentStatus.SUSPEND]).toEqual([
        EnrollmentStatus.ACTIVE,
      ]);
    });

    it('COMPLETED should be terminal (not activated)', () => {
      expect(VALID_ENROLLMENT_TRANSITIONS[EnrollmentStatus.COMPLETED]).toEqual(
        [],
      );
    });
  });

  // ─── Contract Ownership Validation ───

  describe('Contract ownership validation', () => {
    it('should reject when contract belongs to different student', async () => {
      const otherStudentContract = {
        ...mockActiveContract,
        studentCode: 'ST9999999999',
      };
      contractRepo.findOneByCode.mockResolvedValue(otherStudentContract);

      await expect(service.enroll(mockEnrollInput)).rejects.toThrow(
        'does not belong to student',
      );
    });
  });

  // ─── Transfer (调班) ───

  describe('transfer', () => {
    beforeEach(() => {
      enrollmentRepo.findOneById.mockResolvedValue({ ...mockEnrollment });
      classRepo.findOne.mockResolvedValue({ ...mockClass });
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(null);
      emRepoMock.count.mockResolvedValue(10);
    });

    it('should withdraw source and enroll target with same contract', async () => {
      const result = await service.transfer(1, 'CL2026070002', undefined, 9);

      expect(emRepoMock.save).toHaveBeenCalledTimes(2);

      // Source marked withdrawn
      expect(result.source.status).toBe(EnrollmentStatus.WITHDRAWN);
      expect(result.source.withdrawReason).toBe('调班至 CL2026070002');
      expect(result.source.classCode).toBe('CL2026070001');

      // Target created with source's contract carried over
      expect(result.target.classCode).toBe('CL2026070002');
      expect(result.target.contractCode).toBe('CT2026070001');
      expect(result.target.status).toBe(EnrollmentStatus.ACTIVE);
      expect(result.target.enrolledBy).toBe(9);

      // Capacity check ran inside the transaction with the correct filter
      expect(emRepoMock.count).toHaveBeenCalledWith({
        where: {
          classCode: 'CL2026070002',
          status: EnrollmentStatus.ACTIVE,
        },
      });
    });

    it('should use custom reason as withdrawReason', async () => {
      const result = await service.transfer(
        1,
        'CL2026070002',
        '家长要求换班',
        9,
      );
      expect(result.source.withdrawReason).toBe('家长要求换班');
    });

    it('should throw NotFoundException when source not found', async () => {
      enrollmentRepo.findOneById.mockResolvedValue(null);

      await expect(
        service.transfer(1, 'CL2026070002', undefined, 9),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when source is not ACTIVE', async () => {
      enrollmentRepo.findOneById.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.WITHDRAWN,
      });

      await expect(
        service.transfer(1, 'CL2026070002', undefined, 9),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when target is the same class', async () => {
      await expect(
        service.transfer(1, 'CL2026070001', undefined, 9),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when target class not found', async () => {
      classRepo.findOne.mockResolvedValue(null);

      await expect(
        service.transfer(1, 'CL2026070002', undefined, 9),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when target class is not ACTIVE', async () => {
      classRepo.findOne.mockResolvedValue({
        ...mockClass,
        status: ClassStatus.DRAFT,
      });

      await expect(
        service.transfer(1, 'CL2026070002', undefined, 9),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when target class is full and not save', async () => {
      emRepoMock.count.mockResolvedValue(20);

      await expect(
        service.transfer(1, 'CL2026070002', undefined, 9),
      ).rejects.toThrow(BadRequestException);
      expect(emRepoMock.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when student already ACTIVE in target', async () => {
      enrollmentRepo.findByClassAndStudent.mockResolvedValue({
        ...mockEnrollment,
        id: 5,
        classCode: 'CL2026070002',
      });

      await expect(
        service.transfer(1, 'CL2026070002', undefined, 9),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reuse existing WITHDRAWN target enrollment', async () => {
      const withdrawnTarget = {
        ...mockEnrollment,
        id: 99,
        classCode: 'CL2026070002',
        status: EnrollmentStatus.WITHDRAWN,
      };
      enrollmentRepo.findByClassAndStudent.mockResolvedValue(withdrawnTarget);

      const result = await service.transfer(1, 'CL2026070002', undefined, 9);

      expect(result.target.id).toBe(99);
      expect(result.target.status).toBe(EnrollmentStatus.ACTIVE);
      expect(emRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 99,
          status: EnrollmentStatus.ACTIVE,
        }),
      );
    });
  });
});
