import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── 子结构 ───

/** 个税档位（超额累进） */
export class TaxBracketDto {
  @ApiProperty({ description: '档位起（元，含）' })
  @IsNumber()
  min: number;

  @ApiPropertyOptional({ description: '档位止（元，含）；null=最后一档' })
  @IsOptional()
  @IsNumber()
  max?: number | null;

  @ApiProperty({ description: '税率（小数，如 0.03）' })
  @IsNumber()
  rate: number;

  @ApiProperty({ description: '速算扣除数（元）' })
  @IsNumber()
  quickDeduction: number;
}

/** 五险一金个人比例 */
export class SocialRatiosDto {
  @ApiPropertyOptional({ description: '养老（小数，如 0.08）' })
  @IsOptional()
  @IsNumber()
  pension?: number;

  @ApiPropertyOptional({ description: '医疗（小数，如 0.02）' })
  @IsOptional()
  @IsNumber()
  medical?: number;

  @ApiPropertyOptional({ description: '失业（小数，如 0.005）' })
  @IsOptional()
  @IsNumber()
  unemployment?: number;

  @ApiPropertyOptional({ description: '公积金（小数，如 0.05~0.12）' })
  @IsOptional()
  @IsNumber()
  housingFund?: number;
}

// ─── 个税政策 ───

export class CreateTaxPolicyDto {
  @ApiProperty({ description: '政策名称，如：2026 年度个税税率表' })
  @IsString()
  name: string;

  @ApiProperty({ description: '生效起始日 YYYY-MM-DD' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ description: '生效结束日；缺省长期有效' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: '起征点（元/月），缺省 5000' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxThreshold?: number;

  @ApiPropertyOptional({ description: '7 档税率表（按 min 升序）' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxBracketDto)
  brackets?: TaxBracketDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateTaxPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxBracketDto)
  brackets?: TaxBracketDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class QueryTaxPolicyDto {
  @ApiPropertyOptional({ description: '仅查启用中（生效区间覆盖今天）' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;

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

// ─── 五险一金政策 ───

export class CreateInsurancePolicyDto {
  @ApiProperty({ description: '城市，如：北京 / 上海' })
  @IsString()
  city: string;

  @ApiProperty({ description: '版本名称，如：2026 年度社保基数' })
  @IsString()
  name: string;

  @ApiProperty({ description: '生效起始日 YYYY-MM-DD' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ description: '生效结束日；缺省长期有效' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: '缴费基数下限' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  socialBaseMin?: number;

  @ApiPropertyOptional({ description: '缴费基数上限' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  socialBaseMax?: number;

  @ApiPropertyOptional({ description: '默认估算基数（教师可覆盖）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  socialBase?: number;

  @ApiPropertyOptional({ description: '个人比例' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialRatiosDto)
  ratios?: SocialRatiosDto;

  @ApiPropertyOptional({ description: '单位比例（留档，可空）' })
  @IsOptional()
  @IsObject()
  employerRatios?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateInsurancePolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  socialBaseMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  socialBaseMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  socialBase?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialRatiosDto)
  ratios?: SocialRatiosDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  employerRatios?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ImportInsurancePolicyDto {
  @ApiProperty({ description: '城市，如：北京' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ description: '新版本生效日；缺省次月 1 日' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class SyncInsurancePolicyDto {
  @ApiProperty({ description: '城市' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ description: '生效日；缺省次月 1 日' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class QueryInsurancePolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: '仅查启用中' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;

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
