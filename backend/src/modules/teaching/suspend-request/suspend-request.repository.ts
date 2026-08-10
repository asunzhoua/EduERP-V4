import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SuspendRequestEntity,
  SuspendRequestStatus,
} from './suspend-request.entity';

@Injectable()
export class SuspendRequestRepository {
  constructor(
    @InjectRepository(SuspendRequestEntity)
    private readonly repo: Repository<SuspendRequestEntity>,
  ) {}

  async save(entity: SuspendRequestEntity): Promise<SuspendRequestEntity> {
    return this.repo.save(entity);
  }

  async findOneById(id: number): Promise<SuspendRequestEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByStudentCode(
    studentCode: string,
  ): Promise<SuspendRequestEntity[]> {
    return this.repo.find({
      where: { studentCode },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(options: {
    status?: SuspendRequestStatus;
    studentCode?: string;
    classCode?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: SuspendRequestEntity[]; total: number }> {
    const qb = this.repo.createQueryBuilder('sr');

    if (options.status) {
      qb.andWhere('sr.status = :status', { status: options.status });
    }
    if (options.studentCode) {
      qb.andWhere('sr.studentCode = :studentCode', {
        studentCode: options.studentCode,
      });
    }
    if (options.classCode) {
      qb.andWhere('sr.classCode = :classCode', {
        classCode: options.classCode,
      });
    }

    qb.orderBy('sr.createdAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((options.page - 1) * options.pageSize)
      .take(options.pageSize)
      .getMany();

    return { items, total };
  }
}
