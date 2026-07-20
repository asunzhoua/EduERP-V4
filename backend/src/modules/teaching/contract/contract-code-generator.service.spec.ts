import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractCodeGeneratorService } from './contract-code-generator.service';
import { ContractEntity } from './contract.entity';

describe('ContractCodeGeneratorService', () => {
  let service: ContractCodeGeneratorService;
  let contractRepo: jest.Mocked<Repository<ContractEntity>>;

  /** Build the expected prefix for a given Date (CT{year}{month}) */
  const prefix = (d: Date) =>
    `CT${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  beforeEach(async () => {
    const mockRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractCodeGeneratorService,
        { provide: getRepositoryToken(ContractEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(ContractCodeGeneratorService);
    contractRepo = module.get(getRepositoryToken(ContractEntity));
  });

  // ── helpers ──────────────────────────────────────────────────────────

  /** Wire up the createQueryBuilder mock chain to return `entity` */
  const setupQueryMock = (entity: ContractEntity | null) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(entity),
    };
    contractRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  };

  // ── tests ────────────────────────────────────────────────────────────

  it('should be defined', () => {
    setupQueryMock(null);
    expect(service).toBeDefined();
  });

  describe('generateContractCode', () => {
    it('should start from 0001 when no existing records', async () => {
      setupQueryMock(null);

      const code = await service.generateContractCode();
      const now = new Date();

      expect(code).toBe(`${prefix(now)}0001`);
    });

    it('should increment sequence after the latest record', async () => {
      setupQueryMock({ contractCode: 'CT2026070012' } as ContractEntity);

      const code = await service.generateContractCode();

      expect(code).toBe('CT2026070013');
    });

    it('should zero-pad the sequence to 4 digits', async () => {
      setupQueryMock({ contractCode: 'CT2026070099' } as ContractEntity);

      const code = await service.generateContractCode();

      expect(code).toBe('CT2026070100');
    });

    it('should use current year and month as prefix', async () => {
      setupQueryMock(null);

      const code = await service.generateContractCode();
      const now = new Date();

      expect(code).toBe(`${prefix(now)}0001`);
    });

    it('should query with the correct LIKE prefix', async () => {
      const qb = setupQueryMock(null);
      const now = new Date();
      const expectedPrefix = prefix(now);

      await service.generateContractCode();

      expect(qb.where).toHaveBeenCalledWith(
        'c.contract_code LIKE :prefix',
        { prefix: `${expectedPrefix}%` },
      );
    });

    it('should NOT filter deleted records (no deleted column)', async () => {
      const qb = setupQueryMock(null);

      await service.generateContractCode();

      // ContractEntity has no `deleted` column, so no andWhere call
      expect(qb.andWhere).toBeUndefined();
    });

    it('should order by contract_code DESC', async () => {
      const qb = setupQueryMock(null);

      await service.generateContractCode();

      expect(qb.orderBy).toHaveBeenCalledWith('c.contract_code', 'DESC');
    });
  });
});
