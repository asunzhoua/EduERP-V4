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
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';
import { LeaveRequestEntity } from '@modules/teaching/leave-request/leave-request.entity';
import { AdminModule } from '@modules/admin/admin.module';

@Module({
  imports: [
    AdminModule,
    TypeOrmModule.forFeature([
      LessonEntity,
      Student,
      ContractEntity,
      LessonExceptionEntity,
      SalaryRecordEntity,
      User,
      ClassEntity,
      LessonAttendanceEntity,
      EnrollmentEntity,
      LeaveRequestEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    // 可注入时钟：工作台窗口计算统一走 DASHBOARD_NOW（测试可固定 now）
    { provide: 'DASHBOARD_NOW', useValue: () => new Date() },
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
