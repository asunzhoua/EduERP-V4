import {
  IsEnum,
  IsString,
  IsArray,
  IsDateString,
  IsBoolean,
  MinLength,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplySuspendDto {
  @ApiProperty({
    enum: ['SUSPEND_SHORT', 'SUSPEND_LONG'],
    description: '停课类型（短期/长期）',
  })
  @IsEnum(['SUSPEND_SHORT', 'SUSPEND_LONG'])
  exceptionType: 'SUSPEND_SHORT' | 'SUSPEND_LONG';

  @ApiProperty({ type: [Number], description: '课程ID列表' })
  @IsArray()
  @ArrayMinSize(1)
  lessonIds: number[];

  @ApiProperty({ description: '停课原因' })
  @IsString()
  @MinLength(1)
  reason: string;

  @ApiProperty({ description: '开始时间' })
  @IsDateString()
  startTime: Date;

  @ApiProperty({ description: '结束时间' })
  @IsDateString()
  endTime: Date;

  @ApiProperty({ description: '是否自动恢复' })
  @IsBoolean()
  autoRestore: boolean;
}
