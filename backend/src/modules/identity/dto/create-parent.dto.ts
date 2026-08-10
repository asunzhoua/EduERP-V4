import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsIn,
} from 'class-validator';

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

export class UpdateParentStatusDto {
  /** 1=启用 0=停用 */
  @IsNumberString({}, { message: 'status 必须是数字字符串' })
  @IsIn(['0', '1'], { message: 'status 只能为 0（停用）或 1（启用）' })
  status: string;
}

export class QueryParentsDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsNumberString()
  status?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
