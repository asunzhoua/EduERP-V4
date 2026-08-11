import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryRuleEntity } from './entities/salary-rule.entity';
import { SalaryRecordEntity } from './entities/salary-record.entity';
import { TeacherSalaryProfileEntity } from './entities/teacher-salary-profile.entity';
import { OutingRecordEntity } from './entities/outing-record.entity';
import { SalaryTaxPolicyEntity } from './entities/salary-tax-policy.entity';
import { SalaryInsurancePolicyEntity } from './entities/salary-insurance-policy.entity';
import { SalarySlipEntity } from './entities/salary-slip.entity';
import { SalaryPayrollEntity } from './entities/salary-payroll.entity';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { SalaryCalculator } from './services/salary-calculator.service';
import { SalarySettlementService } from './services/salary-settlement.service';
import { TaxPolicyService } from './services/tax-policy.service';
import { InsurancePolicyService } from './services/insurance-policy.service';
import { SalarySlipService } from './services/salary-slip.service';
import { SalaryPayrollService } from './services/salary-payroll.service';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { User } from '@modules/identity/entities/user.entity';
import { ExportModule } from '../export/export.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalaryRuleEntity,
      SalaryRecordEntity,
      TeacherSalaryProfileEntity,
      OutingRecordEntity,
      SalaryTaxPolicyEntity,
      SalaryInsurancePolicyEntity,
      SalarySlipEntity,
      SalaryPayrollEntity,
      LessonEntity,
      LessonAttendanceEntity,
      CourseEntity,
      User,
    ]),
    ExportModule,
  ],
  controllers: [SalaryController],
  providers: [
    SalaryService,
    SalaryCalculator,
    SalarySettlementService,
    TaxPolicyService,
    InsurancePolicyService,
    SalarySlipService,
    SalaryPayrollService,
  ],
  exports: [
    SalaryService,
    SalarySettlementService,
    TaxPolicyService,
    InsurancePolicyService,
    SalarySlipService,
    SalaryPayrollService,
  ],
})
export class SalaryModule {}
