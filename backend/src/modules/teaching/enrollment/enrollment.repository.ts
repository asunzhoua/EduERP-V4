import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EnrollmentEntity } from './enrollment.entity';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';

@Injectable()
export class EnrollmentRepository {
  constructor(
    @InjectRepository(EnrollmentEntity)
    private readonly repo: Repository<EnrollmentEntity>,
  ) {}

  async save(entity: EnrollmentEntity): Promise<EnrollmentEntity> {
    return this.repo.save(entity);
  }

  async findOneById(id: number): Promise<EnrollmentEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByClassCode(classCode: string): Promise<EnrollmentEntity[]> {
    return this.repo.find({
      where: { classCode },
      order: { enrolledAt: 'ASC' },
    });
  }

  async findByStudentCode(studentCode: string): Promise<EnrollmentEntity[]> {
    return this.repo.find({
      where: { studentCode },
      order: { enrolledAt: 'DESC' },
    });
  }

  async findByClassAndStudent(
    classCode: string,
    studentCode: string,
  ): Promise<EnrollmentEntity | null> {
    return this.repo.findOne({ where: { classCode, studentCode } });
  }

  async countActiveByClassCode(classCode: string): Promise<number> {
    return this.repo.count({
      where: { classCode, status: EnrollmentStatus.ACTIVE },
    });
  }

  async findActiveByClassAndStudentCodes(
    classCode: string,
    studentCodes: string[],
  ): Promise<EnrollmentEntity[]> {
    return this.repo.find({
      where: {
        classCode,
        studentCode: In(studentCodes),
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }
}
