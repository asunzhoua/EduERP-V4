import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { User } from '@modules/identity/entities/user.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { SalaryRecordEntity } from '@modules/salary/entities/salary-record.entity';
import { Setting } from './entities/setting.entity';
import { OperationLog } from './entities/operation-log.entity';
import { PointsProduct } from './entities/points-product.entity';
import { PointsExchangeRecord } from './entities/points-exchange-record.entity';
import { AdminTeachersService } from './admin-teachers.service';
import { AdminTeachersController } from './admin-teachers.controller';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { OperationLogsService } from './operation-logs.service';
import { OperationLogsController } from './operation-logs.controller';
import { OperationLogInterceptor } from './operation-log.interceptor';
import { PointsMallService } from './points-mall.service';
import { PointsMallController } from './points-mall.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      LessonEntity,
      SalaryRecordEntity,
      Setting,
      OperationLog,
      PointsProduct,
      PointsExchangeRecord,
    ]),
  ],
  controllers: [
    AdminTeachersController,
    SettingsController,
    OperationLogsController,
    PointsMallController,
  ],
  providers: [
    AdminTeachersService,
    SettingsService,
    OperationLogsService,
    PointsMallService,
    // 全局操作日志拦截器（记录所有已认证用户的写操作）
    { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
  ],
  exports: [PointsMallService],
})
export class AdminModule {}
