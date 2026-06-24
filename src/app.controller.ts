import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('.well-known/openid-configuration')
  getOpenIdConfiguration() {
    const issuer = process.env.ISSUER_URL || 'http://localhost:4000';
    return {
      issuer,
      authorization_endpoint: `${issuer}/server1/api/v1/oauth/authorize`,
      token_endpoint: `${issuer}/server1/api/v1/oauth/token`,
      userinfo_endpoint: `${issuer}/server1/api/v1/oauth/userinfo`,
      jwks_uri: `${issuer}/server1/api/v1/oauth/jwks`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'profile', 'email'],
    };
  }
}