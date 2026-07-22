import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractEntity } from './contract.entity';

@Injectable()
export class ContractRepository {
  constructor(
    @InjectRepository(ContractEntity)
    private readonly repo: Repository<ContractEntity>,
  ) {}

  async save(entity: ContractEntity): Promise<ContractEntity> {
    return this.repo.save(entity);
  }

  async findOneById(id: number): Promise<ContractEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findOneByCode(contractCode: string): Promise<ContractEntity | null> {
    return this.repo.findOne({ where: { contractCode } });
  }

  async findByStudentCode(studentCode: string): Promise<ContractEntity[]> {
    return this.repo.find({
      where: { studentCode },
      order: { createdAt: 'DESC' },
    });
  }

  async countByStudentCode(studentCode: string): Promise<number> {
    return this.repo.count({ where: { studentCode } });
  }

  async findMany(options: {
    studentCode?: string;
    subject?: string;
    status?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: ContractEntity[]; total: number }> {
    const qb = this.repo.createQueryBuilder('c');

    if (options.studentCode) {
      qb.andWhere('c.studentCode = :studentCode', { studentCode: options.studentCode });
    }
    if (options.subject) {
      qb.andWhere('c.subject = :subject', { subject: options.subject });
    }
    if (options.status) {
      qb.andWhere('c.status = :status', { status: options.status });
    }

    qb.orderBy('c.createdAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((options.page - 1) * options.pageSize)
      .take(options.pageSize)
      .getMany();

    return { items, total };
  }
}
