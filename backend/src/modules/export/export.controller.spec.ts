import { Test, TestingModule } from '@nestjs/testing';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('ExportController', () => {
  let controller: ExportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [
        {
          provide: ExportService,
          useValue: {
            exportStudents: jest.fn().mockResolvedValue(Buffer.from('test')),
            exportLessons: jest.fn().mockResolvedValue(Buffer.from('test')),
            exportConsumption: jest.fn().mockResolvedValue(Buffer.from('test')),
            exportSalary: jest.fn().mockResolvedValue(Buffer.from('test')),
            exportFinance: jest.fn().mockResolvedValue(Buffer.from('test')),
          },
        },
        RolesGuard,
        Reflector,
      ],
    }).compile();

    controller = module.get<ExportController>(ExportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should export students', async () => {
    const res = {
      set: jest.fn(),
      send: jest.fn(),
    };

    await controller.exportStudents({ format: 'csv' } as any, res as any);

    expect(res.set).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it('should export students in Excel format', async () => {
    const res = {
      set: jest.fn(),
      send: jest.fn(),
    };

    await controller.exportStudents({ format: 'excel' } as any, res as any);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    expect(res.send).toHaveBeenCalled();
  });

  it('should export lessons', async () => {
    const res = {
      set: jest.fn(),
      send: jest.fn(),
    };

    await controller.exportLessons({}, res as any);

    expect(res.set).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it('should export consumption', async () => {
    const res = {
      set: jest.fn(),
      send: jest.fn(),
    };

    await controller.exportConsumption({}, res as any);

    expect(res.set).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it('should export salary', async () => {
    const res = {
      set: jest.fn(),
      send: jest.fn(),
    };

    await controller.exportSalary({}, res as any);

    expect(res.set).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it('should export finance', async () => {
    const res = {
      set: jest.fn(),
      send: jest.fn(),
    };

    await controller.exportFinance({}, res as any);

    expect(res.set).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it('should default to CSV format when no format specified', async () => {
    const res = {
      set: jest.fn(),
      send: jest.fn(),
    };

    await controller.exportStudents({}, res as any);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'text/csv',
      }),
    );
    expect(res.send).toHaveBeenCalled();
  });
});
