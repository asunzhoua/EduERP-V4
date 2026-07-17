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
}
