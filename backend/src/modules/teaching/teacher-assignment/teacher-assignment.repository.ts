import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TeacherAssignmentEntity } from './teacher-assignment.entity';
import { TeacherRole } from '@common/enums/teacher-role.enum';

@Injectable()
export class TeacherAssignmentRepository {
  constructor(
    @InjectRepository(TeacherAssignmentEntity)
    private readonly repo: Repository<TeacherAssignmentEntity>,
  ) {}

  async save(
    entity: TeacherAssignmentEntity,
  ): Promise<TeacherAssignmentEntity> {
    return this.repo.save(entity);
  }

  async findByClass(classCode: string): Promise<TeacherAssignmentEntity[]> {
    return this.repo.find({
      where: { classCode },
      order: { createTime: 'ASC' },
    });
  }

  async findActiveByClass(
    classCode: string,
  ): Promise<TeacherAssignmentEntity[]> {
    return this.repo
      .createQueryBuilder('ta')
      .where('ta.classCode = :classCode', { classCode })
      .andWhere('ta.effectiveTo IS NULL')
      .orderBy('ta.createTime', 'ASC')
      .getMany();
  }

  async findActivePrimary(
    classCode: string,
  ): Promise<TeacherAssignmentEntity | null> {
    return this.repo.findOne({
      where: {
        classCode,
        role: TeacherRole.PRIMARY,
        effectiveTo: IsNull(),
      },
    });
  }

  async findActiveByClassAndTeacher(
    classCode: string,
    teacherId: number,
  ): Promise<TeacherAssignmentEntity | null> {
    return this.repo.findOne({
      where: { classCode, teacherId, effectiveTo: IsNull() },
    });
  }

  async countActivePrimary(classCode: string): Promise<number> {
    return this.repo.count({
      where: {
        classCode,
        role: TeacherRole.PRIMARY,
        effectiveTo: IsNull(),
      },
    });
  }

  async endAssignment(id: number, effectiveTo: string): Promise<void> {
    await this.repo.update(id, { effectiveTo });
  }
}
