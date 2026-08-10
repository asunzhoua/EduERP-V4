import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Gender } from '../enums/gender.enum';

/** 家长自助添加孩子（我的孩子 → 添加小朋友） */
export class ParentCreateStudentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender;

  @IsDateString()
  @IsNotEmpty()
  birthDate: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  grade: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  school?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  classCode?: string;
}
