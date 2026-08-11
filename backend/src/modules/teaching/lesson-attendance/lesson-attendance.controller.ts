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
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { LessonAttendanceService } from './lesson-attendance.service';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { BatchRollCallDto } from './dto/batch-roll-call.dto';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { LessonRepository } from '../lesson/lesson.repository';
import { EnrollmentRepository } from '../enrollment/enrollment.repository';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('LessonAttendance')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonAttendanceController {
  constructor(
    private readonly attendanceService: LessonAttendanceService,
    private readonly lessonRepo: LessonRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  @Post('lessons/:id/attendance')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({
    summary: 'Batch roll call — record attendance for all students',
  })
  async batchRollCall(
    @Param('id', ParseIntPipe) lessonId: number,
    @Body() body: BatchRollCallDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    // M-03 修复: Teacher 只能为自己负责的课程签到
    if (req.user.role === 'Teacher') {
      const lesson = await this.lessonRepo.findOneById(lessonId);
      if (!lesson) {
        throw new NotFoundException(`Lesson #${lessonId} not found`);
      }
      if (lesson.teacherId !== Number(req.user.sub)) {
        throw new ForbiddenException('You are not assigned to this lesson');
      }
    }

    const operatorId = req.user.sub;
    const records = body.records.map((r) => ({
      lessonId,
      studentCode: r.studentCode,
      status: r.status,
      reason: r.reason,
      operator: operatorId,
      note: r.note,
    }));

    const result = await this.attendanceService.batchRollCall({
      lessonId,
      records,
    });
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
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    // M-03 修复: Teacher 只能为自己负责的班级签到
    if (req.user.role === 'Teacher') {
      const assignment = await this.entityManager
        .createQueryBuilder()
        .select('ta')
        .from('teacher_assignment', 'ta')
        .where('ta."classCode" = :classCode', { classCode })
        .andWhere('ta."teacherId" = :teacherId', {
          teacherId: Number(req.user.sub),
        })
        .andWhere('ta."effectiveTo" IS NULL')
        .andWhere('ta."deleted" = false')
        .getOne();
      if (!assignment) {
        throw new ForbiddenException('You are not assigned to this class');
      }
    }

    const operatorId = req.user.sub;
    const date = body.lessonDate || new Date().toISOString().split('T')[0];

    // 1. Find lesson for this class on this date
    const lessons = await this.lessonRepo.findByClassCodeAndDate(
      classCode,
      date,
    );
    if (lessons.length === 0) {
      throw new NotFoundException(`未找到班级 ${classCode} 在 ${date} 的课程`);
    }

    // Use the first TEACHING or SCHEDULED lesson; prefer TEACHING
    const lesson =
      lessons.find((l) => l.status === LessonStatus.TEACHING) ||
      lessons.find((l) => l.status === LessonStatus.SCHEDULED) ||
      lessons[0];

    if (
      lesson.status !== LessonStatus.TEACHING &&
      lesson.status !== LessonStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        `课程 ${lesson.id} 当前状态为 ${lesson.status}，无法签到`,
      );
    }

    // 2. Verify all students are enrolled
    const studentCodes = body.records.map((r) => r.studentCode);
    const enrollments =
      await this.enrollmentRepo.findActiveByClassAndStudentCodes(
        classCode,
        studentCodes,
      );
    const enrolledSet = new Set(enrollments.map((e) => e.studentCode));
    const unenrolled = studentCodes.filter((sc) => !enrolledSet.has(sc));
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

    const result = await this.attendanceService.batchRollCall({
      lessonId: lesson.id,
      records,
    });
    return ApiResponse.success(result, 'Attendance recorded');
  }

  @Post('lesson-attendance/import')
  @Roles('SuperAdmin', 'Admin')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '导入上课/考勤记录，Excel 列：学员编码/出勤状态(+课时ID 或 班级编码+上课日期)',
  })
  async importAttendance(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }
    const report = await this.attendanceService.importAttendance(
      file.buffer,
      file.originalname,
      req.user.sub,
      req.user.name,
    );
    return ApiResponse.success(report);
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
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    const result = await this.attendanceService.confirmAll(
      lessonId,
      req.user.sub,
    );
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
    @Req() req: AuthedRequest,
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
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    // ── V-01: Lesson attendance isolation ──
    const lesson = await this.lessonRepo.findOneById(lessonId);
    if (!lesson) {
      throw new NotFoundException(`课程 ${lessonId} 不存在`);
    }
    await this.assertLessonAccess(req.user, lesson.classCode, lesson.teacherId);

    const result = await this.attendanceService.findByLessonId(lessonId);
    return ApiResponse.success(result);
  }

  @Get('students/:studentCode/attendance')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  @ApiOperation({ summary: 'Student attendance history' })
  async findByStudent(
    @Param('studentCode') studentCode: string,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    // ── V-02: Student attendance isolation ──
    await this.assertStudentAccess(req.user, studentCode);

    const result = await this.attendanceService.findByStudentCode(studentCode);
    return ApiResponse.success(result);
  }

  // ═══════════════════════════════════════════════════
  //  Data Isolation Helpers
  // ═══════════════════════════════════════════════════

  /**
   * V-01: Verify the current user is allowed to view attendance for a given lesson.
   *
   * - Admin / SuperAdmin: unrestricted.
   * - Teacher: the lesson must belong to a class they are assigned to.
   * - Student: the student (linked via userId) must be enrolled in the lesson's class.
   * - Parent: at least one of their children must be enrolled in the lesson's class.
   */
  private async assertLessonAccess(
    user: { sub: number; role: string },
    classCode: string,
    teacherId: number,
  ): Promise<void> {
    if (user.role === 'Admin' || user.role === 'SuperAdmin') return;

    if (user.role === 'Teacher') {
      if (teacherId !== Number(user.sub)) {
        throw new ForbiddenException('无权访问该课程的出勤记录');
      }
      return;
    }

    if (user.role === 'Student') {
      const student = await this.entityManager
        .createQueryBuilder()
        .from('student', 's')
        .where('s.userId = :userId AND s.deleted = 0', { userId: user.sub })
        .getOne();
      if (!student) {
        throw new ForbiddenException('未找到关联的学生信息');
      }

      const enrolled = await this.enrollmentRepo.findByClassAndStudent(
        classCode,
        (student as { studentCode: string }).studentCode,
      );
      if (!enrolled || enrolled.status !== EnrollmentStatus.ACTIVE) {
        throw new ForbiddenException('无权访问该课程的出勤记录');
      }
      return;
    }

    if (user.role === 'Parent') {
      const count = await this.entityManager
        .createQueryBuilder()
        .from('enrollment', 'enr')
        .innerJoin('student', 's', 's.studentCode = enr.studentCode')
        .innerJoin('student_parent', 'sp', 'sp.studentId = s.id')
        .where('enr.classCode = :classCode', { classCode })
        .andWhere('enr.status = :status', { status: EnrollmentStatus.ACTIVE })
        .andWhere('sp.parentId = :parentId', { parentId: Number(user.sub) })
        .getCount();
      if (count === 0) {
        throw new ForbiddenException('无权访问该课程的出勤记录');
      }
      return;
    }

    throw new ForbiddenException('无权访问该课程的出勤记录');
  }

  /**
   * V-02: Verify the current user is allowed to view attendance for a given student.
   *
   * - Admin / SuperAdmin: unrestricted.
   * - Student: the studentCode must match the user's own linked student record.
   * - Parent: the student must be one of their children.
   * - Teacher: the student must be enrolled in at least one class the teacher is assigned to.
   */
  private async assertStudentAccess(
    user: { sub: number; role: string },
    studentCode: string,
  ): Promise<void> {
    if (user.role === 'Admin' || user.role === 'SuperAdmin') return;

    if (user.role === 'Student') {
      const student = await this.entityManager
        .createQueryBuilder()
        .from('student', 's')
        .where('s.userId = :userId AND s.deleted = 0', { userId: user.sub })
        .getOne();
      if (!student || student.studentCode !== studentCode) {
        throw new ForbiddenException('无权访问该学生的出勤记录');
      }
      return;
    }

    if (user.role === 'Parent') {
      const count = await this.entityManager
        .createQueryBuilder()
        .from('student', 's')
        .innerJoin('student_parent', 'sp', 'sp.studentId = s.id')
        .where('s.studentCode = :studentCode', { studentCode })
        .andWhere('sp.parentId = :parentId', { parentId: Number(user.sub) })
        .getCount();
      if (count === 0) {
        throw new ForbiddenException('无权访问该学生的出勤记录');
      }
      return;
    }

    if (user.role === 'Teacher') {
      const count = await this.entityManager
        .createQueryBuilder()
        .from('enrollment', 'enr')
        .innerJoin('teacher_assignment', 'ta', 'ta.classCode = enr.classCode')
        .where('enr.studentCode = :studentCode', { studentCode })
        .andWhere('enr.status = :enrollmentStatus', {
          enrollmentStatus: EnrollmentStatus.ACTIVE,
        })
        .andWhere('ta.teacherId = :teacherId', { teacherId: Number(user.sub) })
        .andWhere('ta.effectiveTo IS NULL')
        .getCount();
      if (count === 0) {
        throw new ForbiddenException('无权访问该学生的出勤记录');
      }
      return;
    }

    throw new ForbiddenException('无权访问该学生的出勤记录');
  }
}
