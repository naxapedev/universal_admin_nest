import { IsEmail, IsNotEmpty, IsNumberString } from 'class-validator';

export class VerifySuperAdminDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email: string;

  @IsNotEmpty({ message: 'Verification code is required.' })
  @IsNumberString({}, { message: 'Verification code must be a numeric string.' })
  code: string;
}
