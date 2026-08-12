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

    // courseCode 是 UNIQUE，软删除记录仍占用编码空间，因此必须纳入 max 计算，
    // 否则「创建→软删最高位→再创建」会生成重复编码触发 500。
    const latest = await this.courseRepository
      .createQueryBuilder('course')
      .where('course.courseCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('course.courseCode', 'DESC')
      .getOne();

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.courseCode.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }
}
