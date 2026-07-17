import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { {{ENTITY}} } from './{{NAME_KEBAB}}.entity';

@Injectable()
export class {{REPOSITORY}} {
  constructor(
    @InjectRepository({{ENTITY}})
    private readonly repo: Repository<{{ENTITY}}>,
  ) {}

  get raw(): Repository<{{ENTITY}}> {
    return this.repo;
  }

  async save(entity: {{ENTITY}}): Promise<{{ENTITY}}> {
    return this.repo.save(entity);
  }

  async findOneByCode({{NAME_CAMEL}}Code: string): Promise<{{ENTITY}} | null> {
    return this.repo.findOne({ where: { {{NAME_CAMEL}}Code, deleted: false } });
  }

  async findOneById(id: number): Promise<{{ENTITY}} | null> {
    return this.repo.findOne({ where: { id, deleted: false } });
  }

  async findMany(options: {
    page?: number;
    pageSize?: number;
    name?: string;
    status?: string;
  }): Promise<{ items: {{ENTITY}}[]; total: number }> {
    const { page = 1, pageSize = 20, name, status } = options;
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.deleted = :deleted', { deleted: false });

    if (name) {
      qb.andWhere('e.name LIKE :name', { name: `%${name}%` });
    }

    if (status) {
      qb.andWhere('e.status = :status', { status });
    }

    qb.orderBy('e.create_time', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { items, total };
  }
}
