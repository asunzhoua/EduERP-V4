import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChangeRequestType } from '@common/enums/change-request-type.enum';

export class CreateChangeRequestDto {
  @ApiProperty({ description: 'Lesson ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  lessonId!: number;

  @ApiProperty({ description: 'Request type', enum: ChangeRequestType, example: ChangeRequestType.RESCHEDULE })
  @IsEnum(ChangeRequestType)
  @IsNotEmpty()
  requestType!: ChangeRequestType;

  @ApiProperty({ description: 'Reason for the change request', example: '学生需要调课' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Previous lesson date', example: '2026-07-20' })
  @IsOptional()
  @IsDateString()
  previousDate?: string;

  @ApiPropertyOptional({ description: 'New lesson date', example: '2026-07-22' })
  @IsOptional()
  @IsDateString()
  newDate?: string;

  @ApiPropertyOptional({ description: 'Previous start time', example: '09:00' })
  @IsOptional()
  @IsString()
  previousStartTime?: string;

  @ApiPropertyOptional({ description: 'New start time', example: '10:00' })
  @IsOptional()
  @IsString()
  newStartTime?: string;

  @ApiPropertyOptional({ description: 'Previous end time', example: '10:30' })
  @IsOptional()
  @IsString()
  previousEndTime?: string;

  @ApiPropertyOptional({ description: 'New end time', example: '11:30' })
  @IsOptional()
  @IsString()
  newEndTime?: string;

  @ApiPropertyOptional({ description: 'Previous teacher ID', example: 1 })
  @IsOptional()
  @IsNumber()
  previousTeacherId?: number;

  @ApiPropertyOptional({ description: 'New teacher ID', example: 2 })
  @IsOptional()
  @IsNumber()
  newTeacherId?: number;
}
