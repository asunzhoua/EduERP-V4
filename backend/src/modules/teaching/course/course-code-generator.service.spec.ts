import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseCodeGeneratorService } from './course-code-generator.service';
import { CourseEntity } from './course.entity';

describe('CourseCodeGeneratorService', () => {
  let service: CourseCodeGeneratorService;
  let courseRepo: jest.Mocked<Repository<CourseEntity>>;

  /** Build the expected prefix for a given Date (CS{year}{month}) */
  const prefix = (d: Date) =>
    `CS${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  beforeEach(async () => {
    const mockRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseCodeGeneratorService,
        { provide: getRepositoryToken(CourseEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(CourseCodeGeneratorService);
    courseRepo = module.get(getRepositoryToken(CourseEntity));
  });

  // ── helpers ──────────────────────────────────────────────────────────

  /** Wire up the createQueryBuilder mock chain to return `entity` */
  const setupQueryMock = (entity: CourseEntity | null) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(entity),
    };
    courseRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  };

  // ── tests ────────────────────────────────────────────────────────────

  it('should be defined', () => {
    setupQueryMock(null);
    expect(service).toBeDefined();
  });

  describe('generateCourseCode', () => {
    it('should start from 0001 when no existing records', async () => {
      setupQueryMock(null);
      const now = new Date('2026-03-15');
      jest.spyOn(global, 'Date').mockImplementation(((...args: any[]) => {
        if (args.length === 0) return now;
        return new (Function.prototype.bind.apply(Date.__proto__ ?? Date.prototype, [null, ...args] as any) as any)();
      }) as any);

      const code = await service.generateCourseCode();

      expect(code).toBe(`${prefix(now)}0001`);

      // restore
      jest.restoreAllMocks();
    });

    it('should increment sequence after the latest record', async () => {
      setupQueryMock({ courseCode: 'CS2026070012' } as CourseEntity);

      const code = await service.generateCourseCode();

      expect(code).toBe('CS2026070013');
    });

    it('should zero-pad the sequence to 4 digits', async () => {
      setupQueryMock({ courseCode: 'CS2026070099' } as CourseEntity);

      const code = await service.generateCourseCode();

      expect(code).toBe('CS2026070100');
    });

    it('should use current year and month as prefix', async () => {
      setupQueryMock(null);

      const code = await service.generateCourseCode();
      const now = new Date();

      expect(code).toBe(`${prefix(now)}0001`);
    });

    it('should query with the correct LIKE prefix', async () => {
      const qb = setupQueryMock(null);
      const now = new Date();
      const expectedPrefix = prefix(now);

      await service.generateCourseCode();

      expect(qb.where).toHaveBeenCalledWith(
        'course.course_code LIKE :prefix',
        { prefix: `${expectedPrefix}%` },
      );
    });

    it('should filter out deleted records', async () => {
      const qb = setupQueryMock(null);

      await service.generateCourseCode();

      expect(qb.andWhere).toHaveBeenCalledWith(
        'course.deleted = :deleted',
        { deleted: false },
      );
    });

    it('should order by course_code DESC', async () => {
      const qb = setupQueryMock(null);

      await service.generateCourseCode();

      expect(qb.orderBy).toHaveBeenCalledWith('course.course_code', 'DESC');
    });
  });
});
