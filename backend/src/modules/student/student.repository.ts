import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { Student } from './entities/student.entity';

@Injectable()
export class StudentRepository {
  constructor(
    @InjectRepository(Student)
    private readonly repo: Repository<Student>,
  ) {}

  get raw(): Repository<Student> {
    return this.repo;
  }

  async save(entity: Student): Promise<Student> {
    return this.repo.save(entity);
  }

  async findById(id: number): Promise<Student | null> {
    return this.repo.findOne({ where: { id, deleted: false } });
  }

  async findByStudentCode(studentCode: string): Promise<Student | null> {
    return this.repo.findOne({ where: { studentCode, deleted: false } });
  }

  async findAndCount(options: FindManyOptions<Student>): Promise<[Student[], number]> {
    return this.repo.findAndCount(options);
  }

  async findMany(options: {
    name?: string;
    studentCode?: string;
    status?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: Student[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.deleted = :deleted', { deleted: false });

    if (options.name) {
      qb.andWhere('s.name LIKE :name', { name: `%${options.name}%` });
    }
    if (options.studentCode) {
      qb.andWhere('s.studentCode = :studentCode', {
        studentCode: options.studentCode,
      });
    }
    if (options.status) {
      qb.andWhere('s.status = :status', { status: options.status });
    }

    qb.orderBy('s.createTime', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((options.page - 1) * options.pageSize)
      .take(options.pageSize)
      .getMany();

    return { items, total };
  }

  async update(id: number, partial: Partial<Student>): Promise<void> {
    await this.repo.update(id, partial);
  }
}
