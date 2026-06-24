import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  MinLength,
  Matches,
} from 'class-validator';

@ValidatorConstraint({ name: 'PasswordMatch', async: false })
class PasswordMatch implements ValidatorConstraintInterface {
  validate(confirmPassword: unknown, args: ValidationArguments) {
    if (confirmPassword === undefined) return true;
    return (args.object as CreateSuperAdminDto).password === confirmPassword;
  }
  defaultMessage(_args: ValidationArguments) {
    return 'confirmPassword must match password';
  }
}

export class CreateSuperAdminDto {
  @IsNotEmpty()
  @IsString()
  first_name!: string;

  @IsNotEmpty()
  @IsString()
  last_name!: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, { message: 'Password must contain at least one uppercase letter and one number' })
  password!: string;

  /**
   * Optional but validated when present.
   * Role is NOT accepted from the client — it is always hardcoded to ['superadmin'] in the service.
   */
  @IsOptional()
  @IsString()
  @Validate(PasswordMatch)
  confirmPassword?: string;
}
