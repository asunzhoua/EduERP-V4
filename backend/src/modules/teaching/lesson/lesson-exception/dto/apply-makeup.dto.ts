import { IsNumber, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyMakeupDto {
  @ApiProperty({ description: '原课程ID' })
  @IsNumber()
  @Min(1)
  originalLessonId: number;

  @ApiProperty({ description: '异常记录ID' })
  @IsNumber()
  @Min(1)
  exceptionId: number;

  @ApiProperty({ description: '补课开始时间' })
  @IsDateString()
  rescheduledStart: Date;

  @ApiProperty({ description: '补课结束时间' })
  @IsDateString()
  rescheduledEnd: Date;

  @ApiProperty({ description: '授课教师ID' })
  @IsNumber()
  @Min(1)
  teacherId: number;

  @ApiProperty({ description: '教室ID' })
  @IsNumber()
  @Min(1)
  roomId: number;
}
