import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClassController } from './class.controller';
import { ClassService } from './class.service';
import { ClassRepository } from './class.repository';
import { ClassCodeGeneratorService } from './class-code-generator.service';
import { ClassEntity } from './class.entity';
import { TeacherAssignmentModule } from '../teacher-assignment/teacher-assignment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClassEntity]),
    EventEmitterModule,
    TeacherAssignmentModule,
  ],
  controllers: [ClassController],
  providers: [ClassService, ClassRepository, ClassCodeGeneratorService],
  exports: [ClassService, ClassRepository],
})
export class ClassModule {}
