import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** 课时变更审计分页查询参数 */
export class QueryLessonAuditDto {
  @ApiProperty({ description: '动作 ADD/DELETE/SET', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  action?: string;

  @ApiProperty({
    description: '来源 ADMIN_MANUAL/IMPORT/PROMO/CONTRACT_CREATE',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  source?: string;

  @ApiProperty({ description: '操作者 ID', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  operatorId?: number;

  @ApiProperty({ description: '开始日期 YYYY-MM-DD', required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ description: '结束日期 YYYY-MM-DD', required: false })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ description: '页码', default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ description: '每页条数', default: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
