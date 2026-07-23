import { IsEnum, IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ReminderType } from '../enums/reminder-type.enum';
import { TargetType } from '../enums/target-type.enum';

export class CreateReminderDto {
  @IsEnum(ReminderType)
  type: ReminderType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  targetUserId: number;

  @IsEnum(TargetType)
  targetType: TargetType;

  @IsOptional()
  @IsNumber()
  relatedEntityId?: number;

  @IsOptional()
  @IsString()
  relatedEntityType?: string;
}
