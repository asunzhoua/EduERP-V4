import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClassDto {
  @ApiPropertyOptional({ description: '班级名称' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '开课日期' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiPropertyOptional({ description: '总课次数' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  totalLessons?: number;

  @ApiPropertyOptional({ description: '默认每节课分钟数' })
  @IsNumber()
  @IsOptional()
  @Min(15)
  defaultDuration?: number;

  @ApiPropertyOptional({ description: '上课日 (0=Sun..6=Sat)', type: [Number] })
  @IsArray()
  @IsOptional()
  dayOfWeek?: number[];

  @ApiPropertyOptional({ description: '上课时间' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string;

  @ApiPropertyOptional({ description: '下课时间' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string;

  @ApiPropertyOptional({ description: '招生上限' })
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
