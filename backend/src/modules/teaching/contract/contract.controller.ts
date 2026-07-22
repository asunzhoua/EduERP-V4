import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Logger,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateContractInput } from './contract.service';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';

@ApiTags('Contract')
@ApiBearerAuth()
@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  private readonly logger = new Logger(ContractController.name);

  constructor(private readonly contractService: ContractService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new contract' })
  create(@Body() dto: CreateContractDto) {
    this.logger.log(`Creating contract for student: ${dto.studentCode}`);

    const input: CreateContractInput = {
      studentCode: dto.studentCode,
      subject: dto.subject,
      totalLessons: dto.totalLessons,
      validFrom: dto.validFrom,
      validTo: dto.validTo ?? null,
      unitPrice: dto.unitPrice ?? null,
      totalAmount: dto.totalAmount ?? null,
      note: dto.note ?? null,
      tags: dto.tags ?? null,
    };

    return this.contractService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List all contracts (paginated, filterable)' })
  findAll() {
    return [];
  }

  @Get('students/:studentCode/contracts')
  @ApiParam({ name: 'studentCode', description: '学生编号' })
  @ApiOperation({ summary: 'Get all contracts for a student' })
  findByStudentCode(@Param('studentCode') studentCode: string) {
    return this.contractService.findByStudentCode(studentCode);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get contract by contractCode' })
  findOneByCode(@Param('code') code: string) {
    return this.contractService.findOneByCode(code);
  }

  @Patch(':code/freeze')
  @ApiOperation({ summary: 'Freeze contract (stop deductions)' })
  freeze(@Param('code') code: string, @Req() req: any) {
    const operatorId = req.user.sub;
    return this.contractService.freeze(code, operatorId);
  }

  @Patch(':code/unfreeze')
  @ApiOperation({ summary: 'Unfreeze contract (resume deductions)' })
  unfreeze(@Param('code') code: string, @Req() req: any) {
    const operatorId = req.user.sub;
    return this.contractService.unfreeze(code, operatorId);
  }
}
