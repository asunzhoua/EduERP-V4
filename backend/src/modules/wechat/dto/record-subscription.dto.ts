import { Type } from 'class-transformer';
import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsIn,
  ValidateNested,
} from 'class-validator';

export class SubscriptionItemDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsString()
  @IsNotEmpty()
  templateType: string;

  @IsString()
  @IsIn(['accept', 'reject', 'ban'])
  status: string;
}

export class RecordSubscriptionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionItemDto)
  subscriptions: SubscriptionItemDto[];
}
