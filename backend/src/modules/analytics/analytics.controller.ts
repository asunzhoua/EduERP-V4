import { Controller, Get, Param, ParseIntPipe, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { AnalyticsService } from './analytics.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '@modules/student/entities/student.entity';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
  ) {}

  @Get('student/:studentCode')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent', 'Student')
  async getStudentMetrics(@Param('studentCode') studentCode: string, @Req() req: any) {
    await this.verifyStudentAccess(req, studentCode);
    const result = await this.analyticsService.getStudentMetrics(studentCode);
    return ApiResponse.success(result);
  }

  @Get('teacher/:teacherId')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async getTeacherMetrics(@Param('teacherId', ParseIntPipe) teacherId: number, @Req() req: any) {
    await this.verifyTeacherAccess(req, teacherId);
    const result = await this.analyticsService.getTeacherMetrics(teacherId);
    return ApiResponse.success(result);
  }

  @Get('institution')
  @Roles('SuperAdmin', 'Admin')
  async getInstitutionMetrics() {
    const result = await this.analyticsService.getInstitutionMetrics();
    return ApiResponse.success(result);
  }

  @Get('attendance-statistics')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async getAttendanceStatistics() {
    const result = await this.analyticsService.getAttendanceStatistics();
    return ApiResponse.success(result);
  }

  @Get('student/:studentCode/trend')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent', 'Student')
  async getStudentTrend(
    @Param('studentCode') studentCode: string,
    @Query('days') days?: string,
    @Req() req?: any,
  ) {
    await this.verifyStudentAccess(req, studentCode);
    const parsedDays = this.parseDays(days);
    const result = await this.analyticsService.getStudentTrend(studentCode, parsedDays);
    return ApiResponse.success(result);
  }

  @Get('teacher/:teacherId/trend')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async getTeacherTrend(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Query('days') days?: string,
    @Req() req?: any,
  ) {
    await this.verifyTeacherAccess(req, teacherId);
    const parsedDays = this.parseDays(days);
    const result = await this.analyticsService.getTeacherTrend(teacherId, parsedDays);
    return ApiResponse.success(result);
  }

  @Get('institution/trend')
  @Roles('SuperAdmin', 'Admin')
  async getInstitutionTrend(@Query('days') days?: string) {
    const parsedDays = this.parseDays(days);
    const result = await this.analyticsService.getInstitutionTrend(parsedDays);
    return ApiResponse.success(result);
  }

  /**
   * Parse and validate the `days` query parameter.
   * Defaults to 7, clamped to [1, 365].
   */
  private parseDays(days?: string): number {
    if (!days) return 7;
    const parsed = parseInt(days, 10);
    if (isNaN(parsed) || parsed < 1) return 7;
    return Math.min(parsed, 365);
  }

  /**
   * Verify that Student/Parent roles can only access their own data.
   * SuperAdmin/Admin/Teacher can access any student's data.
   */
  private async verifyStudentAccess(req: any, studentCode: string): Promise<void> {
    const user = req.user;
    // SuperAdmin/Admin/Teacher can access any student's data
    if (user.role === 'SuperAdmin' || user.role === 'Admin' || user.role === 'Teacher') {
      return;
    }
    // Student/Parent can only access their own data
    const student = await this.studentRepository.findOne({
      where: { studentCode, deleted: false },
    });
    if (!student) {
      throw new ForbiddenException('学生不存在');
    }
    if (student.userId !== user.sub) {
      throw new ForbiddenException('无权访问该学生数据');
    }
  }

  /**
   * Verify that Teacher role can only access their own metrics.
   * SuperAdmin/Admin can access any teacher's data.
   */
  private async verifyTeacherAccess(req: any, teacherId: number): Promise<void> {
    const user = req.user;
    if (user.role === 'SuperAdmin' || user.role === 'Admin') {
      return;
    }
    if (user.role === 'Teacher' && user.sub !== teacherId) {
      throw new ForbiddenException('无权访问其他教师数据');
    }
  }
}
