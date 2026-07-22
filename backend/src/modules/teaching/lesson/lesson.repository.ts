import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonEntity } from './lesson.entity';
import { LessonStatus } from './enums/lesson-status.enum';

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

  // ─── Data Enrichment ───

  async countByClassCodeAndStatus(classCode: string, status: LessonStatus): Promise<number> {
    return this.repo.count({ where: { classCode, status } });
  }

  async countFinishedByClassCodes(classCodes: string[]): Promise<Map<string, number>> {
    if (!classCodes.length) return new Map();

    const results = await this.repo
      .createQueryBuilder('l')
      .select('l.classCode', 'classCode')
      .addSelect('COUNT(*)', 'count')
      .where('l.classCode IN (:...classCodes)', { classCodes })
      .andWhere('l.status = :status', { status: LessonStatus.FINISHED })
      .groupBy('l.classCode')
      .getRawMany();

    const map = new Map<string, number>();
    results.forEach(r => map.set(r.classCode, parseInt(r.count, 10)));
    return map;
  }

  async findMaxScheduledDateByClassCode(classCode: string): Promise<string | null> {
    const result = await this.repo
      .createQueryBuilder('l')
      .select('MAX(l.scheduledDate)', 'maxDate')
      .where('l.classCode = :classCode', { classCode })
      .getRawOne();
    return result?.maxDate ?? null;
  }

  async findMaxScheduledDateByClassCodes(classCodes: string[]): Promise<Map<string, string>> {
    if (!classCodes.length) return new Map();

    const results = await this.repo
      .createQueryBuilder('l')
      .select('l.classCode', 'classCode')
      .addSelect('MAX(l.scheduledDate)', 'maxDate')
      .where('l.classCode IN (:...classCodes)', { classCodes })
      .groupBy('l.classCode')
      .getRawMany();

    const map = new Map<string, string>();
    results.forEach(r => map.set(r.classCode, r.maxDate));
    return map;
  }
}
