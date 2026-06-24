import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Old password is required.' })
  oldPassword: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters.' })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, { message: 'Password must contain at least one uppercase letter and one number' })
  newPassword: string;
}
