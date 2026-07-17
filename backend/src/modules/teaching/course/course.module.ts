import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { CourseRepository } from './course.repository';
import { CourseCodeGeneratorService } from './course-code-generator.service';
import { CourseEntity } from './course.entity';
import { CourseAuditLog } from './course-audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseEntity, CourseAuditLog]),
    EventEmitterModule,
  ],
  controllers: [CourseController],
  providers: [CourseService, CourseRepository, CourseCodeGeneratorService],
  exports: [CourseService, CourseRepository, CourseCodeGeneratorService],
})
export class CourseModule {}
