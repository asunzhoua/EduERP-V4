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
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LessonAttendanceService } from './lesson-attendance.service';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { BatchRollCallDto } from './dto/batch-roll-call.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { LessonRepository } from '../lesson/lesson.repository';
import { EnrollmentRepository } from '../enrollment/enrollment.repository';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';

@ApiTags('LessonAttendance')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonAttendanceController {
  constructor(
    private readonly attendanceService: LessonAttendanceService,
    private readonly lessonRepo: LessonRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
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
   * POST /classes/:code/attendance/batch
   *
   * Enhanced batch roll call by class code + date.
   * Supports LEAVE/SICK/MAKEUP attendance statuses.
   *
   * Flow:
   *   1. Find the lesson for the given classCode and date (default: today)
   *   2. Verify teacher is assigned to this class
   *   3. Validate all students are actively enrolled
   *   4. Record attendance via existing batchRollCall logic
   */
  @Post('classes/:code/attendance/batch')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({
    summary: 'Batch roll call by class code — supports LEAVE/SICK/MAKEUP',
  })
  async batchRollCallByClass(
    @Param('code') classCode: string,
    @Body() body: BatchRollCallDto & { lessonDate?: string },
    @Req() req: any,
  ): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    const date = body.lessonDate || new Date().toISOString().split('T')[0];

    // 1. Find lesson for this class on this date
    const lessons = await this.lessonRepo.findByClassCodeAndDate(classCode, date);
    if (lessons.length === 0) {
      throw new NotFoundException(
        `未找到班级 ${classCode} 在 ${date} 的课程`,
      );
    }

    // Use the first TEACHING or SCHEDULED lesson; prefer TEACHING
    const lesson = lessons.find(l => l.status === LessonStatus.TEACHING)
      || lessons.find(l => l.status === LessonStatus.SCHEDULED)
      || lessons[0];

    if (lesson.status !== LessonStatus.TEACHING && lesson.status !== LessonStatus.SCHEDULED) {
      throw new BadRequestException(
        `课程 ${lesson.id} 当前状态为 ${lesson.status}，无法签到`,
      );
    }

    // 2. Verify all students are enrolled
    const studentCodes = body.records.map(r => r.studentCode);
    const enrollments = await this.enrollmentRepo.findActiveByClassAndStudentCodes(
      classCode,
      studentCodes,
    );
    const enrolledSet = new Set(enrollments.map(e => e.studentCode));
    const unenrolled = studentCodes.filter(sc => !enrolledSet.has(sc));
    if (unenrolled.length > 0) {
      throw new BadRequestException(
        `以下学生未在班级 ${classCode} 中注册或状态不是 ACTIVE: ${unenrolled.join(', ')}`,
      );
    }

    // 3. Record attendance
    const records = body.records.map((r) => ({
      lessonId: lesson.id,
      studentCode: r.studentCode,
      status: r.status,
      reason: r.reason,
      operator: operatorId,
      note: r.note,
    }));

    const result = await this.attendanceService.batchRollCall({ lessonId: lesson.id, records });
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
