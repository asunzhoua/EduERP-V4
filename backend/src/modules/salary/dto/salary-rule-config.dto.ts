import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** 累计课时阶梯（TIER 模式），如 {min:1,max:20,price:30} {min:21,max:null,price:35} */
export class LessonTierDto {
  @ApiPropertyOptional({ description: '档位起始课时数（含），从 1 开始' })
  @IsNumber()
  @Min(1)
  min: number;

  @ApiPropertyOptional({
    description: '档位结束课时数（含）；null = 无上限（最后一档）',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max: number | null;

  @ApiPropertyOptional({ description: '该档每节课单价' })
  @IsNumber()
  @Min(0)
  pricePerLesson: number;
}

/** 人数阶梯（PER_HEAD 模式），人数达到阈值后调价 */
export class HeadcountTierDto {
  @ApiPropertyOptional({ description: '档位起始人数（含），从 1 开始' })
  @IsNumber()
  @Min(1)
  min: number;

  @ApiPropertyOptional({
    description: '档位结束人数（含）；null = 无上限（最后一档）',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max: number | null;

  @ApiPropertyOptional({ description: '该档每人单价' })
  @IsNumber()
  @Min(0)
  pricePerHead: number;
}

/** 课时目标奖励 */
export class LessonTargetDto {
  @ApiPropertyOptional({ description: '课时目标门槛（当月达到该课时数）' })
  @IsNumber()
  @Min(1)
  threshold: number;

  @ApiPropertyOptional({ description: '达标奖励金额' })
  @IsNumber()
  @Min(0)
  amount: number;
}

/** 绩效配置（可选） */
export class BonusConfigDto {
  @ApiPropertyOptional({ description: '满勤奖励：该月该教师所有课时全员到课' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fullAttendance?: number;

  @ApiPropertyOptional({ description: '课时目标奖励' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LessonTargetDto)
  lessonTarget?: LessonTargetDto;
}

/** 津贴/扣款项（教师维度）：{ type, name, amount }，结算按档案生成 ALLOWANCE/DEDUCTION */
export class AllowanceConfigDto {
  @ApiPropertyOptional({
    description: '津贴类型 COMMUTING/HOUSING/HIGH_TEMP/OTHER',
  })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: '显示名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '金额' })
  @IsNumber()
  @Min(0)
  amount: number;
}

/** 扣款项（教师维度）：{ type, name, amount }，结算按档案生成 DEDUCTION */
export class DeductionConfigDto {
  @ApiPropertyOptional({ description: '扣款类型 LEAVE/OTHER' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: '显示名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '金额' })
  @IsNumber()
  @Min(0)
  amount: number;
}

/**
 * 规则扩展配置（`salary_rule.config` JSON 强类型校验）。
 *
 * 不同 type 只使用相关字段，由服务层 `validateRuleConfig(type, config)` 做互斥校验：
 *   PER_LESSON / PART_TIME / OUTING / PER_DAY → lessonPrice
 *   PER_HEAD                                 → pricePerHead / headcountTiers
 *   TIER                                     → lessonTiers
 *   任意                                     → baseSalary / minLessonForBase（可选）
 *   任意                                     → bonus（可选）
 */
export class SalaryRuleConfigDto {
  @ApiPropertyOptional({ description: '底薪（月），任意课时费模式可叠加' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @ApiPropertyOptional({ description: '底薪最低课时门槛（缺省 0 = 无门槛）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minLessonForBase?: number;

  @ApiPropertyOptional({
    description: '固定单价（PER_LESSON/PER_DAY/PART_TIME/OUTING）',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lessonPrice?: number;

  @ApiPropertyOptional({ description: '每人单价（PER_HEAD）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerHead?: number;

  @ApiPropertyOptional({
    description: '累计课时阶梯（TIER 模式），按 min 升序',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LessonTierDto)
  lessonTiers?: LessonTierDto[];

  @ApiPropertyOptional({
    description: '人数阶梯（PER_HEAD 模式），按 min 升序',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HeadcountTierDto)
  headcountTiers?: HeadcountTierDto[];

  @ApiPropertyOptional({ description: '绩效配置' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BonusConfigDto)
  bonus?: BonusConfigDto;

  @ApiPropertyOptional({
    description: '津贴项（教师维度，结算生成 ALLOWANCE 记录）',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllowanceConfigDto)
  allowances?: AllowanceConfigDto[];

  @ApiPropertyOptional({
    description: '扣款项（教师维度，结算生成 DEDUCTION 记录）',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeductionConfigDto)
  deductions?: DeductionConfigDto[];

  @ApiPropertyOptional({
    description: '生效起始日（YYYY-MM-DD，缺省长期有效）',
  })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    description: '生效结束日（YYYY-MM-DD，缺省长期有效）',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
