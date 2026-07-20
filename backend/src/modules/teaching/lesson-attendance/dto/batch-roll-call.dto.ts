import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RecordAttendanceDto } from './record-attendance.dto';

/**
 * Batch Roll Call DTO — validates input for recording attendance for all students at once.
 */
export class BatchRollCallDto {
  @ApiProperty({
    description: '出勤记录列表',
    type: [RecordAttendanceDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: '至少需要一个出勤记录' })
  @ValidateNested({ each: true })
  @Type(() => RecordAttendanceDto)
  records: RecordAttendanceDto[];
}
