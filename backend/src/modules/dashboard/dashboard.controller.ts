// ---------------------------------------------------------------------------
// DashboardController
// Phase 3 — Full REST API with ADMIN-only access control
// ---------------------------------------------------------------------------

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
  DashboardSummaryDto,
  DashboardWorkbenchDto,
} from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(RolesGuard)
@Roles('SuperAdmin', 'Admin')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('cards')
  @ApiOperation({
    summary: '获取工作台统计（timeType=day|week|month|year|all，默认 month）',
  })
  async getCards(
    @Query('timeType') timeType?: string,
  ): Promise<DashboardWorkbenchDto> {
    return this.dashboardService.getCards(timeType);
  }

  @Get('summary')
  @ApiOperation({ summary: '获取综合概览（总量 + 合同课时 + 实际出勤消耗）' })
  async getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary();
  }

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
