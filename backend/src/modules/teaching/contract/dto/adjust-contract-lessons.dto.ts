import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 管理员调整合同课时。
 * - 传 totalLessons / remainingLessons 中的至少一个（省略的保持现值）
 * - 减少 remainingLessons 时 reason 必填（Service 层校验）
 */
export class AdjustContractLessonsDto {
  @ApiProperty({
    description: 'New total lessons (omit to keep current)',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalLessons?: number;

  @ApiProperty({
    description: 'New remaining lessons (omit to keep current)',
    example: 15,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  remainingLessons?: number;

  @ApiProperty({
    description: 'Reason (required when reducing remaining lessons)',
    example: '家长续费赠送',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
