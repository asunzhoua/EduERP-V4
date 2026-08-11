import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalaryRuleType, TeacherEmploymentType } from '../enums/salary.enums';
import {
  AllowanceConfigDto,
  DeductionConfigDto,
  SalaryRuleConfigDto,
} from './salary-rule-config.dto';

/** 教师薪资档案（G8 个性化载体）：读取/写入使用同一 DTO */
export class UpsertTeacherSalaryProfileDto {
  @ApiProperty({ description: '聘用形式 FULL_TIME/PART_TIME/OUTER' })
  @IsString()
  @IsIn(Object.values(TeacherEmploymentType))
  employmentType: string;

  @ApiProperty({ description: '计费类型（与 salaryConfig 配套）' })
  @IsString()
  @IsIn(Object.values(SalaryRuleType))
  ruleType: string;

  @ApiPropertyOptional({ description: '扩展配置（SalaryRuleConfigDto）' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SalaryRuleConfigDto)
  salaryConfig?: SalaryRuleConfigDto;

  @ApiPropertyOptional({
    description:
      '个人津贴：[{ type, name, amount }]（COMMUTING/HOUSING/HIGH_TEMP/OTHER）',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllowanceConfigDto)
  allowances?: AllowanceConfigDto[];

  @ApiPropertyOptional({
    description: '个人扣款：[{ type, name, amount }]（LEAVE/OTHER）',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeductionConfigDto)
  deductions?: DeductionConfigDto[];

  @ApiPropertyOptional({ description: '生效起始日（YYYY-MM-DD）' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: '生效结束日（YYYY-MM-DD）' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: '五险一金参保城市（如：北京/宁波）' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: '五险一金缴费基数（覆盖城市政策）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  socialBase?: number;

  @ApiPropertyOptional({
    description:
      '五险一金个人比例 { pension, medical, unemployment, housingFund }',
  })
  @IsOptional()
  @IsObject()
  socialRatios?: Record<string, any>;

  @ApiPropertyOptional({ description: '个税专项附加扣除 [{ type, amount }]' })
  @IsOptional()
  @IsArray()
  taxSpecialDeductions?: Record<string, any>[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

/** 教师列表查询（用于建档选择） */
export class QuerySalaryTeacherDto {
  @ApiPropertyOptional({ description: '姓名/手机号模糊搜索' })
  @IsOptional()
  @IsString()
  keyword?: string;

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

/** 新建外派课时记录 */
export class CreateOutingRecordDto {
  @ApiProperty({ description: '教师 ID' })
  @IsNumber()
  teacherId: number;

  @ApiProperty({ description: '外派日期（YYYY-MM-DD）' })
  @IsDateString()
  outingDate: string;

  @ApiPropertyOptional({ description: '外派地点' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    default: 1,
    description: '外派课时数（每节 = 1 节课时费）',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  lessonCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

/** 更新外派课时记录（部分字段） */
export class UpdateOutingRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  teacherId?: number;

  @ApiPropertyOptional({ description: '外派日期（YYYY-MM-DD）' })
  @IsOptional()
  @IsDateString()
  outingDate?: string;

  @ApiPropertyOptional({ description: '外派地点' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: '外派课时数' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  lessonCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

/** 外派记录状态流转 */
export class UpdateOutingRecordStatusDto {
  @ApiProperty({ description: 'PENDING / CONFIRMED（仅 CONFIRMED 计薪）' })
  @IsString()
  status: string;
}

/** 外派记录查询 */
export class QueryOutingRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  teacherId?: number;

  @ApiPropertyOptional({ description: '月份 YYYY-MM（按 outingDate 过滤）' })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({ description: 'PENDING / CONFIRMED' })
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
