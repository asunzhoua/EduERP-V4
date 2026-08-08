import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalaryRuleConfigDto } from './salary-rule-config.dto';

export class CreateSalaryRuleDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'PER_LESSON / PER_DAY / PER_HEAD / TIER / PART_TIME / OUTING / MONTHLY' })
  @IsString()
  type: string;

  @ApiProperty({ description: '兜底单价（历史字段），新规则建议用 config.lessonPrice' })
  @IsNumber()
  baseAmount: number;

  @ApiPropertyOptional({ default: 1.0 })
  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  courseType?: string;

  @ApiPropertyOptional({ description: '教师等级（预留维度，无数据源时规则不会命中）' })
  @IsOptional()
  @IsString()
  teacherLevel?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '扩展配置（按 type 强校验）' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SalaryRuleConfigDto)
  config?: SalaryRuleConfigDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateSalaryRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  baseAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  courseType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teacherLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SalaryRuleConfigDto)
  config?: SalaryRuleConfigDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class QuerySalaryRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  teacherId?: number;

  @ApiPropertyOptional({ description: '结算月份 YYYY-MM（优先于日期区间）' })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

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

export class UpdateSalaryRecordStatusDto {
  @ApiProperty({ description: 'PENDING / APPROVED / PAID' })
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SalaryStatisticsQueryDto {
  @ApiPropertyOptional({ description: '年份（缺省当前年）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ description: '月份 1-12（缺省当前月）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  month?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  teacherId?: number;
}

export class SettleDto {
  @ApiProperty({ description: '结算月份 YYYY-MM' })
  @IsString()
  month: string;

  @ApiPropertyOptional({ description: '指定教师（缺省全部教师）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  teacherId?: number;
}
