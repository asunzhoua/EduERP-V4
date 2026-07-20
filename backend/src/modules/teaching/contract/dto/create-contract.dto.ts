import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  IsOptional,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Subject } from '@common/enums/subject.enum';

export class CreateContractDto {
  @ApiProperty({ description: 'Student code', example: 'STU20260001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  studentCode!: string;

  @ApiProperty({ description: 'Subject', enum: Subject, example: Subject.MATH })
  @IsEnum(Subject)
  @IsNotEmpty()
  subject!: Subject;

  @ApiProperty({ description: 'Total lessons in contract', example: 30 })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  totalLessons!: number;

  @ApiProperty({
    description: 'Contract valid from date',
    example: '2026-07-01',
  })
  @IsDateString()
  @IsNotEmpty()
  validFrom!: string;

  @ApiProperty({
    description: 'Contract valid to date (optional)',
    example: '2027-06-30',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiProperty({
    description: 'Unit price per lesson',
    example: 200.0,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number | null;

  @ApiProperty({
    description: 'Total contract amount',
    example: 6000.0,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number | null;

  @ApiProperty({
    description: 'Contract notes',
    example: '暑假班特价合同',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiProperty({
    description: 'Tags for the contract',
    example: ['暑假班', '优惠'],
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | null;
}
