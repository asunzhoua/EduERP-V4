import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Subject } from '@common/enums/subject.enum';
import { CourseType } from '../enums/course-type.enum';
import { CourseStatus } from '../enums/course-status.enum';

export class QueryCourseDto {
  @ApiPropertyOptional({ description: '按名称搜索' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: Subject, description: '按学科筛选' })
  @IsEnum(Subject)
  @IsOptional()
  subject?: Subject;

  @ApiPropertyOptional({ enum: CourseType, description: '按类型筛选' })
  @IsEnum(CourseType)
  @IsOptional()
  type?: CourseType;

  @ApiPropertyOptional({ enum: CourseStatus, description: '按状态筛选' })
  @IsEnum(CourseStatus)
  @IsOptional()
  status?: CourseStatus;

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
