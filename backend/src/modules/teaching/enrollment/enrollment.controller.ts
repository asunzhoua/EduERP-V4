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
import { ClassService } from '../class/class.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { WithdrawEnrollmentDto } from './dto/withdraw-enrollment.dto';
import { TransferEnrollmentDto } from './dto/transfer-enrollment.dto';
import { ApiResponse } from '@common/dto/api-response';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { DataScopeService } from '@common/services/data-scope.service';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('Enrollment')
@ApiBearerAuth()
@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(
    private readonly enrollmentService: EnrollmentService,
    private readonly dataScopeService: DataScopeService,
    private readonly classService: ClassService,
  ) {}

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Enroll a student in a class' })
  async enroll(@Body() body: CreateEnrollmentDto, @Req() req: AuthedRequest) {
    // Teacher 只能给自己 PRIMARY 的班级添加学生
    if (req.user.role === 'Teacher') {
      await this.classService.assertPrimaryTeacher(
        body.classCode,
        Number(req.user.sub),
      );
    }
    const result = await this.enrollmentService.enroll({
      classCode: body.classCode,
      studentCode: body.studentCode,
      contractCode: body.contractCode,
      operatedBy: req.user.sub,
    });
    return ApiResponse.success(result, 'Student enrolled');
  }

  @Get('candidates')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({
    summary: 'Candidate students for adding to a class (teacher-owned)',
  })
  async candidates(
    @Query('classCode') classCode: string | undefined,
    @Query('keyword') keyword: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const teacherId =
      req.user.role === 'Teacher' ? Number(req.user.sub) : undefined;
    const result = await this.enrollmentService.findCandidates({
      teacherId,
      classCode,
      keyword,
    });
    return ApiResponse.success(result);
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
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Withdraw enrollment (ACTIVE → WITHDRAWN)' })
  async withdraw(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: WithdrawEnrollmentDto,
    @Req() req: AuthedRequest,
  ) {
    // Teacher 只能退自己 PRIMARY 班级的学生
    if (req.user.role === 'Teacher') {
      const enrollment = await this.enrollmentService.findOne(id);
      await this.classService.assertPrimaryTeacher(
        enrollment.classCode,
        Number(req.user.sub),
      );
    }
    const operatorId = req.user.sub;
    const result = await this.enrollmentService.withdraw(
      id,
      body.reason,
      operatorId,
    );
    return ApiResponse.success(result, 'Enrollment withdrawn');
  }

  @Post(':id/transfer')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Transfer enrollment to another class (换班/升班)' })
  async transfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TransferEnrollmentDto,
    @Req() req: AuthedRequest,
  ) {
    const result = await this.enrollmentService.transfer(
      id,
      body.targetClassCode,
      body.reason,
      req.user.sub,
    );
    return ApiResponse.success(result, '调班成功');
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
  async findByStudent(
    @Param('studentCode') studentCode: string,
    @Req() req: AuthedRequest,
  ) {
    // V-03 修复: 验证当前用户是否有权访问该学生的报名记录
    await this.dataScopeService.verifyStudentAccess(req.user, studentCode);

    const result = await this.enrollmentService.findByStudentCode(studentCode);
    return ApiResponse.success(result);
  }
}
