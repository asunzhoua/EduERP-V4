import {
  Controller,
  Post,
  Query,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { ExportFilterDto } from './dto/export-filter.dto';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('students')
  async exportStudents(
    @Body() filters: ExportFilterDto,
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportService.exportStudents(filters, format);
    this.sendFile(res, buffer, `students.${format}`, format);
  }

  @Post('lessons')
  async exportLessons(
    @Body() filters: ExportFilterDto,
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportService.exportLessons(filters, format);
    this.sendFile(res, buffer, `lessons.${format}`, format);
  }

  @Post('consumption')
  async exportConsumption(
    @Body() filters: ExportFilterDto,
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportService.exportConsumption(filters, format);
    this.sendFile(res, buffer, `consumption.${format}`, format);
  }

  @Post('salary')
  async exportSalary(
    @Body() filters: ExportFilterDto,
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportService.exportSalary(filters, format);
    this.sendFile(res, buffer, `salary.${format}`, format);
  }

  @Post('finance')
  async exportFinance(
    @Body() filters: ExportFilterDto,
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportService.exportFinance(filters, format);
    this.sendFile(res, buffer, `finance.${format}`, format);
  }

  private sendFile(
    res: Response,
    buffer: Buffer,
    filename: string,
    format: 'csv' | 'excel',
  ): void {
    const contentType =
      format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.send(buffer);
  }
}
