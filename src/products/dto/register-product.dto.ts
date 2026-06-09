import { IsString, IsEnum, IsOptional, IsNotEmpty, IsArray } from 'class-validator';
import { ArchitectureType, DbDriver } from '@prisma/client';

export class RegisterProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ArchitectureType)
  architecture_type: ArchitectureType;

  @IsEnum(DbDriver)
  db_driver: DbDriver;

  @IsString()
  @IsNotEmpty()
  db_uri: string;

  @IsOptional()
  @IsArray()
  ui_schema?: any[];
}
