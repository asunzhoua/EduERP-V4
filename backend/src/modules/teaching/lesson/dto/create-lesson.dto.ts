import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDateString,
  Matches,
  Min,
  Max,
} from 'class-validator';

/**
 * Create Lesson DTO — validates input for creating a new lesson.
 */
export class CreateLessonDto {
  @IsString()
  classCode: string;

  @IsString()
  courseCode: string;

  @IsNumber()
  @Min(1, { message: 'lessonNumber must be >= 1' })
  @Max(999, { message: 'lessonNumber must be <= 999' })
  lessonNumber: number;

  @IsDateString({}, { message: 'scheduledDate must be a valid date (YYYY-MM-DD)' })
  scheduledDate: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:MM format (00:00–23:59)',
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:MM format (00:00–23:59)',
  })
  endTime: string;

  @IsNumber()
  teacherId: number;

  @IsBoolean()
  @IsOptional()
  isMakeup?: boolean;

  @IsNumber()
  @IsOptional()
  originLessonId?: number;
}
