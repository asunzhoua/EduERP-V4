import { Test, TestingModule } from '@nestjs/testing';
import { {{CONTROLLER}} } from './{{NAME_KEBAB}}.controller';
import { {{SERVICE}} } from './{{NAME_KEBAB}}.service';

describe('{{CONTROLLER}}', () => {
  let controller: {{CONTROLLER}};
  let service: {
    create: jest.Mock;
    findByCode: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findByCode: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [{{CONTROLLER}}],
      providers: [{ provide: {{SERVICE}}, useValue: service }],
    }).compile();

    controller = module.get<{{CONTROLLER}}>({{CONTROLLER}});
  });

  describe('create', () => {
    it('should create and return success response', async () => {
      const dto = { {{NAME_CAMEL}}Code: 'TEST001', name: 'Test' };
      const entity = { id: 1, ...dto };
      service.create.mockResolvedValue(entity);

      const result = await controller.create(dto as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(entity);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const expected = { items: [], total: 0 };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll({} as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should return single entity', async () => {
      const entity = { id: 1, {{NAME_CAMEL}}Code: 'TEST001' };
      service.findByCode.mockResolvedValue(entity);

      const result = await controller.findOne('TEST001');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(entity);
    });
  });

  describe('update', () => {
    it('should update and return success', async () => {
      const entity = { id: 1, {{NAME_CAMEL}}Code: 'TEST001', name: 'Updated' };
      service.update.mockResolvedValue(entity);

      const result = await controller.update('TEST001', { name: 'Updated' } as any);

      expect(result.success).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove and return success', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('TEST001');

      expect(result.success).toBe(true);
    });
  });
});
