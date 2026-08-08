import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,64}$/;

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(64)
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(64)
  @Matches(PASSWORD_PATTERN, {
    message: '新密码需包含大小写字母和数字，长度 6-64 位',
  })
  newPassword: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(64)
  @Matches(PASSWORD_PATTERN, {
    message: '新密码需包含大小写字母和数字，长度 6-64 位',
  })
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  operatorPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
