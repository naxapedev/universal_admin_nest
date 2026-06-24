import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export enum VisaRole {
  Admin = 'Admin',
  User = 'User',
}

export class AssignVisaDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsEnum(VisaRole)
  @IsNotEmpty()
  role: VisaRole;
}
