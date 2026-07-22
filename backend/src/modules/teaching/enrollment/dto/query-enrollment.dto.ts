import { IsEnum, IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';

export class QueryEnrollmentDto {
  @ApiPropertyOptional({ description: '按班级编号筛选' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  classCode?: string;

  @ApiPropertyOptional({ description: '按学生编号筛选' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  studentCode?: string;

  @ApiPropertyOptional({ enum: EnrollmentStatus, description: '按状态筛选' })
  @IsEnum(EnrollmentStatus)
  @IsOptional()
  status?: EnrollmentStatus;

  @ApiPropertyOptional({ default: 1, description: '页码' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, description: '每页数量' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}
