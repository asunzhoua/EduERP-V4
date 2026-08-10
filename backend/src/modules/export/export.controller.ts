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

  /** 中文文件名：RFC 5987 filename* 编码，ASCII 回退名防解析问题 */
  private disposition(filename: string, format: string): string {
    const fallback = `export_${Date.now()}.${this.ext(format)}`;
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }

  /** excel 格式的文件扩展名显示为 .xlsx */
  private ext(format: string): string {
    return format === 'excel' ? 'xlsx' : format;
  }

  @Post('students')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出学生数据' })
  async exportStudents(@Body() filters: ExportFilterDto, @Res() res: Response) {
    const format = filters.format || 'csv';
    const buffer = await this.exportService.exportStudents(filters, format);

    const filename = `学生数据_${Date.now()}.${this.ext(format)}`;
    res.set({
      'Content-Type':
        format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': this.disposition(filename, format),
    });
    res.send(buffer);
  }

  @Post('lessons')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出课程记录' })
  async exportLessons(@Body() filters: ExportFilterDto, @Res() res: Response) {
    const format = filters.format || 'csv';
    const buffer = await this.exportService.exportLessons(filters, format);

    const filename = `课时记录_${Date.now()}.${this.ext(format)}`;
    res.set({
      'Content-Type':
        format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': this.disposition(filename, format),
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

    const filename = `课时消耗_${Date.now()}.${this.ext(format)}`;
    res.set({
      'Content-Type':
        format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': this.disposition(filename, format),
    });
    res.send(buffer);
  }

  @Post('salary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出工资记录' })
  async exportSalary(@Body() filters: ExportFilterDto, @Res() res: Response) {
    const format = filters.format || 'csv';
    const buffer = await this.exportService.exportSalary(filters, format);

    const filename = `工资数据_${Date.now()}.${this.ext(format)}`;
    res.set({
      'Content-Type':
        format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': this.disposition(filename, format),
    });
    res.send(buffer);
  }

  @Post('finance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出财务记录' })
  async exportFinance(@Body() filters: ExportFilterDto, @Res() res: Response) {
    const format = filters.format || 'csv';
    const buffer = await this.exportService.exportFinance(filters, format);

    const filename = `财务数据_${Date.now()}.${this.ext(format)}`;
    res.set({
      'Content-Type':
        format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': this.disposition(filename, format),
    });
    res.send(buffer);
  }
}
