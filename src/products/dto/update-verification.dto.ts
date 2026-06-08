import { IsEnum, IsNotEmpty } from 'class-validator';
import { VerificationMethod } from '@prisma/client';

export class UpdateVerificationMethodDto {
  @IsEnum(VerificationMethod)
  @IsNotEmpty()
  verification_method: VerificationMethod;
}
