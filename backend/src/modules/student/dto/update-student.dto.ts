import { IsString, IsOptional, IsEnum, IsArray, IsDateString, MaxLength } from 'class-validator';
import { Gender } from '../enums/gender.enum';

export class UpdateStudentDto {
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
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  school?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  grade?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  note?: string;
}
