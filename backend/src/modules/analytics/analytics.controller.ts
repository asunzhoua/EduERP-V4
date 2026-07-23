import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
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
}
