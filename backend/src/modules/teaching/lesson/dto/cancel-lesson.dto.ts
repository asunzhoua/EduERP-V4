import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Cancel Lesson DTO — validates input for cancelling a lesson.
 */
export class CancelLessonDto {
  @ApiProperty({
    description: '取消原因',
    example: '教师请假',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'reason must be at least 2 characters' })
  @MaxLength(200, { message: 'reason must be at most 200 characters' })
  reason: string;
}