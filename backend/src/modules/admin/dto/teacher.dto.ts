import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsNumberString,
  Matches,
} from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @MaxLength(50)
  username: string;

  @IsString()
  @IsNotEmpty({ message: '姓名不能为空' })
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @MaxLength(20)
  mobile: string;

  @IsString()
  @IsNotEmpty({ message: '初始密码不能为空' })
  @MaxLength(100)
  password: string;
}

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string;
}

export class UpdateTeacherStatusDto {
  /** 1=启用 0=停用 */
  @IsNumberString()
  status: string;
}

export class QueryTeacherDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;

  @IsOptional()
  @IsNumberString()
  status?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  pageSize?: string;
}
