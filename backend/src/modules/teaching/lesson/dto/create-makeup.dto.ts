import {
  IsString,
  IsNumber,
  IsDateString,
  Matches,
  Min,
  Max,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Create Makeup Lesson DTO — validates input for creating a makeup lesson.
 * classCode is provided via route param, not in body.
 */
export class CreateMakeupDto {
  @ApiProperty({
    description: '课程编码',
    example: 'CS2026070001',
  })
  @IsString()
  courseCode: string;

  @ApiProperty({
    description: '课次号',
    example: 99,
    minimum: 1,
    maximum: 999,
  })
  @IsNumber()
  @Min(1, { message: 'lessonNumber must be >= 1' })
  @Max(999, { message: 'lessonNumber must be <= 999' })
  lessonNumber: number;

  @ApiProperty({
    description: '上课日期 (YYYY-MM-DD)',
    example: '2026-07-20',
  })
  @IsDateString({}, { message: 'scheduledDate must be a valid date (YYYY-MM-DD)' })
  scheduledDate: string;

  @ApiProperty({
    description: '开始时间 (HH:MM)',
    example: '14:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:MM format (00:00–23:59)',
  })
  startTime: string;

  @ApiProperty({
    description: '结束时间 (HH:MM)',
    example: '15:30',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:MM format (00:00–23:59)',
  })
  endTime: string;

  @ApiProperty({
    description: '教师ID',
    example: 1,
  })
  @IsNumber()
  teacherId: number;

  @ApiPropertyOptional({
    description: '原课次ID（补课来源）',
    example: 123,
  })
  @IsNumber()
  @IsOptional()
  originLessonId?: number;
}