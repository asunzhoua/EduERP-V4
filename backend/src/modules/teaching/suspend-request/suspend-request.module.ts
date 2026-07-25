import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuspendRequestController } from './suspend-request.controller';
import { SuspendRequestService } from './suspend-request.service';
import { SuspendRequestRepository } from './suspend-request.repository';
import { SuspendRequestEntity } from './suspend-request.entity';
import { StudentModule } from '@modules/student/student.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { ContractModule } from '../contract/contract.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SuspendRequestEntity]),
    StudentModule,
    EnrollmentModule,
    ContractModule,
  ],
  controllers: [SuspendRequestController],
  providers: [SuspendRequestService, SuspendRequestRepository],
  exports: [SuspendRequestService, SuspendRequestRepository],
})
export class SuspendRequestModule {}
