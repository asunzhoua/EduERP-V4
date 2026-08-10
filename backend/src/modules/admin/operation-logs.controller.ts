import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import {
  OperationLogsService,
  QueryOperationLogDto,
} from './operation-logs.service';

@ApiTags('Admin-OperationLogs')
@ApiBearerAuth()
@Controller('admin/operation-logs')
@UseGuards(RolesGuard)
@Roles('SuperAdmin', 'Admin')
export class OperationLogsController {
  constructor(private readonly logsService: OperationLogsService) {}

  @Get()
  @ApiOperation({ summary: '操作日志列表（分页 + 筛选）' })
  async findAll(@Query() query: QueryOperationLogDto) {
    const result = await this.logsService.findAll({
      keyword: query.keyword,
      module: query.module,
      action: query.action,
      page: query.page,
      pageSize: query.pageSize,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return ApiResponse.success(result);
  }
}
