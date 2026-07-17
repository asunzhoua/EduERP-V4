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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Subject } from '@common/enums/subject.enum';
import { CourseType } from '../enums/course-type.enum';

export class CreateCourseDto {
  @ApiProperty({ description: '课程名称', example: '少儿英语一级' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: Subject, description: '学科类别' })
  @IsEnum(Subject)
  @IsNotEmpty()
  subject: Subject;

  @ApiProperty({ enum: CourseType, description: '课程类型' })
  @IsEnum(CourseType)
  @IsNotEmpty()
  type: CourseType;

  @ApiPropertyOptional({ description: '课程详细描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '总课时(小时)', example: 40 })
  @IsNumber()
  @Min(0.5)
  totalHours: number;

  @ApiProperty({ description: '总课次数', example: 40 })
  @IsNumber()
  @Min(1)
  totalLessons: number;

  @ApiProperty({ description: '默认每节课分钟数', example: 60 })
  @IsNumber()
  @Min(15)
  defaultDuration: number;

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
