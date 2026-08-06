import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ExportService } from './export.service';
import { ExportFilterDto } from './dto/export-filter.dto';

@ApiTags('Export')
@ApiBearerAuth()
@Controller('export')
@UseGuards(RolesGuard)
@Roles('SuperAdmin', 'Admin')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('students')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出学生数据' })
  async exportStudents(
    @Body() filters: ExportFilterDto,
    @Res() res: Response,
  ) {
    const format = filters.format || 'csv';
    const buffer = await this.exportService.exportStudents(filters, format);

    const filename = `students_${Date.now()}.${format}`;
    res.set({
      'Content-Type': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Post('lessons')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出课程记录' })
  async exportLessons(
    @Body() filters: ExportFilterDto,
    @Res() res: Response,
  ) {
    const format = filters.format || 'csv';
    const buffer = await this.exportService.exportLessons(filters, format);

    const filename = `lessons_${Date.now()}.${format}`;
    res.set({
      'Content-Type': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Post('consumption')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出课时消耗' })
  async exportConsumption(
    @Body() filters: ExportFilterDto,
    @Res() res: Response,
  ) {
    const format = filters.format || 'csv';
    const buffer = await this.exportService.exportConsumption(filters, format);

    const filename = `consumption_${Date.now()}.${format}`;
    res.set({
      'Content-Type': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Post('salary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出工资记录' })
  async exportSalary(
    @Body() filters: ExportFilterDto,
    @Res() res: Response,
  ) {
    const format = filters.format || 'csv';
    const buffer = await this.exportService.exportSalary(filters, format);

    const filename = `salary_${Date.now()}.${format}`;
    res.set({
      'Content-Type': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Post('finance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出财务记录' })
  async exportFinance(
    @Body() filters: ExportFilterDto,
    @Res() res: Response,
  ) {
    const format = filters.format || 'csv';
    const buffer = await this.exportService.exportFinance(filters, format);

    const filename = `finance_${Date.now()}.${format}`;
    res.set({
      'Content-Type': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }
}
