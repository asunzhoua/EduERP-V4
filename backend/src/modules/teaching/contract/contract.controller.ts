import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Logger,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { CreateContractInput } from './contract.service';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';

@ApiTags('Contract')
@ApiBearerAuth()
@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  private readonly logger = new Logger(ContractController.name);

  constructor(private readonly contractService: ContractService) {}

  @Post()
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Create a new contract' })
  async create(@Body() dto: CreateContractDto) {
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

    const result = await this.contractService.create(input);
    return ApiResponse.success(result, 'Contract created');
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'List all contracts (paginated, filterable)' })
  async findAll(@Query() query: QueryContractDto) {
    const result = await this.contractService.findAll({
      studentCode: query.studentCode,
      subject: query.subject,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return ApiResponse.success(result);
  }

  @Get('students/:studentCode/contracts')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  @ApiParam({ name: 'studentCode', description: '学生编号' })
  @ApiOperation({ summary: 'Get all contracts for a student' })
  async findByStudentCode(@Param('studentCode') studentCode: string) {
    const result = await this.contractService.findByStudentCode(studentCode);
    return ApiResponse.success(result);
  }

  @Get(':code')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Get contract by contractCode' })
  async findOneByCode(@Param('code') code: string) {
    const result = await this.contractService.findOneByCode(code);
    return ApiResponse.success(result);
  }

  @Patch(':code/freeze')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Freeze contract (stop deductions)' })
  async freeze(@Param('code') code: string, @Req() req: any) {
    const operatorId = req.user.sub;
    const result = await this.contractService.freeze(code, operatorId);
    return ApiResponse.success(result, 'Contract frozen');
  }

  @Patch(':code/unfreeze')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Unfreeze contract (resume deductions)' })
  async unfreeze(@Param('code') code: string, @Req() req: any) {
    const operatorId = req.user.sub;
    const result = await this.contractService.unfreeze(code, operatorId);
    return ApiResponse.success(result, 'Contract unfrozen');
  }
}
