import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsIn,
  MaxLength,
  Min,
  Max,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClassDto {
  @ApiProperty({
    description: '课程编码 (FK → Course)',
    example: 'CS2026070001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  courseCode: string;

  @ApiProperty({ description: '班级名称', example: '周六上午10点班' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '开课日期', example: '2026-07-12' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @ApiProperty({ description: '总课次数', example: 20 })
  @IsNumber()
  @Min(1)
  totalLessons: number;

  @ApiProperty({ description: '默认每节课分钟数', example: 60 })
  @IsNumber()
  @Min(15)
  defaultDuration: number;

  @ApiProperty({
    description: '上课日 (0=Sun..6=Sat)',
    example: [6],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'dayOfWeek must have at least 1 day' })
  @ArrayMaxSize(7, { message: 'dayOfWeek cannot have more than 7 days' })
  dayOfWeek: number[];

  @ApiProperty({ description: '上课时间', example: '10:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @ApiProperty({ description: '下课时间', example: '11:30' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @ApiPropertyOptional({ description: '招生上限', example: 20, default: 20 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxStudents?: number;

  @ApiPropertyOptional({ description: '教室' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  room?: string;

  @ApiPropertyOptional({ description: '标签', type: [String] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: '内部备注' })
  @IsString()
  @IsOptional()
  note?: string;
}
