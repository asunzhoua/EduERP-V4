import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SalaryService } from './salary.service';
import {
  CreateSalaryRuleDto,
  UpdateSalaryRuleDto,
  QuerySalaryRecordDto,
  UpdateSalaryRecordStatusDto,
  SalaryStatisticsQueryDto,
} from './dto/salary.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('salary')
@Controller('salary')
@UseGuards(RolesGuard)
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  // ==================== 教师接口 ====================

  @Get('my-records')
  @Roles('Teacher')
  @ApiOperation({ summary: '教师查询自己的工资记录' })
  @ApiResponse({ status: 200, description: '成功返回工资记录列表' })
  async getMyRecords(@Request() req, @Query() query: QuerySalaryRecordDto) {
    const teacherId = req.user.sub;
    return this.salaryService.getRecords({ ...query, teacherId });
  }

  @Get('my-statistics')
  @Roles('Teacher')
  @ApiOperation({ summary: '教师查询自己的工资统计' })
  @ApiResponse({ status: 200, description: '成功返回工资统计' })
  async getMyStatistics(@Request() req, @Query() query: SalaryStatisticsQueryDto) {
    const teacherId = req.user.sub;
    return this.salaryService.getStatistics({ ...query, teacherId });
  }

  // ==================== 管理员接口 ====================

  @Get('records')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '管理员查询所有工资记录' })
  @ApiResponse({ status: 200, description: '成功返回工资记录列表' })
  async getAllRecords(@Query() query: QuerySalaryRecordDto) {
    return this.salaryService.getRecords(query);
  }

  @Put('records/:id/status')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '管理员更新工资记录状态' })
  @ApiResponse({ status: 200, description: '成功更新状态' })
  async updateRecordStatus(
    @Param('id') id: number,
    @Body() dto: UpdateSalaryRecordStatusDto,
  ) {
    return this.salaryService.updateRecordStatus(id, dto.status, dto.notes);
  }

  @Get('statistics')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '管理员查询工资统计' })
  @ApiResponse({ status: 200, description: '成功返回工资统计' })
  async getStatistics(@Query() query: SalaryStatisticsQueryDto) {
    return this.salaryService.getStatistics(query);
  }

  // ==================== 规则管理接口 ====================

  @Post('rules')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '管理员创建工资规则' })
  @ApiResponse({ status: 201, description: '成功创建规则' })
  async createRule(@Body() dto: CreateSalaryRuleDto) {
    return this.salaryService.createRule(dto);
  }

  @Put('rules/:id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '管理员更新工资规则' })
  @ApiResponse({ status: 200, description: '成功更新规则' })
  async updateRule(@Param('id') id: number, @Body() dto: UpdateSalaryRuleDto) {
    return this.salaryService.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @Roles('Admin', 'SuperAdmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '管理员删除工资规则（软删除）' })
  @ApiResponse({ status: 204, description: '成功删除规则' })
  async deleteRule(@Param('id') id: number) {
    return this.salaryService.deleteRule(id);
  }

  @Get('rules')
  @ApiOperation({ summary: '查询工资规则列表' })
  @ApiResponse({ status: 200, description: '成功返回规则列表' })
  async getRules(@Query('activeOnly') activeOnly: boolean = true) {
    return this.salaryService.getRules(activeOnly);
  }

  @Get('rules/:id')
  @ApiOperation({ summary: '查询单个工资规则' })
  @ApiResponse({ status: 200, description: '成功返回规则' })
  async getRule(@Param('id') id: number) {
    return this.salaryService.getRule(id);
  }
}
