import { Test, TestingModule } from '@nestjs/testing';
import { {{SERVICE}} } from './{{NAME_KEBAB}}.service';
import { {{REPOSITORY}} } from './{{NAME_KEBAB}}.repository';
import { {{ENTITY}} } from './{{NAME_KEBAB}}.entity';
import { {{NAME}}Status } from './enums/{{NAME_KEBAB}}-status.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('{{SERVICE}}', () => {
  let service: {{SERVICE}};
  let repo: {
    raw: { create: jest.Mock };
    save: jest.Mock;
    findOneByCode: jest.Mock;
    findOneById: jest.Mock;
    findMany: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      raw: { create: jest.fn() },
      save: jest.fn(),
      findOneByCode: jest.fn(),
      findOneById: jest.fn(),
      findMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {{SERVICE}},
        { provide: {{REPOSITORY}}, useValue: repo },
      ],
    }).compile();

    service = module.get<{{SERVICE}}>({{SERVICE}});
  });

  describe('create', () => {
    it('should create a new {{NAME_CAMEL}}', async () => {
      const dto = {
        {{NAME_CAMEL}}Code: 'TEST001',
        name: 'Test {{NAME}}',
      };
      const entity = {
        id: 1,
        ...dto,
        status: {{NAME}}Status.DRAFT,
        createdBy: 1,
      };

      repo.findOneByCode.mockResolvedValue(null);
      repo.raw.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(dto as any, 1);

      expect(result).toEqual(entity);
      expect(repo.findOneByCode).toHaveBeenCalledWith('TEST001');
      expect(repo.save).toHaveBeenCalledWith(entity);
    });

    it('should throw when code already exists', async () => {
      repo.findOneByCode.mockResolvedValue({ id: 1 });

      await expect(
        service.create({ {{NAME_CAMEL}}Code: 'EXISTING', name: 'Dup' } as any, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByCode', () => {
    it('should return {{NAME_CAMEL}} when found', async () => {
      const entity = { id: 1, {{NAME_CAMEL}}Code: 'TEST001' };
      repo.findOneByCode.mockResolvedValue(entity);

      const result = await service.findByCode('TEST001');
      expect(result).toEqual(entity);
    });

    it('should throw NotFoundException when not found', async () => {
      repo.findOneByCode.mockResolvedValue(null);

      await expect(service.findByCode('MISSING')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const expected = { items: [], total: 0 };
      repo.findMany.mockResolvedValue(expected);

      const result = await service.findAll({});
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('should update DRAFT {{NAME_CAMEL}}', async () => {
      const entity = {
        id: 1,
        {{NAME_CAMEL}}Code: 'TEST001',
        status: {{NAME}}Status.DRAFT,
        name: 'Old Name',
      };
      repo.findOneByCode.mockResolvedValue(entity);
      repo.save.mockResolvedValue({ ...entity, name: 'New Name' });

      const result = await service.update(
        'TEST001',
        { name: 'New Name' } as any,
        1,
      );
      expect(result.name).toBe('New Name');
    });

    it('should reject update on non-DRAFT status', async () => {
      repo.findOneByCode.mockResolvedValue({
        id: 1,
        status: {{NAME}}Status.ACTIVE,
      });

      await expect(
        service.update('TEST001', { name: 'X' } as any, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should transition DRAFT to ACTIVE', async () => {
      repo.findOneByCode.mockResolvedValue({
        id: 1,
        {{NAME_CAMEL}}Code: 'TEST001',
        status: {{NAME}}Status.DRAFT,
      });
      repo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.updateStatus(
        'TEST001',
        {{NAME}}Status.ACTIVE,
        1,
      );
      expect(result.status).toBe({{NAME}}Status.ACTIVE);
    });

    it('should reject invalid transition', async () => {
      repo.findOneByCode.mockResolvedValue({
        id: 1,
        status: {{NAME}}Status.CANCELLED,
      });

      await expect(
        service.updateStatus('TEST001', {{NAME}}Status.ACTIVE, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete DRAFT {{NAME_CAMEL}}', async () => {
      repo.findOneByCode.mockResolvedValue({
        id: 1,
        status: {{NAME}}Status.DRAFT,
        deleted: false,
      });
      repo.save.mockImplementation((e) => Promise.resolve(e));

      await service.remove('TEST001', 1);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted: true }),
      );
    });

    it('should reject delete on non-DRAFT status', async () => {
      repo.findOneByCode.mockResolvedValue({
        id: 1,
        status: {{NAME}}Status.ACTIVE,
      });

      await expect(service.remove('TEST001', 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
