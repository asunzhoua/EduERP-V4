import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRequestEntity, LeaveRequestStatus } from './leave-request.entity';

@Injectable()
export class LeaveRequestRepository {
  constructor(
    @InjectRepository(LeaveRequestEntity)
    private readonly repo: Repository<LeaveRequestEntity>,
  ) {}

  async save(entity: LeaveRequestEntity): Promise<LeaveRequestEntity> {
    return this.repo.save(entity);
  }

  async findOneById(id: number): Promise<LeaveRequestEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByStudentCode(studentCode: string): Promise<LeaveRequestEntity[]> {
    return this.repo.find({
      where: { studentCode },
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: LeaveRequestStatus): Promise<LeaveRequestEntity[]> {
    return this.repo.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(options: {
    status?: LeaveRequestStatus;
    studentCode?: string;
    classCode?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: LeaveRequestEntity[]; total: number }> {
    const qb = this.repo.createQueryBuilder('lr');

    if (options.status) {
      qb.andWhere('lr.status = :status', { status: options.status });
    }
    if (options.studentCode) {
      qb.andWhere('lr.studentCode = :studentCode', { studentCode: options.studentCode });
    }
    if (options.classCode) {
      qb.andWhere('lr.classCode = :classCode', { classCode: options.classCode });
    }

    qb.orderBy('lr.createdAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((options.page - 1) * options.pageSize)
      .take(options.pageSize)
      .getMany();

    return { items, total };
  }
}
