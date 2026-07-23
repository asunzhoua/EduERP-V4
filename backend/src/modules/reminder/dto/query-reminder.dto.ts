import { IsEnum, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ReminderType } from '../enums/reminder-type.enum';
import { ReminderStatus } from '../enums/reminder-status.enum';

export class QueryReminderDto {
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;
}
