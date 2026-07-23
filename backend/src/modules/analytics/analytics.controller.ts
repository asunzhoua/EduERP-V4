import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('student/:studentCode')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent', 'Student')
  async getStudentMetrics(@Param('studentCode') studentCode: string) {
    const result = await this.analyticsService.getStudentMetrics(studentCode);
    return ApiResponse.success(result);
  }

  @Get('teacher/:teacherId')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async getTeacherMetrics(@Param('teacherId', ParseIntPipe) teacherId: number) {
    const result = await this.analyticsService.getTeacherMetrics(teacherId);
    return ApiResponse.success(result);
  }

  @Get('institution')
  @Roles('SuperAdmin', 'Admin')
  async getInstitutionMetrics() {
    const result = await this.analyticsService.getInstitutionMetrics();
    return ApiResponse.success(result);
  }

  @Get('student/:studentCode/trend')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent', 'Student')
  async getStudentTrend(
    @Param('studentCode') studentCode: string,
    @Query('days') days?: string,
  ) {
    const parsedDays = days ? parseInt(days, 10) : 7;
    const result = await this.analyticsService.getStudentTrend(studentCode, parsedDays);
    return ApiResponse.success(result);
  }

  @Get('teacher/:teacherId/trend')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async getTeacherTrend(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Query('days') days?: string,
  ) {
    const parsedDays = days ? parseInt(days, 10) : 7;
    const result = await this.analyticsService.getTeacherTrend(teacherId, parsedDays);
    return ApiResponse.success(result);
  }

  @Get('institution/trend')
  @Roles('SuperAdmin', 'Admin')
  async getInstitutionTrend(@Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 7;
    const result = await this.analyticsService.getInstitutionTrend(parsedDays);
    return ApiResponse.success(result);
  }
}
