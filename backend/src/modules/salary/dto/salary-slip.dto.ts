import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 生成工资条（幂等：teacherId + month 已存在则跳过） */
export class GenerateSlipsDto {
  @ApiProperty({ description: '月份 YYYY-MM' })
  @IsString()
  month: string;

  @ApiPropertyOptional({ description: '指定教师；缺省全部' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  teacherId?: number;
}

/** 工资条试算（dry-run，不落库） */
export class PreviewSlipsDto {
  @ApiProperty({ description: '月份 YYYY-MM' })
  @IsString()
  month: string;

  @ApiPropertyOptional({ description: '指定教师；缺省全部' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  teacherId?: number;
}

export class QuerySalarySlipDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  teacherId?: number;

  @ApiPropertyOptional({ description: 'PENDING / APPROVED / PAID' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;
}

export class UpdateSlipStatusDto {
  @ApiProperty({ description: 'PENDING / APPROVED / PAID' })
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── 发放批次 ───

export class CreatePayrollDto {
  @ApiProperty({ description: '月份 YYYY-MM' })
  @IsString()
  month: string;

  @ApiPropertyOptional({
    description: '指定工资条 ID；缺省取该月全部已确认/待发放',
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  slipIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdatePayrollStatusDto {
  @ApiProperty({ description: 'DRAFT / CONFIRMED / PAID / CLOSED' })
  @IsString()
  status: string;
}

export class QueryPayrollDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({ description: 'DRAFT / CONFIRMED / PAID / CLOSED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;
}
