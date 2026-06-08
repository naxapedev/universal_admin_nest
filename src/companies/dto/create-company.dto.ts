import { IsString, IsEmail, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ContactPersonDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  company_name: string;

  @IsEmail()
  @IsNotEmpty()
  companyEmail: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactPersonDto)
  contactPerson?: ContactPersonDto;
}
