import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateParentDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsOptional()
  studentId?: number;
}

export class QueryParentsDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
