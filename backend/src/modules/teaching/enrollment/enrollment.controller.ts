import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EnrollmentService } from './enrollment.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { WithdrawEnrollmentDto } from './dto/withdraw-enrollment.dto';
import { ApiResponse } from '@common/dto/api-response';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Enrollment')
@ApiBearerAuth()
@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post()
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Enroll a student in a class' })
  async enroll(@Body() body: CreateEnrollmentDto) {
    const result = await this.enrollmentService.enroll({
      classCode: body.classCode,
      studentCode: body.studentCode,
      contractCode: body.contractCode,
    });
    return ApiResponse.success(result, 'Student enrolled');
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'List all enrollments (paginated, filterable)' })
  async findAll(@Query() query: QueryEnrollmentDto) {
    const result = await this.enrollmentService.findAll({
      classCode: query.classCode,
      studentCode: query.studentCode,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return ApiResponse.success(result);
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Get enrollment by id' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const result = await this.enrollmentService.findOne(id);
    return ApiResponse.success(result);
  }

  @Post(':id/withdraw')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Withdraw enrollment (ACTIVE → WITHDRAWN)' })
  async withdraw(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: WithdrawEnrollmentDto,
    @Req() req: any,
  ) {
    const operatorId = req.user.sub;
    const result = await this.enrollmentService.withdraw(id, body.reason, operatorId);
    return ApiResponse.success(result, 'Enrollment withdrawn');
  }

  @Get('classes/:code/enrollments')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'List enrollments for a class' })
  async findByClass(@Param('code') code: string) {
    const result = await this.enrollmentService.findByClassCode(code);
    return ApiResponse.success(result);
  }

  @Get('students/:studentCode/enrollments')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  @ApiOperation({ summary: 'List enrollments for a student (enriched)' })
  async findByStudent(@Param('studentCode') studentCode: string) {
    const result = await this.enrollmentService.findByStudentCode(studentCode);
    return ApiResponse.success(result);
  }
}