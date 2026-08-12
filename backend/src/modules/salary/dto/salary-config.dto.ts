import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** 更新工资模块全局配置（社保 + 个税 总开关） */
export class UpdateSalaryConfigDto {
  @ApiProperty({ description: '社保 + 个税 总开关；true 开启，false 关闭' })
  @IsBoolean()
  enabled: boolean;
}
