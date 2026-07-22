import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LessonAttendanceService } from './lesson-attendance.service';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { BatchRollCallDto } from './dto/batch-roll-call.dto';

@ApiTags('LessonAttendance')
@ApiBearerAuth()
@Controller()
export class LessonAttendanceController {
  constructor(
    private readonly attendanceService: LessonAttendanceService,
  ) {}

  @Post('lessons/:id/attendance')
  @ApiOperation({
    summary: 'Batch roll call — record attendance for all students',
  })
  async batchRollCall(
    @Param('id', ParseIntPipe) lessonId: number,
    @Body() body: BatchRollCallDto,
    @Req() req: any,
  ): Promise<LessonAttendanceEntity[]> {
    const operatorId = req.user.sub;
    const records = body.records.map((r) => ({
      lessonId,
      studentCode: r.studentCode,
      status: r.status,
      reason: r.reason,
      operator: operatorId,
      note: r.note,
    }));

    return this.attendanceService.batchRollCall({ lessonId, records });
  }

  /**
   * POST /lessons/:id/attendance/confirm must come BEFORE
   * PATCH /lessons/:id/attendance/:studentCode to avoid "confirm"
   * being matched as :studentCode by NestJS route resolution.
   */
  @Post('lessons/:id/attendance/confirm')
  @ApiOperation({
    summary: 'Confirm all attendance for a lesson (CHECKED_IN → CONFIRMED)',
  })
  async confirmAll(
    @Param('id', ParseIntPipe) lessonId: number,
    @Req() req: any,
  ): Promise<LessonAttendanceEntity[]> {
    return this.attendanceService.confirmAll(lessonId, req.user.sub);
  }

  @Patch('lessons/:id/attendance/:studentCode')
  @ApiOperation({ summary: 'Update attendance for a single student' })
  async updateAttendance(
    @Param('id', ParseIntPipe) lessonId: number,
    @Param('studentCode') studentCode: string,
    @Body()
    body: { status: AttendanceStatus; reason?: string; note?: string },
    @Req() req: any,
  ): Promise<LessonAttendanceEntity> {
    return this.attendanceService.recordAttendance({
      lessonId,
      studentCode,
      status: body.status,
      reason: body.reason,
      operator: req.user.sub,
      note: body.note,
    });
  }

  @Get('lessons/:id/attendance')
  @ApiOperation({ summary: 'List attendance records for a lesson' })
  async findByLesson(
    @Param('id', ParseIntPipe) lessonId: number,
  ): Promise<LessonAttendanceEntity[]> {
    return this.attendanceService.findByLessonId(lessonId);
  }

  @Get('students/:studentCode/attendance')
  @ApiOperation({ summary: 'Student attendance history' })
  async findByStudent(
    @Param('studentCode') studentCode: string,
  ): Promise<LessonAttendanceEntity[]> {
    return this.attendanceService.findByStudentCode(studentCode);
  }
}
