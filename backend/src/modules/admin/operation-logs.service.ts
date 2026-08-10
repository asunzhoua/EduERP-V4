import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, FindOptionsWhere } from 'typeorm';
import { OperationLog } from './entities/operation-log.entity';

export interface CreateOperationLogInput {
  userId: number;
  username: string;
  role: string;
  method: string;
  path: string;
  action: string;
  module?: string | null;
  resourceId?: string | null;
  detail?: string | null;
  ip?: string | null;
}

export interface QueryOperationLogDto {
  keyword?: string;
  module?: string;
  action?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class OperationLogsService {
  constructor(
    @InjectRepository(OperationLog)
    private readonly logRepo: Repository<OperationLog>,
  ) {}

  async write(input: CreateOperationLogInput): Promise<void> {
    const log = this.logRepo.create({
      userId: input.userId,
      username: input.username,
      role: input.role,
      method: input.method,
      path: input.path,
      action: input.action,
      module: input.module ?? null,
      resourceId: input.resourceId ?? null,
      detail: input.detail ?? null,
      ip: input.ip ?? null,
    });
    await this.logRepo.save(log).catch(() => {
      // 日志写入失败不应影响主流程
    });
  }

  async findAll(query: QueryOperationLogDto): Promise<{
    items: OperationLog[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: FindOptionsWhere<OperationLog> = {};
    if (query.keyword) {
      where.username = Like(`%${query.keyword}%`);
    }
    if (query.module) {
      where.module = query.module;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.startDate && query.endDate) {
      where.createdAt = Between(
        new Date(`${query.startDate}T00:00:00`),
        new Date(`${query.endDate}T23:59:59`),
      );
    } else if (query.startDate) {
      where.createdAt = Between(
        new Date(`${query.startDate}T00:00:00`),
        new Date(`${query.startDate}T23:59:59`),
      );
    }

    const [items, total] = await this.logRepo.findAndCount({
      where,
      skip,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    return { items, total, page, pageSize };
  }
}
