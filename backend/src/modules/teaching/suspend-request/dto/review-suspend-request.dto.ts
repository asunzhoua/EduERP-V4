import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Review Suspend Request DTO — used for approve/reject.
 */
export class ReviewSuspendRequestDto {
  @ApiPropertyOptional({
    description: '驳回原因（驳回时必须提供）',
    example: '停课时间过长，请与教务老师沟通',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
