import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentRepository } from './enrollment.repository';
import { EnrollmentEntity } from './enrollment.entity';
import { ContractModule } from '../contract/contract.module';
import { StudentModule } from '../../student/student.module';

@Module({
  imports: [TypeOrmModule.forFeature([EnrollmentEntity]), ContractModule, StudentModule],
  controllers: [EnrollmentController],
  providers: [EnrollmentService, EnrollmentRepository],
  exports: [EnrollmentService, EnrollmentRepository],
})
export class EnrollmentModule {}
