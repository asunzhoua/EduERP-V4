import { IsString, IsEnum, IsDateString, IsOptional, MaxLength } from 'class-validator';
import { Gender } from '../enums/gender.enum';

/** 家长编辑孩子信息:仅允许修改基本资料字段,全部可选 */
export class ParentUpdateStudentDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  grade?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  school?: string;
}
