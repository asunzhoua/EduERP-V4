import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonEntity } from './lesson.entity';

@Injectable()
export class LessonRepository {
  constructor(
    @InjectRepository(LessonEntity)
    private readonly repo: Repository<LessonEntity>,
  ) {}

  async save(entity: LessonEntity): Promise<LessonEntity> {
    return this.repo.save(entity);
  }

  async saveAll(entities: LessonEntity[]): Promise<LessonEntity[]> {
    return this.repo.save(entities);
  }

  async findOneById(id: number): Promise<LessonEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByClassCode(classCode: string): Promise<LessonEntity[]> {
    return this.repo.find({
      where: { classCode },
      order: { lessonNumber: 'ASC' },
    });
  }

  async countByClassCode(classCode: string): Promise<number> {
    return this.repo.count({ where: { classCode } });
  }

  async findOneByClassCodeAndLessonNumber(
    classCode: string,
    lessonNumber: number,
  ): Promise<LessonEntity | null> {
    return this.repo.findOne({ where: { classCode, lessonNumber } });
  }

  async findMaxLessonNumber(classCode: string): Promise<number | null> {
    const result = await this.repo
      .createQueryBuilder('l')
      .select('MAX(l.lessonNumber)', 'maxLessonNumber')
      .where('l.classCode = :classCode', { classCode })
      .getRawOne();
    return result?.maxLessonNumber ?? null;
  }
}
