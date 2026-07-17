import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { {{NAME}}Status } from '../enums/{{NAME_KEBAB}}-status.enum';

export class Query{{NAME}}Dto {
  @ApiPropertyOptional({ description: 'Filter by name (fuzzy)' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: {{NAME}}Status })
  @IsEnum({{NAME}}Status)
  @IsOptional()
  status?: {{NAME}}Status;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}
