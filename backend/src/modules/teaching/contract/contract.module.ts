import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractRepository } from './contract.repository';
import { ContractCodeGeneratorService } from './contract-code-generator.service';
import { ContractEntity } from './contract.entity';
import { LessonAdjustmentAudit } from './entities/lesson-adjustment-audit.entity';
import { LessonAuditController } from './lesson-audit.controller';
import { ImportService } from '@utils/services/import.service';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { Student } from '@modules/student/entities/student.entity';
import { DataScopeModule } from '@common/services/data-scope.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractEntity,
      LessonAdjustmentAudit,
      LessonAttendanceEntity,
      LessonEntity,
      CourseEntity,
      Student,
    ]),
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
    DataScopeModule,
  ],
  controllers: [ContractController, LessonAuditController],
  providers: [
    ContractService,
    ContractRepository,
    ContractCodeGeneratorService,
    ImportService,
  ],
  exports: [ContractService, ContractRepository],
})
export class ContractModule {}
