import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseCodeGeneratorService } from './course-code-generator.service';
import { CourseEntity } from './course.entity';

const FIXED_DATE = new Date('2026-07-15T08:00:00Z');
let OriginalDate: typeof Date;

describe('CourseCodeGeneratorService', () => {
  let service: CourseCodeGeneratorService;
  let courseRepo: jest.Mocked<Repository<CourseEntity>>;

  /** Build the expected prefix for a given Date (CS{year}{month}) */
  const prefix = (d: Date) =>
    `CS${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  beforeEach(() => {
    OriginalDate = global.Date;
    jest
      .spyOn(global, 'Date')
      .mockImplementation((...args: (string | number | Date)[]): Date => {
        if (args.length === 0) return new OriginalDate(FIXED_DATE.getTime());
        return Reflect.construct(OriginalDate, args) as Date;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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
    const qb = {
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

      const code = await service.generateCourseCode();
      const now = new Date();

      expect(code).toBe(`${prefix(now)}0001`);
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

      expect(qb.where).toHaveBeenCalledWith('course.courseCode LIKE :prefix', {
        prefix: `${expectedPrefix}%`,
      });
    });

    it('should NOT filter deleted records (soft-deleted rows still occupy the code space)', async () => {
      const qb = setupQueryMock(null);

      await service.generateCourseCode();

      // courseCode 是 UNIQUE，软删除记录仍占用编码空间，因此 max 计算必须纳入，
      // 不能加 deleted = false 过滤，否则「软删最高位后重建」会生成重复编码。
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should increment past a soft-deleted latest record', async () => {
      // 最高位是软删除记录（deleted=true），仍应作为 max 参与计算，生成下一位
      setupQueryMock({
        courseCode: 'CS2026070105',
        deleted: true,
      } as CourseEntity);

      const code = await service.generateCourseCode();

      expect(code).toBe('CS2026070106');
    });

    it('should order by course_code DESC', async () => {
      const qb = setupQueryMock(null);

      await service.generateCourseCode();

      expect(qb.orderBy).toHaveBeenCalledWith('course.courseCode', 'DESC');
    });
  });
});
