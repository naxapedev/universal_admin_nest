import { IsNotEmpty, IsString } from 'class-validator';

export class AssignUserToCompanyDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;
}
