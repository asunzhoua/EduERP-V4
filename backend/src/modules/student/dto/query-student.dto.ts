import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Gender } from '../enums/gender.enum';
import { StudentStatus } from '../enums/student-status.enum';

export class QueryStudentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  studentCode?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsEnum(StudentStatus)
  @IsOptional()
  status?: StudentStatus;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  school?: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
