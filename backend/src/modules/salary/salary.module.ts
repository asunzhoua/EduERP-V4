import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SalaryRuleEntity } from './entities/salary-rule.entity';
import { SalaryRecordEntity } from './entities/salary-record.entity';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { SalaryCalculator } from './services/salary-calculator.service';
import { SalaryListener } from './listeners/salary.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalaryRuleEntity, SalaryRecordEntity]),
    EventEmitterModule,
  ],
  controllers: [SalaryController],
  providers: [SalaryService, SalaryCalculator, SalaryListener],
  exports: [SalaryService, SalaryCalculator],
})
export class SalaryModule {}
