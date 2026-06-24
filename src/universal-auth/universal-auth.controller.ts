import { Controller, Post, Body, Get, Param, Req, Res, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { UniversalAuthService } from './universal-auth.service';
import { SignupDto, LoginDto, MasterVerifyDto, RefreshAppTokenDto, ResendVerificationDto, VerifyCodeDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/universal-auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.universalAuthService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.universalAuthService.resetPassword(dto.token, dto.new_password);
  }

  @Post('admin-change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'company_admin', 'admin')
  async adminChangePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    const userId = req.user.id || req.user.global_user_id;
    const roles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    return this.universalAuthService.adminChangePassword(userId, roles, dto.target_email, dto.new_password);
  }
}
