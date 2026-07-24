import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonChangeRequestController } from './lesson-change-request.controller';
import { LessonChangeRequestService } from './lesson-change-request.service';
import { LessonChangeRequestRepository } from './lesson-change-request.repository';
import { LessonChangeRequestEntity } from './lesson-change-request.entity';
import { LessonModule } from '../lesson/lesson.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LessonChangeRequestEntity]),
    forwardRef(() => LessonModule),
  ],
  controllers: [LessonChangeRequestController],
  providers: [LessonChangeRequestService, LessonChangeRequestRepository],
  exports: [LessonChangeRequestService, LessonChangeRequestRepository],
})
export class LessonChangeRequestModule {}
