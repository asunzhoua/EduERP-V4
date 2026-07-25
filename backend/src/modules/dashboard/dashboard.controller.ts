// ---------------------------------------------------------------------------
// DashboardController
// Phase 3 — Full REST API with ADMIN-only access control
// ---------------------------------------------------------------------------

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import {
  DashboardOverviewDto,
  LessonStatsDto,
  StudentStatsDto,
  TeacherStatsDto,
  FinanceStatsDto,
} from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: '获取总览数据' })
  async getOverview(): Promise<DashboardOverviewDto> {
    return this.dashboardService.getOverview();
  }

  @Get('lessons')
  @ApiOperation({ summary: '获取课程统计' })
  async getLessons(): Promise<LessonStatsDto> {
    return this.dashboardService.getLessons();
  }

  @Get('students')
  @ApiOperation({ summary: '获取学员统计' })
  async getStudents(): Promise<StudentStatsDto> {
    return this.dashboardService.getStudents();
  }

  @Get('teachers')
  @ApiOperation({ summary: '获取教师统计' })
  async getTeachers(): Promise<TeacherStatsDto> {
    return this.dashboardService.getTeachers();
  }

  @Get('finance')
  @ApiOperation({ summary: '获取财务统计' })
  async getFinance(): Promise<FinanceStatsDto> {
    return this.dashboardService.getFinance();
  }
}
