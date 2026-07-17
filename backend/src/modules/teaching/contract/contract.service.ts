import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ContractRepository } from './contract.repository';
import { ContractCodeGeneratorService } from './contract-code-generator.service';
import { ContractEntity } from './contract.entity';
import { ContractStatus } from './enums/contract-status.enum';
import { Subject } from '@common/enums/subject.enum';

/** Allowed status transitions per ContractStateMachine */
const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.ACTIVE]: [ContractStatus.FROZEN, ContractStatus.REFUNDED],
  [ContractStatus.EXHAUSTED]: [ContractStatus.REFUNDED],
  [ContractStatus.EXPIRED]: [ContractStatus.REFUNDED],
  [ContractStatus.FROZEN]: [ContractStatus.ACTIVE, ContractStatus.REFUNDED],
  [ContractStatus.REFUNDED]: [],
};

/** Input for creating a Contract. */
export interface CreateContractInput {
  studentCode: string;
  subject: Subject;
  totalLessons: number;
  validFrom: string;
  validTo?: string | null;
  unitPrice?: number | null;
  totalAmount?: number | null;
  note?: string | null;
  tags?: string[] | null;
}

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    private readonly contractRepo: ContractRepository,
    private readonly codeGenerator: ContractCodeGeneratorService,
  ) {}

  // ─── Create ───

  async create(input: CreateContractInput): Promise<ContractEntity> {
    if (input.totalLessons <= 0) {
      throw new BadRequestException('totalLessons must be greater than 0');
    }

    const contract = new ContractEntity();
    contract.contractCode = await this.codeGenerator.generateContractCode();
    contract.studentCode = input.studentCode;
    contract.subject = input.subject;
    contract.totalLessons = input.totalLessons;
    contract.remainingLessons = input.totalLessons; // starts equal
    contract.status = ContractStatus.ACTIVE;
    contract.validFrom = input.validFrom;
    contract.validTo = input.validTo ?? null;
    contract.unitPrice = input.unitPrice ?? null;
    contract.totalAmount = input.totalAmount ?? null;
    contract.note = input.note ?? null;
    contract.tags = input.tags ?? null;
    contract.createdBy = 0;

    const saved = await this.contractRepo.save(contract);
    this.logger.log(
      `Contract created: code=${saved.contractCode}, student=${saved.studentCode}, lessons=${saved.totalLessons}`,
    );
    return saved;
  }

  // ─── Read ───

  async findOne(id: number): Promise<ContractEntity> {
    const contract = await this.contractRepo.findOneById(id);
    if (!contract) {
      throw new NotFoundException(`Contract not found: id=${id}`);
    }
    return contract;
  }

  async findOneByCode(contractCode: string): Promise<ContractEntity> {
    const contract = await this.contractRepo.findOneByCode(contractCode);
    if (!contract) {
      throw new NotFoundException(`Contract not found: code=${contractCode}`);
    }
    return contract;
  }

  async findByStudentCode(studentCode: string): Promise<ContractEntity[]> {
    return this.contractRepo.findByStudentCode(studentCode);
  }

  // ─── Status Transitions ───

  async freeze(
    contractCode: string,
    operatedBy: number,
    reason?: string,
  ): Promise<ContractEntity> {
    return this.updateStatus(
      contractCode,
      ContractStatus.FROZEN,
      operatedBy,
      reason,
    );
  }

  async unfreeze(
    contractCode: string,
    operatedBy: number,
  ): Promise<ContractEntity> {
    return this.updateStatus(contractCode, ContractStatus.ACTIVE, operatedBy);
  }

  private async updateStatus(
    contractCode: string,
    targetStatus: ContractStatus,
    operatedBy: number,
    reason?: string,
  ): Promise<ContractEntity> {
    const contract = await this.findOneByCode(contractCode);

    if (contract.status === targetStatus) {
      throw new BadRequestException(
        `Contract is already in status: ${targetStatus}`,
      );
    }

    const allowed = VALID_TRANSITIONS[contract.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${contract.status} -> ${targetStatus}. ` +
          `Allowed from ${contract.status}: ${allowed.join(', ') || 'none'}`,
      );
    }

    // Guard: FROZEN requires reason
    if (targetStatus === ContractStatus.FROZEN) {
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException('Reason required to freeze contract');
      }
    }

    const oldStatus = contract.status;
    contract.status = targetStatus;

    const saved = await this.contractRepo.save(contract);

    this.logger.log(
      `Contract status changed: code=${contractCode} ${oldStatus} -> ${targetStatus}`,
    );
    return saved;
  }
}
