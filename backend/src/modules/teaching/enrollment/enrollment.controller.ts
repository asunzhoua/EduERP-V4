import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EnrollmentService } from './enrollment.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { WithdrawEnrollmentDto } from './dto/withdraw-enrollment.dto';

@ApiTags('Enrollment')
@ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post()
  @ApiOperation({ summary: 'Enroll a student in a class' })
  enroll(@Body() body: CreateEnrollmentDto) {
    return this.enrollmentService.enroll({
      classCode: body.classCode,
      studentCode: body.studentCode,
      contractCode: body.contractCode,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all enrollments (paginated, filterable)' })
  findAll() {
    // Service does not have findAll method
    // Return empty array for now, or could throw NotImplementedException
    return [];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get enrollment by id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.enrollmentService.findOne(id);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw enrollment (ACTIVE → WITHDRAWN)' })
  withdraw(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: WithdrawEnrollmentDto,
  ) {
    const operatedBy = 0; // TODO: Get from JWT when auth is implemented
    return this.enrollmentService.withdraw(id, body.reason, operatedBy);
  }

  @Get('classes/:code/enrollments')
  @ApiOperation({ summary: 'List enrollments for a class' })
  findByClass(@Param('code') code: string) {
    return this.enrollmentService.findByClassCode(code);
  }

  @Get('students/:studentCode/enrollments')
  @ApiOperation({ summary: 'List enrollments for a student' })
  findByStudent(@Param('studentCode') studentCode: string) {
    return this.enrollmentService.findByStudentCode(studentCode);
  }
}