import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsAccount } from './points-account.entity';
import { PointsTransaction } from './points-transaction.entity';
import { PointsService } from './points.service';
import { AdminPointsRewardController } from './admin-points-reward.controller';
import { PointsProduct } from '@modules/admin/entities/points-product.entity';
import { PointsExchangeRecord } from '@modules/admin/entities/points-exchange-record.entity';
import { ReminderModule } from '@modules/reminder/reminder.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PointsAccount,
      PointsTransaction,
      PointsProduct,
      PointsExchangeRecord,
    ]),
    ReminderModule,
  ],
  controllers: [AdminPointsRewardController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
