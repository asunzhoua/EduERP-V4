import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeacherRole } from '@common/enums/teacher-role.enum';

export class CreateTeacherAssignmentDto {
  @ApiProperty({ description: '班级编码', example: 'CL2026070001' })
  @IsString()
  @IsNotEmpty()
  classCode: string;

  @ApiProperty({ description: '教师用户 ID', example: 5001 })
  @IsNumber()
  @IsNotEmpty()
  teacherId: number;

  @ApiProperty({ enum: TeacherRole, description: '分配角色' })
  @IsEnum(TeacherRole)
  @IsNotEmpty()
  role: TeacherRole;

  @ApiPropertyOptional({ description: '分配原因' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;
}
