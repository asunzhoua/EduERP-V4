import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import { AttendanceWorkflowState } from './enums/attendance-workflow-state.enum';

@Injectable()
export class LessonAttendanceRepository {
  constructor(
    @InjectRepository(LessonAttendanceEntity)
    private readonly repo: Repository<LessonAttendanceEntity>,
  ) {}

  async save(entity: LessonAttendanceEntity): Promise<LessonAttendanceEntity> {
    return this.repo.save(entity);
  }

  async saveAll(
    entities: LessonAttendanceEntity[],
  ): Promise<LessonAttendanceEntity[]> {
    return this.repo.save(entities);
  }

  async findOneById(id: number): Promise<LessonAttendanceEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByLessonId(lessonId: number): Promise<LessonAttendanceEntity[]> {
    return this.repo.find({
      where: { lessonId },
      order: { id: 'ASC' },
    });
  }

  async findByLessonAndStudent(
    lessonId: number,
    studentCode: string,
  ): Promise<LessonAttendanceEntity | null> {
    return this.repo.findOne({ where: { lessonId, studentCode } });
  }

  async findByStudentCode(
    studentCode: string,
  ): Promise<LessonAttendanceEntity[]> {
    return this.repo.find({
      where: { studentCode },
      order: { id: 'DESC' },
    });
  }

  async findByLessonIdAndStudentCodes(
    lessonId: number,
    studentCodes: string[],
  ): Promise<LessonAttendanceEntity[]> {
    return this.repo.find({
      where: {
        lessonId,
        studentCode: In(studentCodes),
      },
    });
  }

  async countPendingByLessonId(lessonId: number): Promise<number> {
    return this.repo.count({
      where: {
        lessonId,
        workflowState: AttendanceWorkflowState.PENDING,
      },
    });
  }

  async countUnconfirmedByLessonId(lessonId: number): Promise<number> {
    return this.repo
      .createQueryBuilder('a')
      .where('a.lessonId = :lessonId', { lessonId })
      .andWhere('a.workflowState NOT IN (:...states)', {
        states: [
          AttendanceWorkflowState.CONFIRMED,
          AttendanceWorkflowState.LOCKED,
        ],
      })
      .getCount();
  }
}
