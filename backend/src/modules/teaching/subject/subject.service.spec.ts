import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SubjectService } from './subject.service';
import { SubjectEntity } from './subject.entity';

describe('SubjectService', () => {
  let service: SubjectService;
  // jest.Mock 成员（参照 course.service.spec.ts），避免 unbound-method
  let repo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const makeSubject = (overrides: Partial<SubjectEntity>): SubjectEntity =>
    ({
      id: 1,
      code: 'MATH',
      name: '数学',
      category: 'ACADEMIC',
      isDefault: true,
      sortOrder: 1,
      createdBy: 1,
      deletedAt: null,
      ...overrides,
    }) as SubjectEntity;

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      save: jest.fn((e: Partial<SubjectEntity>) => Promise.resolve(e)),
      create: jest.fn((data: Partial<SubjectEntity>) => data),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectService,
        { provide: getRepositoryToken(SubjectEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(SubjectService);
    repo = module.get(getRepositoryToken(SubjectEntity));
  });

  /** Wire the createQueryBuilder chain to return a result for the code generator. */
  const setupQueryMock = (entity: SubjectEntity | null) => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(entity),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  };

  describe('findAll', () => {
    it('should order by sortOrder then code and exclude deleted', async () => {
      const qb = setupQueryMock(null);
      qb.getMany.mockResolvedValue([makeSubject({ code: 'MATH' }) as never]);

      const result = await service.findAll();

      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('s.deletedAt IS NULL');
      expect(qb.orderBy).toHaveBeenCalledWith('s.sortOrder', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('s.code', 'ASC');
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should return existing subject with same name (idempotent)', async () => {
      const existing = makeSubject({ code: 'SWIMMING', name: '游泳' });
      repo.findOne.mockResolvedValue(existing);

      const result = await service.create(
        { name: ' 游泳 ', category: 'SPORT' },
        5,
      );

      expect(result).toBe(existing);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should create custom subject with SUBJ0001 when no custom code exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const qb = setupQueryMock(null);
      repo.create.mockImplementation(
        (data: Partial<SubjectEntity>) => data as SubjectEntity,
      );
      repo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.create(
        { name: '编程思维', category: 'STEM' },
        5,
      );

      expect(qb.where).toHaveBeenCalledWith('s.code LIKE :prefix', {
        prefix: 'SUBJ%',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUBJ0001',
          name: '编程思维',
          category: 'STEM',
          isDefault: false,
          createdBy: 5,
        }),
      );
      expect(result.code).toBe('SUBJ0001');
    });

    it('should increment past the latest custom code', async () => {
      repo.findOne.mockResolvedValue(null);
      setupQueryMock(makeSubject({ code: 'SUBJ0005', isDefault: false }));

      const result = await service.create(
        { name: '思维导图', category: 'STEM' },
        5,
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SUBJ0006' }),
      );
      expect(result.code).toBe('SUBJ0006');
    });

    it('should include soft-deleted rows in the code space (no duplicate)', async () => {
      repo.findOne.mockResolvedValue(null);
      // 最高位是软删记录，仍应作为 max 参与计算
      setupQueryMock(
        makeSubject({
          code: 'SUBJ0003',
          isDefault: false,
          deletedAt: new Date(),
        }),
      );

      const result = await service.create(
        { name: '新学科', category: 'OTHER' },
        5,
      );

      expect(result.code).toBe('SUBJ0004');
    });
  });

  describe('remove', () => {
    it('should throw NotFound when code missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('SUBJ0001', 5, 'Teacher')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject deleting a default subject', async () => {
      repo.findOne.mockResolvedValue(
        makeSubject({ code: 'MATH', isDefault: true }),
      );
      await expect(service.remove('MATH', 1, 'Admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject Teacher deleting someone elses subject', async () => {
      repo.findOne.mockResolvedValue(
        makeSubject({ code: 'SUBJ0001', isDefault: false, createdBy: 99 }),
      );
      await expect(service.remove('SUBJ0001', 5, 'Teacher')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should soft-delete own custom subject', async () => {
      const subject = makeSubject({
        code: 'SUBJ0001',
        isDefault: false,
        createdBy: 5,
      });
      repo.findOne.mockResolvedValue(subject);
      repo.save.mockResolvedValue(subject);

      await service.remove('SUBJ0001', 5, 'Teacher');

      expect(subject.deletedAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
