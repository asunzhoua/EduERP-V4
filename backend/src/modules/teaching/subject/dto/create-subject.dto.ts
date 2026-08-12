import { IsString, IsNotEmpty, MaxLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SUBJECT_CATEGORIES } from '../subject-catalog';

export class CreateSubjectDto {
  @ApiProperty({ description: '学科中文名称', example: '编程思维' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  name!: string;

  @ApiProperty({
    description: '学科分组',
    enum: SUBJECT_CATEGORIES,
    example: 'STEM',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(SUBJECT_CATEGORIES)
  category!: string;
}
