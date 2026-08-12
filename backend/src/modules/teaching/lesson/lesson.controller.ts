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
import { LessonService } from './lesson.service';
import { LessonRepository } from './lesson.repository';
import { CancelLessonDto } from './dto/cancel-lesson.dto';
import { CreateMakeupDto } from './dto/create-makeup.dto';
import { CreateLessonWithAttendanceDto } from './dto/create-lesson-with-attendance.dto';
import { GenerateLessonsDto } from './dto/generate-lessons.dto';
import { LessonStatus } from './enums/lesson-status.enum';
import { ClassService } from '../class/class.service';
import {
  LessonAttendanceService,
  RecordAttendanceInput,
} from '../lesson-attendance/lesson-attendance.service';
import { AttendanceSource } from '../lesson-attendance/enums/attendance-source.enum';
import { TeacherRole } from '@common/enums/teacher-role.enum';
import { ApiResponse } from '@common/dto/api-response';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('Lesson')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonController {
  constructor(
    private readonly lessonService: LessonService,
    private readonly lessonRepo: LessonRepository,
    private readonly classService: ClassService,
    private readonly lessonAttendanceService: LessonAttendanceService,
  ) {}

  @Get('classes/:code/lessons')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'List lessons for a class (paginated)' })
  async findByClass(@Param('code') code: string) {
    const result = await this.lessonService.findByClassCode(code);
    return ApiResponse.success(result);
  }

  @Get('classes/:code/lessons/:lessonNumber')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  @ApiOperation({ summary: 'Get lesson by classCode + lessonNumber' })
  async findOne(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
  ) {
    const result = await this.lessonService.findByClassCodeAndLessonNumber(
      code,
      lessonNumber,
    );
    return ApiResponse.success(result);
  }

  @Patch('classes/:code/lessons/:lessonNumber/start')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Mark lesson as TEACHING (in progress)' })
  async start(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
    @Req() req: AuthedRequest,
  ) {
    const lesson = await this.lessonService.findByClassCodeAndLessonNumber(
      code,
      lessonNumber,
    );
    const operatorId = req.user.sub;
    const result = await this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.TEACHING,
      operatorId,
    );
    return ApiResponse.success(result, 'Lesson started');
  }

  @Patch('classes/:code/lessons/:lessonNumber/complete')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({
    summary: 'Complete lesson into FINISHED + emit LessonCompleted',
  })
  async complete(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
    @Req() req: AuthedRequest,
  ) {
    const lesson = await this.lessonService.findByClassCodeAndLessonNumber(
      code,
      lessonNumber,
    );
    const operatorId = req.user.sub;
    const result = await this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.FINISHED,
      operatorId,
    );
    return ApiResponse.success(result, 'Lesson completed');
  }

  @Patch('classes/:code/lessons/:lessonNumber/confirm')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({
    summary: 'Confirm lesson into ARCHIVED + emit LessonFinished',
  })
  async confirm(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
    @Req() req: AuthedRequest,
  ) {
    const lesson = await this.lessonService.findByClassCodeAndLessonNumber(
      code,
      lessonNumber,
    );
    const operatorId = req.user.sub;
    const result = await this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.ARCHIVED,
      operatorId,
    );
    return ApiResponse.success(result, 'Lesson confirmed');
  }

  @Patch('classes/:code/lessons/:lessonNumber/cancel')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Cancel lesson (requires reason)' })
  async cancel(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
    @Body() body: CancelLessonDto,
    @Req() req: AuthedRequest,
  ) {
    const lesson = await this.lessonService.findByClassCodeAndLessonNumber(
      code,
      lessonNumber,
    );
    const operatorId = req.user.sub;
    const result = await this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.CANCELLED,
      operatorId,
      body.reason,
    );

    // Phase 2 Batch 2.1: Cleanup attendance records and rollback deductions
    const attendanceResult =
      await this.lessonAttendanceService.cancelByLessonId(lesson.id);

    return ApiResponse.success(
      { lesson: result, attendanceCleanup: attendanceResult },
      'Lesson cancelled',
    );
  }

  @Post('classes/:code/lessons/makeup')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Create a makeup lesson' })
  async createMakeup(
    @Param('code') code: string,
    @Body() body: CreateMakeupDto,
    @Req() req: AuthedRequest,
  ) {
    const operatorId = req.user.sub;
    const result = await this.lessonService.create({
      classCode: code,
      courseCode: body.courseCode,
      lessonNumber: body.lessonNumber,
      scheduledDate: body.scheduledDate,
      startTime: body.startTime,
      endTime: body.endTime,
      teacherId: body.teacherId,
      isMakeup: true,
      originLessonId: body.originLessonId,
      createdBy: operatorId,
    });
    return ApiResponse.success(result, 'Makeup lesson created');
  }

  // ─── Create Lesson With Attendance ───

  @Post('lessons')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({
    summary: 'Create lesson with attendance records (auto lessonNumber)',
  })
  async createWithAttendance(
    @Body() dto: CreateLessonWithAttendanceDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    const operatorId = req.user.sub;

    // 1. Look up class for courseCode
    const cls = await this.classService.findByCode(dto.classCode);

    // 2. Get primary teacher from class assignments
    const teachers = await this.classService.getTeachers(dto.classCode);
    const primaryTeacher = teachers.find((t) => t.role === TeacherRole.PRIMARY);
    if (!primaryTeacher) {
      throw new BadRequestException(
        `No primary teacher assigned to class ${dto.classCode}`,
      );
    }

    // 3. Auto-calculate next lesson number
    const maxLessonNumber = await this.lessonRepo.findMaxLessonNumber(
      dto.classCode,
    );
    const lessonNumber = (maxLessonNumber ?? 0) + 1;

    // 4. Create the lesson entity (SCHEDULED so it can progress to TEACHING/FINISHED)
    const lesson = await this.lessonService.create({
      classCode: dto.classCode,
      courseCode: cls.courseCode,
      lessonNumber,
      scheduledDate: dto.lessonDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      teacherId: primaryTeacher.teacherId,
      topic: dto.topic,
      isMakeup: false,
      createdBy: operatorId,
      status: LessonStatus.SCHEDULED,
    });

    // 5. Auto-create PENDING attendance records for enrolled students
    const studentCodes = dto.attendanceRecords.map((r) => r.studentCode);
    await this.lessonAttendanceService.autoCreateForLesson(
      lesson.id,
      studentCodes,
      dto.classCode,
      primaryTeacher.teacherId,
    );

    // 6. Batch roll call — set actual attendance statuses
    const records: RecordAttendanceInput[] = dto.attendanceRecords.map((r) => ({
      lessonId: lesson.id,
      studentCode: r.studentCode,
      status: r.status,
      reason: r.reason,
      operator: operatorId,
      source: AttendanceSource.API,
    }));

    await this.lessonAttendanceService.batchRollCall({
      lessonId: lesson.id,
      records,
    });

    // 扣课提交即完成：转 FINISHED 才会被工资结算 settle() 计入
    const finished = await this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.FINISHED,
      operatorId,
    );

    return ApiResponse.success(
      {
        lesson: finished,
        lessonNumber,
        attendanceCount: dto.attendanceRecords.length,
      },
      'Lesson created with attendance',
    );
  }

  // ─── Batch Scheduling (P3-2: 一键排课) ───

  @Post('classes/:code/lessons/batch')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({
    summary: '按班级固定课表批量生成未来课时（一键排课）',
  })
  async generateClassLessons(
    @Param('code') code: string,
    @Body() dto: GenerateLessonsDto,
    @Req() req: AuthedRequest,
  ) {
    const operatorId = req.user.sub;

    // 确定任课教师：优先用前端传入，否则从班级主教师推断
    let teacherId = dto.teacherId;
    if (!teacherId) {
      const teachers = await this.classService.getTeachers(code);
      const primary = teachers.find((t) => t.role === TeacherRole.PRIMARY);
      if (!primary) {
        throw new BadRequestException(
          `班级 ${code} 未分配主教师，无法一键排课`,
        );
      }
      teacherId = primary.teacherId;
    }

    const result = await this.lessonService.generateClassLessons(
      code,
      {
        startDate: dto.startDate,
        count: dto.count,
        checkConflict: dto.checkConflict ?? false,
        teacherId,
      },
      operatorId,
    );
    return ApiResponse.success(result);
  }

  // NOTE: Change request and batch confirmation endpoints are temporarily
  // removed until their implementations are ready. This prevents misleading
  // Swagger documentation that suggests features that don't actually work.
  // When implementing, add these endpoints back with proper business logic.
}
