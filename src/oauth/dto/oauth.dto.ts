import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AuthorizeDto {
  @IsString()
  @IsNotEmpty()
  client_id: string; // product_id

  @IsString()
  @IsNotEmpty()
  redirect_uri: string;

  @IsString()
  @IsNotEmpty()
  response_type: string; // must be "code"

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsNotEmpty()
  code_challenge: string;

  @IsString()
  @IsNotEmpty()
  code_challenge_method: string; // "S256"
}

export class TokenExchangeDto {
  @IsString()
  @IsNotEmpty()
  grant_type: string; // "authorization_code"

  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  client_secret: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  redirect_uri: string;

  @IsString()
  @IsNotEmpty()
  code_verifier: string;
}
