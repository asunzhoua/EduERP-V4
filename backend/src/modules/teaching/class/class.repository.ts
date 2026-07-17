import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from './class.entity';

@Injectable()
export class ClassRepository {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly repo: Repository<ClassEntity>,
  ) {}

  get raw(): Repository<ClassEntity> {
    return this.repo;
  }

  async save(entity: ClassEntity): Promise<ClassEntity> {
    return this.repo.save(entity);
  }

  async findOneByCode(classCode: string): Promise<ClassEntity | null> {
    return this.repo.findOne({ where: { classCode, deleted: false } });
  }

  async findMany(options: {
    name?: string;
    courseCode?: string;
    status?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: ClassEntity[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.deleted = :deleted', { deleted: false });

    if (options.name) {
      qb.andWhere('c.name LIKE :name', { name: `%${options.name}%` });
    }
    if (options.courseCode) {
      qb.andWhere('c.course_code = :courseCode', {
        courseCode: options.courseCode,
      });
    }
    if (options.status) {
      qb.andWhere('c.status = :status', { status: options.status });
    }

    qb.orderBy('c.create_time', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((options.page - 1) * options.pageSize)
      .take(options.pageSize)
      .getMany();

    return { items, total };
  }
}
