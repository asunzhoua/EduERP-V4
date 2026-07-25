import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Review Leave Request DTO — used for approve/reject.
 */
export class ReviewLeaveRequestDto {
  @ApiPropertyOptional({
    description: '驳回原因（驳回时必须提供）',
    example: '请假理由不充分，请补充说明',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
