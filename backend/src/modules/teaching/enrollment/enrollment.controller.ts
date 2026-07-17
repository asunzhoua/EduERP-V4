import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotImplementedException } from '@nestjs/common';

@ApiTags('Enrollment')
@ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentController {
  @Post()
  @ApiOperation({ summary: 'Enroll a student in a class' })
  enroll() {
    throw new NotImplementedException();
  }

  @Get()
  @ApiOperation({ summary: 'List all enrollments (paginated, filterable)' })
  findAll() {
    throw new NotImplementedException();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get enrollment by id' })
  findOne(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw enrollment (ACTIVE → WITHDRAWN)' })
  withdraw(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Get('classes/:code/enrollments')
  @ApiOperation({ summary: 'List enrollments for a class' })
  findByClass(@Param('code') _code: string) {
    throw new NotImplementedException();
  }

  @Get('students/:studentCode/enrollments')
  @ApiOperation({ summary: 'List enrollments for a student' })
  findByStudent(@Param('studentCode') _studentCode: string) {
    throw new NotImplementedException();
  }
}
