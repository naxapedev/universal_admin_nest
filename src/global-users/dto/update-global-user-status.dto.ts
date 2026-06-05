import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateGlobalUserStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['Active', 'Suspended'], {
    message: 'Invalid status. Must be Active or Suspended.',
  })
  status!: string;
}
