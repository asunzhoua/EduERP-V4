import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractRepository } from './contract.repository';
import { ContractCodeGeneratorService } from './contract-code-generator.service';
import { ContractEntity } from './contract.entity';
import { DataScopeModule } from '@common/services/data-scope.module';

@Module({
  imports: [TypeOrmModule.forFeature([ContractEntity]), DataScopeModule],
  controllers: [ContractController],
  providers: [
    ContractService,
    ContractRepository,
    ContractCodeGeneratorService,
  ],
  exports: [ContractService, ContractRepository],
})
export class ContractModule {}
