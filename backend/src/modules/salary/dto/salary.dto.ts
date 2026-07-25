import { IsOptional, IsString, IsNumber, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSalaryRuleDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsNumber()
  baseAmount: number;

  @ApiProperty({ required: false, default: 1.0 })
  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  courseType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  teacherLevel?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSalaryRuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  baseAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  courseType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  teacherLevel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QuerySalaryRecordDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  teacherId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  pageSize?: number;
}

export class UpdateSalaryRecordStatusDto {
  @ApiProperty()
  @IsString()
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SalaryStatisticsQueryDto {
  @ApiProperty()
  @IsNumber()
  year: number;

  @ApiProperty()
  @IsNumber()
  month: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  teacherId?: number;
}
