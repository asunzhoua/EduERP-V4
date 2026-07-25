import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryExceptionDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'], description: '审批状态' })
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional({
    enum: ['LEAVE_SICK', 'LEAVE_PERSONAL', 'LEAVE_TRAINING', 'SUSPEND_SHORT', 'SUSPEND_LONG'],
    description: '异常类型',
  })
  @IsOptional()
  @IsString()
  exceptionType?: string;

  @ApiPropertyOptional({ description: '开始日期（含）' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期（含）' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
