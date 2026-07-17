import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseEntity } from './course.entity';

@Injectable()
export class CourseCodeGeneratorService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
  ) {}

  async generateCourseCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `CS${year}${month}`;

    // Find the latest course code with this prefix
    const latest = await this.courseRepository
      .createQueryBuilder('course')
      .where('course.course_code LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('course.deleted = :deleted', { deleted: false })
      .orderBy('course.course_code', 'DESC')
      .getOne();

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.courseCode.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }
}
