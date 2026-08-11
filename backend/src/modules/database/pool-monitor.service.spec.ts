import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PoolMonitorService } from './pool-monitor.service';

type MockPool = {
  size: number;
  active: number;
  idle: number;
  waiting: number;
};

describe('PoolMonitorService', () => {
  let service: PoolMonitorService;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoolMonitorService,
        {
          provide: DataSource,
          useValue: {
            driver: {
              pool: {
                size: 10,
                active: 3,
                idle: 7,
                waiting: 0,
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<PoolMonitorService>(PoolMonitorService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', async () => {
      const stats = await service.getPoolStats();

      expect(stats).toBeDefined();
      expect(stats.total).toBe(10);
      expect(stats.active).toBe(3);
      expect(stats.idle).toBe(7);
      expect(stats.waiting).toBe(0);
      expect(stats.usage).toBe(0.3);
      expect(stats.timestamp).toBeDefined();
    });

    it('should handle missing pool', async () => {
      (dataSource as unknown as { driver: { pool?: MockPool } }).driver = {};

      const stats = await service.getPoolStats();

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.idle).toBe(0);
      expect(stats.waiting).toBe(0);
      expect(stats.usage).toBe(0);
    });

    it('should calculate usage correctly', async () => {
      (dataSource as unknown as { driver: { pool?: MockPool } }).driver.pool = {
        size: 10,
        active: 8,
        idle: 2,
        waiting: 0,
      };

      const stats = await service.getPoolStats();

      expect(stats.usage).toBe(0.8);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status for normal usage', async () => {
      const health = await service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.message).toContain('healthy');
      expect(health.stats).toBeDefined();
    });

    it('should return warning status for high usage', async () => {
      (dataSource as unknown as { driver: { pool?: MockPool } }).driver.pool = {
        size: 10,
        active: 9,
        idle: 1,
        waiting: 0,
      };

      const health = await service.getHealthStatus();

      expect(health.status).toBe('warning');
      expect(health.message).toContain('high');
    });

    it('should return critical status for very high usage', async () => {
      (dataSource as unknown as { driver: { pool?: MockPool } }).driver.pool = {
        size: 10,
        active: 10,
        idle: 0,
        waiting: 6,
      };

      const health = await service.getHealthStatus();

      expect(health.status).toBe('critical');
      expect(health.message).toContain('critical');
    });

    it('should return warning status when there are waiting requests', async () => {
      (dataSource as unknown as { driver: { pool?: MockPool } }).driver.pool = {
        size: 10,
        active: 5,
        idle: 5,
        waiting: 1,
      };

      const health = await service.getHealthStatus();

      expect(health.status).toBe('warning');
    });
  });

  describe('monitorPool', () => {
    it('should not throw when monitoring', async () => {
      await expect(service.monitorPool()).resolves.not.toThrow();
    });

    it('should handle errors gracefully', async () => {
      (dataSource as unknown as { driver: { pool?: MockPool } | null }).driver =
        null;

      await expect(service.monitorPool()).resolves.not.toThrow();
    });
  });
});
