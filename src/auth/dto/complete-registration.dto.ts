import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CompleteRegistrationDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @IsNotEmpty()
  password: string;
}
