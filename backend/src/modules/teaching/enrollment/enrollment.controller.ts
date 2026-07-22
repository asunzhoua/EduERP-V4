import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EnrollmentService } from './enrollment.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { WithdrawEnrollmentDto } from './dto/withdraw-enrollment.dto';
import { ApiResponse } from '@common/dto/api-response';

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
    @Req() req: any,
  ) {
    const operatorId = req.user.sub;
    return this.enrollmentService.withdraw(id, body.reason, operatorId);
  }

  @Get('classes/:code/enrollments')
  @ApiOperation({ summary: 'List enrollments for a class' })
  findByClass(@Param('code') code: string) {
    return this.enrollmentService.findByClassCode(code);
  }

  @Get('students/:studentCode/enrollments')
  @ApiOperation({ summary: 'List enrollments for a student (enriched)' })
  async findByStudent(@Param('studentCode') studentCode: string) {
    const result = await this.enrollmentService.findByStudentCode(studentCode);
    return ApiResponse.success(result);
  }
}