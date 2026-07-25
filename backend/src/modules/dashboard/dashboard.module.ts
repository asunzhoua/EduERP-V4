// ---------------------------------------------------------------------------
// DashboardModule
// Phase 2 — Aggregation queries over existing business entities.
// Phase 3 will add DashboardController for the REST API.
// ---------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

// Entities consumed by DashboardService
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { Student } from '@modules/student/entities/student.entity';
import { ContractEntity } from '@modules/teaching/contract/contract.entity';
import { LessonExceptionEntity } from '@modules/teaching/lesson/lesson-exception/lesson-exception.entity';
import { SalaryRecordEntity } from '@modules/salary/entities/salary-record.entity';
import { User } from '@modules/identity/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonEntity,
      Student,
      ContractEntity,
      LessonExceptionEntity,
      SalaryRecordEntity,
      User,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
