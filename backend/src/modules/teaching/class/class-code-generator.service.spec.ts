import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassCodeGeneratorService } from './class-code-generator.service';
import { ClassEntity } from './class.entity';

describe('ClassCodeGeneratorService', () => {
  let service: ClassCodeGeneratorService;
  let classRepo: jest.Mocked<Repository<ClassEntity>>;

  /** Build the expected prefix for a given Date (CL{year}{month}) */
  const prefix = (d: Date) =>
    `CL${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  beforeEach(async () => {
    const mockRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassCodeGeneratorService,
        { provide: getRepositoryToken(ClassEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(ClassCodeGeneratorService);
    classRepo = module.get(getRepositoryToken(ClassEntity));
  });

  // ── helpers ──────────────────────────────────────────────────────────

  /** Wire up the createQueryBuilder mock chain to return `entity` */
  const setupQueryMock = (entity: ClassEntity | null) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(entity),
    };
    classRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  };

  // ── tests ────────────────────────────────────────────────────────────

  it('should be defined', () => {
    setupQueryMock(null);
    expect(service).toBeDefined();
  });

  describe('generateClassCode', () => {
    it('should start from 0001 when no existing records', async () => {
      setupQueryMock(null);

      const code = await service.generateClassCode();
      const now = new Date();

      expect(code).toBe(`${prefix(now)}0001`);
    });

    it('should increment sequence after the latest record', async () => {
      setupQueryMock({ classCode: 'CL2026070012' } as ClassEntity);

      const code = await service.generateClassCode();

      expect(code).toBe('CL2026070013');
    });

    it('should zero-pad the sequence to 4 digits', async () => {
      setupQueryMock({ classCode: 'CL2026070099' } as ClassEntity);

      const code = await service.generateClassCode();

      expect(code).toBe('CL2026070100');
    });

    it('should use current year and month as prefix', async () => {
      setupQueryMock(null);

      const code = await service.generateClassCode();
      const now = new Date();

      expect(code).toBe(`${prefix(now)}0001`);
    });

    it('should query with the correct LIKE prefix', async () => {
      const qb = setupQueryMock(null);
      const now = new Date();
      const expectedPrefix = prefix(now);

      await service.generateClassCode();

      expect(qb.where).toHaveBeenCalledWith(
        'cls.class_code LIKE :prefix',
        { prefix: `${expectedPrefix}%` },
      );
    });

    it('should filter out deleted records', async () => {
      const qb = setupQueryMock(null);

      await service.generateClassCode();

      expect(qb.andWhere).toHaveBeenCalledWith(
        'cls.deleted = :deleted',
        { deleted: false },
      );
    });

    it('should order by class_code DESC', async () => {
      const qb = setupQueryMock(null);

      await service.generateClassCode();

      expect(qb.orderBy).toHaveBeenCalledWith('cls.class_code', 'DESC');
    });
  });
});
