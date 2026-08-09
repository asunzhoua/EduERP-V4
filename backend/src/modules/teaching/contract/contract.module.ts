import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractRepository } from './contract.repository';
import { ContractCodeGeneratorService } from './contract-code-generator.service';
import { ContractEntity } from './contract.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { Student } from '@modules/student/entities/student.entity';
import { DataScopeModule } from '@common/services/data-scope.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractEntity,
      LessonAttendanceEntity,
      LessonEntity,
      CourseEntity,
      Student,
    ]),
    DataScopeModule,
  ],
  controllers: [ContractController],
  providers: [
    ContractService,
    ContractRepository,
    ContractCodeGeneratorService,
  ],
  exports: [ContractService, ContractRepository],
})
export class ContractModule {}
