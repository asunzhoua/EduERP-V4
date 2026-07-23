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

  /**
   * Batch: find active PRIMARY assignments for multiple class codes.
   * Eliminates N+1 pattern in class enrichment queries.
   */
  async findActivePrimaryByClassCodes(
    classCodes: string[],
  ): Promise<TeacherAssignmentEntity[]> {
    if (classCodes.length === 0) return [];
    return this.repo
      .createQueryBuilder('ta')
      .where('ta.classCode IN (:...classCodes)', { classCodes })
      .andWhere('ta.role = :role', { role: TeacherRole.PRIMARY })
      .andWhere('ta.effectiveTo IS NULL')
      .getMany();
  }

  /** Create a new TeacherAssignment entity (factory method). */
  create(data: Partial<TeacherAssignmentEntity>): TeacherAssignmentEntity {
    return this.repo.create(data);
  }

  /** Find all assignments ordered by createTime DESC. */
  async findAll(): Promise<TeacherAssignmentEntity[]> {
    return this.repo.find({ order: { createTime: 'DESC' } });
  }
}
