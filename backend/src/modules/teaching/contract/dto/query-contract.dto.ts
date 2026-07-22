import { IsEnum, IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Subject } from '@common/enums/subject.enum';
import { ContractStatus } from '../enums/contract-status.enum';

export class QueryContractDto {
  @ApiPropertyOptional({ description: '按学生编号筛选' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  studentCode?: string;

  @ApiPropertyOptional({ enum: Subject, description: '按学科筛选' })
  @IsEnum(Subject)
  @IsOptional()
  subject?: Subject;

  @ApiPropertyOptional({ enum: ContractStatus, description: '按状态筛选' })
  @IsEnum(ContractStatus)
  @IsOptional()
  status?: ContractStatus;

  @ApiPropertyOptional({ default: 1, description: '页码' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, description: '每页数量' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}
