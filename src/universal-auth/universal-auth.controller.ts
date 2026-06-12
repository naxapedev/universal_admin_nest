import { Controller, Post, Body, Get, Param, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { UniversalAuthService } from './universal-auth.service';
import { SignupDto, LoginDto, MasterVerifyDto, RefreshAppTokenDto, ResendVerificationDto, VerifyCodeDto } from './dto/universal-auth.dto';
import type { Request, Response } from 'express';

@Controller('server1/api/v1/universal-auth')
export class UniversalAuthController {
  constructor(private readonly universalAuthService: UniversalAuthService) {}

  @Post('signup')
  async masterSignup(@Body() dto: SignupDto) {
    return this.universalAuthService.masterSignup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async masterLogin(@Body() dto: LoginDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;
    return this.universalAuthService.masterLogin(dto, userAgent, ipAddress);
  }

  @Post('verify-code')
  async verifyUserCode(@Body() dto: VerifyCodeDto) {
    return this.universalAuthService.verifyUserCode(dto);
  }

  @Get('verify-link/:token')
  async verifyUserLink(@Param('token') token: string, @Res() res: Response) {
    const redirectUrl = await this.universalAuthService.verifyUserLink(token);
    return res.redirect(`${redirectUrl}?verified=true`);
  }

  @Post('resend-verification')
  async resendUserVerification(@Body() dto: ResendVerificationDto) {
    return this.universalAuthService.resendUserVerification(dto);
  }

  @Post('master-verify')
  async masterVerify(@Body() dto: MasterVerifyDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;
    return this.universalAuthService.masterVerify(dto, userAgent, ipAddress);
  }

  @Post('refresh-app-token')
  async refreshAppToken(@Body() dto: RefreshAppTokenDto) {
    return this.universalAuthService.refreshAppToken(dto);
  }
}
