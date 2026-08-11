import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { CsvWriter } from './utils/csv-writer.util';
import { ExcelWriter } from './utils/excel-writer.util';
import { Student } from '../student/entities/student.entity';
import { LessonEntity } from '../teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '../teaching/lesson-attendance/lesson-attendance.entity';
import { ContractEntity } from '../teaching/contract/contract.entity';
import { SalaryRecordEntity } from '../salary/entities/salary-record.entity';
import { EnrollmentEntity } from '../teaching/enrollment/enrollment.entity';
import { User } from '../identity/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      LessonEntity,
      LessonAttendanceEntity,
      ContractEntity,
      SalaryRecordEntity,
      EnrollmentEntity,
      User,
    ]),
  ],
  controllers: [ExportController],
  providers: [ExportService, CsvWriter, ExcelWriter],
  exports: [ExportService, ExcelWriter],
})
export class ExportModule {}
