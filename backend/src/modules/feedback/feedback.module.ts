import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonFeedback } from './lesson-feedback.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { User } from '@modules/identity/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonFeedback,
      LessonEntity,
      ClassEntity,
      CourseEntity,
      User,
    ]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
