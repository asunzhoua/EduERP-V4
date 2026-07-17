import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Create Enrollment DTO — validates input for enrolling a student in a class.
 */
export class CreateEnrollmentDto {
  @ApiProperty({
    description: '班级编码',
    example: 'CLS2026070001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  classCode: string;

  @ApiProperty({
    description: '学生编码',
    example: 'STU20260001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  studentCode: string;

  @ApiProperty({
    description: '合同编码',
    example: 'CTR2026070001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  contractCode: string;
}