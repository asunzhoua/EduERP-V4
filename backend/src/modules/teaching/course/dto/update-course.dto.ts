import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Subject } from '@common/enums/subject.enum';
import { CourseType } from '../enums/course-type.enum';

export class UpdateCourseDto {
  @ApiPropertyOptional({ description: '课程名称' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: Subject, description: '学科类别' })
  @IsEnum(Subject)
  @IsOptional()
  subject?: Subject;

  @ApiPropertyOptional({ enum: CourseType, description: '课程类型' })
  @IsEnum(CourseType)
  @IsOptional()
  type?: CourseType;

  @ApiPropertyOptional({ description: '课程详细描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '总课时(小时)' })
  @IsNumber()
  @Min(0.5)
  @IsOptional()
  totalHours?: number;

  @ApiPropertyOptional({ description: '总课次数' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  totalLessons?: number;

  @ApiPropertyOptional({ description: '默认每节课分钟数' })
  @IsNumber()
  @Min(15)
  @IsOptional()
  defaultDuration?: number;

  @ApiPropertyOptional({ description: '标签', type: [String] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  coverImage?: string;

  @ApiPropertyOptional({ description: '内部备注' })
  @IsString()
  @IsOptional()
  note?: string;
}
