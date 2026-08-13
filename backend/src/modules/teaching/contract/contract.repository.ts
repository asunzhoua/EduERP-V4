import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { ContractEntity } from './contract.entity';
import { ContractStatus } from './enums/contract-status.enum';

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

  async findActiveByStudentCodeAndSubject(
    studentCode: string,
    subject: string,
  ): Promise<ContractEntity | null> {
    return this.repo.findOne({
      where: { studentCode, subject, status: ContractStatus.ACTIVE },
      order: { validFrom: 'ASC' },
    });
  }

  async findByStudentCode(studentCode: string): Promise<ContractEntity[]> {
    return this.repo.find({
      where: { studentCode },
      order: { createdAt: 'DESC' },
    });
  }

  /** 某学生 ACTIVE 的合同（用于教师添加学生时选合同）。 */
  async findActiveByStudentCode(
    studentCode: string,
  ): Promise<ContractEntity[]> {
    return this.repo.find({
      where: { studentCode, status: ContractStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  /** 批量：多学生 ACTIVE 合同（用于教师添加学生候选池）。 */
  async findActiveByStudentCodeIn(
    studentCodes: string[],
  ): Promise<ContractEntity[]> {
    if (!studentCodes.length) return [];
    return this.repo.find({
      where: { studentCode: In(studentCodes), status: ContractStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async countByStudentCode(studentCode: string): Promise<number> {
    return this.repo.count({ where: { studentCode } });
  }

  /** 续费预警：ACTIVE 且剩余课时 <= 阈值的合同（剩余少的在前）。 */
  async findActiveAtRisk(threshold: number): Promise<ContractEntity[]> {
    return this.repo.find({
      where: {
        status: ContractStatus.ACTIVE,
        remainingLessons: LessThanOrEqual(threshold),
      },
      order: { remainingLessons: 'ASC' },
    });
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
      qb.andWhere('c.studentCode = :studentCode', {
        studentCode: options.studentCode,
      });
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
