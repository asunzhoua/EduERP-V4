import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ClassroomStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export class UpdateClassroomStatusDto {
  @ApiProperty({
    enum: ClassroomStatus,
    description: '目标状态（DISABLED=停用/软删）',
  })
  @IsEnum(ClassroomStatus)
  @IsNotEmpty()
  status: ClassroomStatus;
}
