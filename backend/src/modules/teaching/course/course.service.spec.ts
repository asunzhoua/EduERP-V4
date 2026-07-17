import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { CourseService } from './course.service';
import { CourseRepository } from './course.repository';
import { CourseCodeGeneratorService } from './course-code-generator.service';
import { CourseEntity } from './course.entity';
import { CourseAuditLog } from './course-audit-log.entity';
import { CourseStatus } from './enums/course-status.enum';
import { Subject } from '@common/enums/subject.enum';
import { CourseType } from './enums/course-type.enum';
import { AuditAction } from '@common/enums/audit-action.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CourseService', () => {
  let service: CourseService;
  let courseRepo: jest.Mocked<CourseRepository>;
  let codeGenerator: jest.Mocked<CourseCodeGeneratorService>;
  let auditLogRepo: jest.Mocked<Repository<CourseAuditLog>>;

  const mockCourse: CourseEntity = {
    id: 1,
    courseCode: 'CS2026070001',
    name: '少儿英语一级',
    subject: Subject.ENGLISH,
    type: CourseType.GROUP,
    description: null,
    totalHours: 40,
    totalLessons: 40,
    defaultDuration: 60,
    status: CourseStatus.DRAFT,
    tags: null,
    coverImage: null,
    note: null,
    createdBy: 1,
    createTime: new Date(),
    updatedBy: null,
    updateTime: new Date(),
    version: 1,
    deleted: false,
  };

  beforeEach(async () => {
    const mockCourseRepo = {
      raw: {
        create: jest.fn(),
        find: jest.fn(),
      },
      save: jest.fn(),
      findOneByCode: jest.fn(),
      findMany: jest.fn(),
    };

    const mockCodeGenerator = {
      generateCourseCode: jest.fn(),
    };

    const mockAuditLogRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseService,
        { provide: CourseRepository, useValue: mockCourseRepo },
        { provide: CourseCodeGeneratorService, useValue: mockCodeGenerator },
        { provide: getRepositoryToken(CourseAuditLog), useValue: mockAuditLogRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<CourseService>(CourseService);
    courseRepo = module.get(CourseRepository);
    codeGenerator = module.get(CourseCodeGeneratorService);
    auditLogRepo = module.get(getRepositoryToken(CourseAuditLog));
  });

  // ─── Create ───

  describe('create', () => {
    it('should create a course with DRAFT status and auto-generated code', async () => {
      codeGenerator.generateCourseCode.mockResolvedValue('CS2026070001');
      (courseRepo.raw.create as jest.Mock).mockReturnValue({ ...mockCourse });
      courseRepo.save.mockResolvedValue({ ...mockCourse });
      auditLogRepo.create.mockReturnValue({} as CourseAuditLog);
      auditLogRepo.save.mockResolvedValue({} as CourseAuditLog);

      const result = await service.create(
        {
          name: '少儿英语一级',
          subject: Subject.ENGLISH,
          type: CourseType.GROUP,
          totalHours: 40,
          totalLessons: 40,
          defaultDuration: 60,
        },
        1,
      );

      expect(result.courseCode).toBe('CS2026070001');
      expect(result.status).toBe(CourseStatus.DRAFT);
      expect(codeGenerator.generateCourseCode).toHaveBeenCalled();
    });
  });

  // ─── Find ───

  describe('findByCode', () => {
    it('should return a course when found', async () => {
      courseRepo.findOneByCode.mockResolvedValue({ ...mockCourse });

      const result = await service.findByCode('CS2026070001');
      expect(result.courseCode).toBe('CS2026070001');
    });

    it('should throw NotFoundException when not found', async () => {
      courseRepo.findOneByCode.mockResolvedValue(null);

      await expect(service.findByCode('CS0000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Status Transitions ───

  describe('updateStatus', () => {
    it('should allow DRAFT -> PUBLISHED', async () => {
      const draft = { ...mockCourse, status: CourseStatus.DRAFT };
      courseRepo.findOneByCode.mockResolvedValue(draft);
      courseRepo.save.mockResolvedValue({ ...draft, status: CourseStatus.PUBLISHED });
      auditLogRepo.create.mockReturnValue({} as CourseAuditLog);
      auditLogRepo.save.mockResolvedValue({} as CourseAuditLog);

      const result = await service.updateStatus(
        'CS2026070001',
        CourseStatus.PUBLISHED,
        1,
      );
      expect(result.status).toBe(CourseStatus.PUBLISHED);
    });

    it('should allow PUBLISHED -> ARCHIVED', async () => {
      const published = { ...mockCourse, status: CourseStatus.PUBLISHED };
      courseRepo.findOneByCode.mockResolvedValue(published);
      courseRepo.save.mockResolvedValue({
        ...published,
        status: CourseStatus.ARCHIVED,
      });
      auditLogRepo.create.mockReturnValue({} as CourseAuditLog);
      auditLogRepo.save.mockResolvedValue({} as CourseAuditLog);

      const result = await service.updateStatus(
        'CS2026070001',
        CourseStatus.ARCHIVED,
        1,
      );
      expect(result.status).toBe(CourseStatus.ARCHIVED);
    });

    it('should allow ARCHIVED -> PUBLISHED (ARCHIVED is NOT terminal)', async () => {
      const archived = { ...mockCourse, status: CourseStatus.ARCHIVED };
      courseRepo.findOneByCode.mockResolvedValue(archived);
      courseRepo.save.mockResolvedValue({
        ...archived,
        status: CourseStatus.PUBLISHED,
      });
      auditLogRepo.create.mockReturnValue({} as CourseAuditLog);
      auditLogRepo.save.mockResolvedValue({} as CourseAuditLog);

      const result = await service.updateStatus(
        'CS2026070001',
        CourseStatus.PUBLISHED,
        1,
      );
      expect(result.status).toBe(CourseStatus.PUBLISHED);
    });

    it('should block DRAFT -> ARCHIVED (not a valid transition)', async () => {
      const draft = { ...mockCourse, status: CourseStatus.DRAFT };
      courseRepo.findOneByCode.mockResolvedValue(draft);

      await expect(
        service.updateStatus('CS2026070001', CourseStatus.ARCHIVED, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block ARCHIVED -> DRAFT (not a valid transition)', async () => {
      const archived = { ...mockCourse, status: CourseStatus.ARCHIVED };
      courseRepo.findOneByCode.mockResolvedValue(archived);

      await expect(
        service.updateStatus('CS2026070001', CourseStatus.DRAFT, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block same-status transition', async () => {
      const draft = { ...mockCourse, status: CourseStatus.DRAFT };
      courseRepo.findOneByCode.mockResolvedValue(draft);

      await expect(
        service.updateStatus('CS2026070001', CourseStatus.DRAFT, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Soft Delete ───

  describe('remove', () => {
    it('should soft delete a DRAFT course', async () => {
      const draft = { ...mockCourse, status: CourseStatus.DRAFT };
      courseRepo.findOneByCode.mockResolvedValue(draft);
      courseRepo.save.mockResolvedValue({ ...draft, deleted: true });
      auditLogRepo.create.mockReturnValue({} as CourseAuditLog);
      auditLogRepo.save.mockResolvedValue({} as CourseAuditLog);

      await service.remove('CS2026070001', 1);
      expect(courseRepo.save).toHaveBeenCalled();
    });

    it('should reject soft delete of PUBLISHED course', async () => {
      const published = { ...mockCourse, status: CourseStatus.PUBLISHED };
      courseRepo.findOneByCode.mockResolvedValue(published);

      await expect(service.remove('CS2026070001', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject soft delete of ARCHIVED course', async () => {
      const archived = { ...mockCourse, status: CourseStatus.ARCHIVED };
      courseRepo.findOneByCode.mockResolvedValue(archived);

      await expect(service.remove('CS2026070001', 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Update ───

  describe('update', () => {
    it('should update fields and create audit logs', async () => {
      const draft = { ...mockCourse };
      courseRepo.findOneByCode.mockResolvedValue(draft);
      courseRepo.save.mockResolvedValue({
        ...draft,
        name: 'Updated Name',
      });
      auditLogRepo.create.mockReturnValue({} as CourseAuditLog);
      auditLogRepo.save.mockResolvedValue({} as CourseAuditLog);

      const result = await service.update(
        'CS2026070001',
        { name: 'Updated Name' },
        1,
      );
      expect(result.name).toBe('Updated Name');
      expect(auditLogRepo.save).toHaveBeenCalled();
    });
  });
});
