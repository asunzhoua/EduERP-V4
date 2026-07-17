import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from '../enums/class-status.enum';

export class UpdateClassStatusDto {
  @ApiProperty({ enum: ClassStatus, description: '目标状态' })
  @IsEnum(ClassStatus)
  @IsNotEmpty()
  status: ClassStatus;

  @ApiPropertyOptional({ description: '取消原因 (CANCELLED 时必填)' })
  @IsString()
  @IsOptional()
  cancelledReason?: string;
}
