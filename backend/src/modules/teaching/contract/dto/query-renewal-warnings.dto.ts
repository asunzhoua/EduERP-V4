import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryRenewalWarningsDto {
  @ApiPropertyOptional({ description: '预警阈值（缺省用配置 RENEWAL_WARNING_THRESHOLD）' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  threshold?: number;
}
