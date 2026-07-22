import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClassEntity } from './class.entity';
import { ClassStatus } from './enums/class-status.enum';

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

  async countActiveByCourseCode(courseCode: string): Promise<number> {
    return this.repo.count({ where: { courseCode, status: ClassStatus.ACTIVE } });
  }

  async countActiveByCourseCodes(courseCodes: string[]): Promise<Map<string, number>> {
    if (!courseCodes.length) return new Map();

    const results = await this.repo
      .createQueryBuilder('c')
      .select('c.courseCode', 'courseCode')
      .addSelect('COUNT(*)', 'count')
      .where('c.courseCode IN (:...courseCodes)', { courseCodes })
      .andWhere('c.status = :status', { status: ClassStatus.ACTIVE })
      .groupBy('c.courseCode')
      .getRawMany();

    const map = new Map<string, number>();
    results.forEach(r => map.set(r.courseCode, parseInt(r.count, 10)));
    return map;
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
      qb.andWhere('c.courseCode = :courseCode', {
        courseCode: options.courseCode,
      });
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
