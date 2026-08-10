import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  device?: string;
}

export class WechatLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class BindWechatDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
