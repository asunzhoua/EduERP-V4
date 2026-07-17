import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseEntity } from './course.entity';

@Injectable()
export class CourseRepository {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly repo: Repository<CourseEntity>,
  ) {}

  /** Expose the underlying TypeORM repository for query building. */
  get raw(): Repository<CourseEntity> {
    return this.repo;
  }

  async save(entity: CourseEntity): Promise<CourseEntity> {
    return this.repo.save(entity);
  }

  async findOneByCode(courseCode: string): Promise<CourseEntity | null> {
    return this.repo.findOne({ where: { courseCode, deleted: false } });
  }

  async findMany(options: {
    name?: string;
    subject?: string;
    type?: string;
    status?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: CourseEntity[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.deleted = :deleted', { deleted: false });

    if (options.name) {
      qb.andWhere('c.name LIKE :name', { name: `%${options.name}%` });
    }
    if (options.subject) {
      qb.andWhere('c.subject = :subject', { subject: options.subject });
    }
    if (options.type) {
      qb.andWhere('c.type = :type', { type: options.type });
    }
    if (options.status) {
      qb.andWhere('c.status = :status', { status: options.status });
    }

    qb.orderBy('c.createTime', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((options.page - 1) * options.pageSize)
      .take(options.pageSize)
      .getMany();

    return { items, total };
  }
}
