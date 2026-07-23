import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LessonAttendanceService } from './lesson-attendance.service';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { BatchRollCallDto } from './dto/batch-roll-call.dto';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';

@ApiTags('LessonAttendance')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonAttendanceController {
  constructor(
    private readonly attendanceService: LessonAttendanceService,
  ) {}

  @Post('lessons/:id/attendance')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({
    summary: 'Batch roll call — record attendance for all students',
  })
  async batchRollCall(
    @Param('id', ParseIntPipe) lessonId: number,
    @Body() body: BatchRollCallDto,
    @Req() req: any,
  ): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    const records = body.records.map((r) => ({
      lessonId,
      studentCode: r.studentCode,
      status: r.status,
      reason: r.reason,
      operator: operatorId,
      note: r.note,
    }));

    const result = await this.attendanceService.batchRollCall({ lessonId, records });
    return ApiResponse.success(result, 'Attendance recorded');
  }

  /**
   * POST /lessons/:id/attendance/confirm must come BEFORE
   * PATCH /lessons/:id/attendance/:studentCode to avoid "confirm"
   * being matched as :studentCode by NestJS route resolution.
   */
  @Post('lessons/:id/attendance/confirm')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({
    summary: 'Confirm all attendance for a lesson (CHECKED_IN → CONFIRMED)',
  })
  async confirmAll(
    @Param('id', ParseIntPipe) lessonId: number,
    @Req() req: any,
  ): Promise<ApiResponse> {
    const result = await this.attendanceService.confirmAll(lessonId, req.user.sub);
    return ApiResponse.success(result, 'Attendance confirmed');
  }

  @Patch('lessons/:id/attendance/:studentCode')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Update attendance for a single student' })
  async updateAttendance(
    @Param('id', ParseIntPipe) lessonId: number,
    @Param('studentCode') studentCode: string,
    @Body()
    body: { status: AttendanceStatus; reason?: string; note?: string },
    @Req() req: any,
  ): Promise<ApiResponse> {
    const result = await this.attendanceService.recordAttendance({
      lessonId,
      studentCode,
      status: body.status,
      reason: body.reason,
      operator: req.user.sub,
      note: body.note,
    });
    return ApiResponse.success(result, 'Attendance updated');
  }

  @Get('lessons/:id/attendance')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  @ApiOperation({ summary: 'List attendance records for a lesson' })
  async findByLesson(
    @Param('id', ParseIntPipe) lessonId: number,
  ): Promise<ApiResponse> {
    const result = await this.attendanceService.findByLessonId(lessonId);
    return ApiResponse.success(result);
  }

  @Get('students/:studentCode/attendance')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  @ApiOperation({ summary: 'Student attendance history' })
  async findByStudent(
    @Param('studentCode') studentCode: string,
  ): Promise<ApiResponse> {
    const result = await this.attendanceService.findByStudentCode(studentCode);
    return ApiResponse.success(result);
  }
}
