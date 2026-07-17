import { Controller, Get, Post, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotImplementedException } from '@nestjs/common';

@ApiTags('Contract')
@ApiBearerAuth()
@Controller('contracts')
export class ContractController {
  @Post()
  @ApiOperation({ summary: 'Create a new contract' })
  create() {
    throw new NotImplementedException();
  }

  @Get()
  @ApiOperation({ summary: 'List all contracts (paginated, filterable)' })
  findAll() {
    throw new NotImplementedException();
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get contract by contractCode' })
  findOne(@Param('code') _code: string) {
    throw new NotImplementedException();
  }

  @Patch(':code/freeze')
  @ApiOperation({ summary: 'Freeze contract (stop deductions)' })
  freeze(@Param('code') _code: string) {
    throw new NotImplementedException();
  }

  @Patch(':code/unfreeze')
  @ApiOperation({ summary: 'Unfreeze contract (resume deductions)' })
  unfreeze(@Param('code') _code: string) {
    throw new NotImplementedException();
  }

  @Get('students/:studentCode/contracts')
  @ApiOperation({ summary: 'Get all contracts for a student' })
  getStudentContracts(@Param('studentCode') _studentCode: string) {
    throw new NotImplementedException();
  }
}
