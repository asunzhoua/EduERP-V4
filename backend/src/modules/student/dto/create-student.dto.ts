import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsDateString, MinLength, MaxLength } from 'class-validator';
import { Gender } from '../enums/gender.enum';
import { StudentStatus } from '../enums/student-status.enum';

export class CreateStudentDto {
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

  /** Optional: parent IDs to link on creation */
  @IsArray()
  @IsOptional()
  parentIds?: number[];
}
