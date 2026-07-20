import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '../../lesson-attendance/enums/attendance-status.enum';

export class AttendanceRecordDto {
  @ApiProperty({ description: 'Student code' })
  @IsString()
  studentCode: string;

  @ApiProperty({ description: 'Attendance status', enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiProperty({ description: 'Reason (required for LATE/LEAVE/ABSENT)', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateLessonWithAttendanceDto {
  @ApiProperty({ description: 'Class code' })
  @IsString()
  classCode: string;

  @ApiProperty({ description: 'Lesson date (YYYY-MM-DD)' })
  @IsString()
  lessonDate: string;

  @ApiProperty({ description: 'Start time (HH:MM)' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'End time (HH:MM)' })
  @IsString()
  endTime: string;

  @ApiProperty({ description: 'Lesson topic', required: false })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiProperty({ description: 'Attendance records', type: [AttendanceRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  attendanceRecords: AttendanceRecordDto[];
}
