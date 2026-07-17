import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Create{{NAME}}Dto {
  @ApiProperty({ description: '{{NAME}} code', example: '{{MODULE_KEBAB}}2026070001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  {{NAME_CAMEL}}Code: string;

  @ApiProperty({ description: '{{NAME}} name', example: 'Sample {{NAME}}' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
