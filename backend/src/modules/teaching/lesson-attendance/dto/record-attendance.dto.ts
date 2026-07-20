import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '../enums/attendance-status.enum';

/**
 * Record Attendance DTO — validates input for recording a single student's attendance.
 */
export class RecordAttendanceDto {
  @ApiProperty({
    description: '学生编码',
    example: 'STU20260001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  studentCode: string;

  @ApiProperty({
    description: '出勤状态',
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
  })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;

  @ApiPropertyOptional({
    description: '迟到/请假/缺勤原因（LATE/LEAVE/ABSENT 时必须提供）',
    example: '交通堵塞',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({
    description: '备注',
    example: '学生家长提前通知了',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
