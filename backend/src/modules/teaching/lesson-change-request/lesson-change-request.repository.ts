import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonChangeRequestEntity } from './lesson-change-request.entity';
import { ChangeRequestType } from '@common/enums/change-request-type.enum';
import { ChangeRequestStatus } from './enums/change-request-status.enum';

@Injectable()
export class LessonChangeRequestRepository {
  constructor(
    @InjectRepository(LessonChangeRequestEntity)
    private readonly repo: Repository<LessonChangeRequestEntity>,
  ) {}

  async save(
    entity: LessonChangeRequestEntity,
  ): Promise<LessonChangeRequestEntity> {
    return this.repo.save(entity);
  }

  async findOneById(id: number): Promise<LessonChangeRequestEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByLessonId(lessonId: number): Promise<LessonChangeRequestEntity[]> {
    return this.repo.find({
      where: { lessonId },
      order: { createdAt: 'DESC' },
    });
  }

  async countPendingByLessonAndType(
    lessonId: number,
    requestType: ChangeRequestType,
  ): Promise<number> {
    return this.repo.count({
      where: {
        lessonId,
        requestType,
        status: ChangeRequestStatus.PENDING,
      },
    });
  }

  async countRescheduleByLessonId(lessonId: number): Promise<number> {
    return this.repo.count({
      where: {
        lessonId,
        requestType: ChangeRequestType.RESCHEDULE,
      },
    });
  }
}
