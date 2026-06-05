import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['active', 'inactive', 'suspended'], {
    message: 'Invalid status. Must be active, inactive, or suspended.',
  })
  status!: string;
}