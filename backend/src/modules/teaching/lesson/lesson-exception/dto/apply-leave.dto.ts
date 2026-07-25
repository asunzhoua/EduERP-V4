import {
  IsEnum,
  IsString,
  IsArray,
  IsDateString,
  IsOptional,
  MinLength,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyLeaveDto {
  @ApiProperty({
    enum: ['LEAVE_SICK', 'LEAVE_PERSONAL', 'LEAVE_TRAINING'],
    description: '请假类型',
  })
  @IsEnum(['LEAVE_SICK', 'LEAVE_PERSONAL', 'LEAVE_TRAINING'])
  exceptionType: 'LEAVE_SICK' | 'LEAVE_PERSONAL' | 'LEAVE_TRAINING';

  @ApiProperty({ description: '请假原因' })
  @IsString()
  @MinLength(1)
  reason: string;

  @ApiProperty({ description: '开始时间' })
  @IsDateString()
  startTime: Date;

  @ApiProperty({ description: '结束时间' })
  @IsDateString()
  endTime: Date;

  @ApiProperty({
    type: [Object],
    required: false,
    description: '附件列表（病假必须上传医院证明）',
  })
  @IsOptional()
  @IsArray()
  attachments?: any[];
}
