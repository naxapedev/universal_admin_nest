import { IsString, IsEmail, IsOptional, IsNotEmpty, MinLength, Matches, IsBoolean } from 'class-validator';

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, { message: 'Password must contain at least one uppercase letter and one number' })
  password: string;

  @IsString()
  @IsOptional()
  global_company_id?: string;

  @IsString()
  @IsOptional()
  product_id?: string;

  @IsBoolean()
  @IsOptional()
  skipVerificationEmail?: boolean;
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
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, { message: 'Password must contain at least one uppercase letter and one number' })
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

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, { message: 'Password must contain at least one uppercase letter and one number' })
  new_password: string;
}

export class ChangePasswordDto {
  @IsEmail()
  @IsNotEmpty()
  target_email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, { message: 'Password must contain at least one uppercase letter and one number' })
  new_password: string;
}

export class UpdateUnverifiedEmailDto {
  @IsEmail()
  @IsNotEmpty()
  current_email: string;

  @IsEmail()
  @IsNotEmpty()
  new_email: string;

  @IsString()
  @IsNotEmpty()
  product_id: string;

  @IsBoolean()
  @IsOptional()
  skipVerificationEmail?: boolean;
}