import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppLogger } from '@utils/logger';

export interface PoolStats {
  total: number;
  active: number;
  idle: number;
  waiting: number;
  usage: number; // percentage
  timestamp: string;
}

@Injectable()
export class PoolMonitorService implements OnModuleInit {
  private readonly logger = new AppLogger();
  private readonly warningThreshold = 0.8; // 80%

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit() {
    this.logger.log('Pool Monitor Service initialized', 'PoolMonitor');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorPool(): Promise<void> {
    try {
      const stats = await this.getPoolStats();
      this.logPoolStats(stats);
      this.checkAlerts(stats);
    } catch (error) {
      this.logger.error(`Failed to monitor pool: ${error.message}`, 'PoolMonitor');
    }
  }

  async getPoolStats(): Promise<PoolStats> {
    const driver = this.dataSource.driver as any;
    
    if (!driver.pool) {
      return {
        total: 0,
        active: 0,
        idle: 0,
        waiting: 0,
        usage: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const pool = driver.pool;
    const total = pool.size || 0;
    const active = pool.active || 0;
    const idle = pool.idle || 0;
    const waiting = pool.waiting || 0;
    const usage = total > 0 ? active / total : 0;

    return {
      total,
      active,
      idle,
      waiting,
      usage,
      timestamp: new Date().toISOString(),
    };
  }

  private logPoolStats(stats: PoolStats): void {
    const message = `[DB Pool] total=${stats.total}, active=${stats.active}, idle=${stats.idle}, waiting=${stats.waiting}, usage=${(stats.usage * 100).toFixed(1)}%`;
    
    if (stats.usage > this.warningThreshold) {
      this.logger.warn(message, 'PoolMonitor');
    } else {
      this.logger.log(message, 'PoolMonitor');
    }
  }

  private checkAlerts(stats: PoolStats): void {
    // 高使用率告警
    if (stats.usage > this.warningThreshold) {
      this.logger.warn(
        `[ALERT] Database connection pool usage is high: ${(stats.usage * 100).toFixed(1)}%`,
        'PoolMonitor'
      );
    }

    // 等待队列告警
    if (stats.waiting > 0) {
      this.logger.warn(
        `[ALERT] Database connection pool has ${stats.waiting} waiting requests`,
        'PoolMonitor'
      );
    }

    // 无可用连接告警
    if (stats.total > 0 && stats.idle === 0 && stats.active === stats.total) {
      this.logger.error(
        '[ALERT] Database connection pool is fully utilized, no idle connections available',
        'PoolMonitor'
      );
    }
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    stats: PoolStats;
  }> {
    const stats = await this.getPoolStats();

    if (stats.usage > 0.9 || stats.waiting > 5) {
      return {
        status: 'critical',
        message: 'Database connection pool is critical',
        stats,
      };
    }

    if (stats.usage > this.warningThreshold || stats.waiting > 0) {
      return {
        status: 'warning',
        message: 'Database connection pool usage is high',
        stats,
      };
    }

    return {
      status: 'healthy',
      message: 'Database connection pool is healthy',
      stats,
    };
  }
}
