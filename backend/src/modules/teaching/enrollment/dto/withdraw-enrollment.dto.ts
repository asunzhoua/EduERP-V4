import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Withdraw Enrollment DTO — validates input for withdrawing an enrollment.
 */
export class WithdrawEnrollmentDto {
  @ApiProperty({
    description: '退课原因',
    example: '学生转学',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'reason must be at least 2 characters' })
  @MaxLength(200, { message: 'reason must be at most 200 characters' })
  reason: string;
}