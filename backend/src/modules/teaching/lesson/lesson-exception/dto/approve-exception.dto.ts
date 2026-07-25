import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveExceptionDto {
  @ApiProperty({ required: false, description: '审批备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class RejectExceptionDto {
  @ApiProperty({ description: '拒绝原因' })
  @IsString()
  @MinLength(1)
  rejectReason: string;
}
