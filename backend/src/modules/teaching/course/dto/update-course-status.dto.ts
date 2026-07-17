import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CourseStatus } from '../enums/course-status.enum';

export class UpdateCourseStatusDto {
  @ApiProperty({ enum: CourseStatus, description: '目标状态' })
  @IsEnum(CourseStatus)
  @IsNotEmpty()
  status: CourseStatus;
}
