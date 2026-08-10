import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Create Suspend Request DTO.
 */
export class CreateSuspendRequestDto {
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
    description: '停课开始日期 (YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsString()
  @IsNotEmpty()
  suspendFrom: string;

  @ApiProperty({
    description: '停课结束日期 (YYYY-MM-DD)',
    example: '2026-08-15',
  })
  @IsString()
  @IsNotEmpty()
  suspendTo: string;

  @ApiProperty({
    description: '停课原因',
    example: '暑期外出旅行，无法按时上课',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
