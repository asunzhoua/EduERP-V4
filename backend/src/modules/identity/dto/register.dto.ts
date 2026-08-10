import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
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
  @IsIn(['Parent', 'Teacher'], {
    message: '角色只能是家长(Parent)或教师(Teacher)',
  })
  role?: string;
}
