import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveType } from '../leave-request.entity';

/**
 * Create Leave Request DTO.
 */
export class CreateLeaveRequestDto {
  @ApiProperty({
    description: '学生编码',
    example: 'STU20260001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  studentCode: string;

  @ApiProperty({
    description: '班级编码',
    example: 'CLASS20260001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  classCode: string;

  @ApiProperty({
    description: '请假类型',
    enum: LeaveType,
    example: LeaveType.SICK,
  })
  @IsEnum(LeaveType)
  @IsNotEmpty()
  leaveType: LeaveType;

  @ApiProperty({
    description: '请假日期 (YYYY-MM-DD)',
    example: '2026-07-26',
  })
  @IsString()
  @IsNotEmpty()
  leaveDate: string;

  @ApiProperty({
    description: '请假原因',
    example: '身体不适，需要休息一天',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
