import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  global_company_id?: string;

  @IsString()
  @IsOptional()
  product_id?: string;
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  product_id?: string;
}

export class VerifyCodeDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  verification_code: string;
}

export class MasterVerifyDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  verification_code: string;

  @IsString()
  @IsNotEmpty()
  new_password: string;
}

export class RefreshAppTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;

  @IsString()
  @IsNotEmpty()
  product_id: string;
}

export class ResendVerificationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
