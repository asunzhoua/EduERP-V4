import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryRuleEntity } from './entities/salary-rule.entity';
import { SalaryRecordEntity } from './entities/salary-record.entity';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { SalaryCalculator } from './services/salary-calculator.service';
import { SalarySettlementService } from './services/salary-settlement.service';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalaryRuleEntity,
      SalaryRecordEntity,
      LessonEntity,
      LessonAttendanceEntity,
      CourseEntity,
    ]),
  ],
  controllers: [SalaryController],
  providers: [SalaryService, SalaryCalculator, SalarySettlementService],
  exports: [SalaryService, SalarySettlementService],
})
export class SalaryModule {}
