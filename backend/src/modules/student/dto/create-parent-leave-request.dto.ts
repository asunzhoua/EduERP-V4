import { IsString, IsNotEmpty, IsInt, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveType } from '../../teaching/leave-request/leave-request.entity';

/**
 * Create Parent Leave Request DTO.
 * Parent submits a leave request on behalf of a child.
 */
export class CreateParentLeaveRequestDto {
  @ApiProperty({
    description: '学生ID',
    example: 2,
  })
  @IsInt()
  studentId: number;

  @ApiProperty({
    description: '请假类型',
    enum: LeaveType,
    example: LeaveType.SICK,
  })
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @ApiProperty({
    description: '请假日期 (YYYY-MM-DD)',
    example: '2026-07-27',
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
  reason: string;
}
