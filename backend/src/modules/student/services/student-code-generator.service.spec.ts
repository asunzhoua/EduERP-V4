import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentCodeGeneratorService } from './student-code-generator.service';
import { Student } from '../entities/student.entity';

describe('StudentCodeGeneratorService', () => {
  let service: StudentCodeGeneratorService;
  let repository: jest.Mocked<Repository<Student>>;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentCodeGeneratorService,
        {
          provide: getRepositoryToken(Student),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get(StudentCodeGeneratorService);
    repository = module.get(getRepositoryToken(Student));

    // Reset mock return values
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.orderBy.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.getOne.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateStudentCode', () => {
    it('should generate code with sequence 0001 when no existing students', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const code = await service.generateStudentCode();

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      expect(code).toBe(`ST${year}${month}0001`);
    });

    it('should increment sequence from last student code', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({
        studentCode: 'ST2026070015',
      });

      const code = await service.generateStudentCode();

      expect(code).toBe('ST2026070016');
    });

    it('should handle sequence rolling over to 5 digits', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({
        studentCode: 'ST2026079999',
      });

      const code = await service.generateStudentCode();

      expect(code).toBe('ST20260710000');
    });

    it('should query with correct prefix and ordering', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await service.generateStudentCode();

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const expectedPrefix = `ST${year}${month}`;

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('student');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'student.studentCode LIKE :prefix',
        { prefix: `${expectedPrefix}%` },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'student.studentCode',
        'DESC',
      );
    });

    it('should pad sequence to 4 digits', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({
        studentCode: 'ST2026070009',
      });

      const code = await service.generateStudentCode();

      expect(code).toBe('ST2026070010');
    });
  });
});
