import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateHelpRequestDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsEnum(['Low', 'Normal', 'High', 'Urgent'])
  priority?: string;
}

export class UpdateHelpRequestStatusDto {
  @IsString()
  @IsEnum(['Open', 'In Progress', 'Resolved', 'Closed'])
  status: string;
}
