import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class LinkParentDto {
  @IsOptional()
  @IsString()
  relation?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
