import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { ContractService } from './contract.service';
import { QueryLessonAuditDto } from './dto/query-lesson-audit.dto';

@ApiTags('Admin-Lesson-Audit')
@ApiBearerAuth()
@Controller('admin/lesson-audits')
@UseGuards(RolesGuard)
@Roles('SuperAdmin', 'Admin')
export class LessonAuditController {
  constructor(private readonly contractService: ContractService) {}

  @Get()
  @ApiOperation({ summary: '课时变更审计（分页，过滤 action/来源/操作者/日期）' })
  async findAll(@Query() query: QueryLessonAuditDto) {
    const result = await this.contractService.getLessonAudits({
      action: query.action,
      source: query.source,
      operatorId: query.operatorId,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
    return ApiResponse.success(result);
  }
}
