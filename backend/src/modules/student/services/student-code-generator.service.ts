import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';

@Injectable()
export class StudentCodeGeneratorService {
  constructor(
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
  ) {}

  async generateStudentCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `ST${year}${month}`;

    // Find the latest student code for the current month
    const latest = await this.studentRepository
      .createQueryBuilder('student')
      .where('student.studentCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('student.studentCode', 'DESC')
      .getOne();

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.studentCode.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }
}
