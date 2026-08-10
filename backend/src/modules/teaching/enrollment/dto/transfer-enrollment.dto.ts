import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Transfer Enrollment DTO — validates input for transferring an
 * active enrollment to another class (reusing the same contract).
 */
export class TransferEnrollmentDto {
  @ApiProperty({
    description: '目标班级编码',
    example: 'CL2026070002',
    maxLength: 20,
  })
  @IsString({ message: '目标班级编码必须是字符串' })
  @IsNotEmpty({ message: '目标班级编码不能为空' })
  @MaxLength(20, { message: '目标班级编码最多 20 个字符' })
  targetClassCode: string;

  @ApiProperty({
    description: '调班原因',
    example: '家长要求换班',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: '调班原因必须是字符串' })
  @MaxLength(500, { message: '调班原因最多 500 个字符' })
  reason?: string;
}
