import { Controller, Post, Body, Get, Param, Req, Res, HttpCode, HttpStatus, UseGuards, Logger } from '@nestjs/common';
import { UniversalAuthService } from './universal-auth.service';
import { SignupDto, LoginDto, MasterVerifyDto, RefreshAppTokenDto, ResendVerificationDto, VerifyCodeDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto, UpdateUnverifiedEmailDto, HydrateSessionDto } from './dto/universal-auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Request, Response } from 'express';

const logger = new Logger('UniversalAuthController');

@Controller('server1/api/v1/universal-auth')
export class UniversalAuthController {
  constructor(private readonly universalAuthService: UniversalAuthService) {}

  @Post('signup')
  async masterSignup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.universalAuthService.masterSignup(dto, req.headers.authorization);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async masterLogin(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;
    logger.log(`[LOGIN] Attempt for email=${dto.email} product_id=${dto.product_id || 'none'} ip=${ipAddress}`);

    const result = await this.universalAuthService.masterLogin(dto, userAgent, ipAddress);

    // If login succeeded and a refresh token was issued, set the UAI session cookie.
    // This HttpOnly cookie lives on the UAI domain (port 4000).
    // Products redirect to GET /oauth/silent-authorize which reads this cookie
    // to enable cross-product SSO without re-entering a password.
    if (result.refreshToken) {
      res.cookie('uai_session', result.refreshToken, {
        httpOnly: true,          // JS cannot read this cookie — XSS-safe
        sameSite: 'none',        // 'none' needed for cross-site SSO
        secure: true,            // 'secure' is required by browsers when SameSite=None
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (same as the refresh token TTL)
        path: '/',
      });
      logger.log(`[LOGIN] UAI session cookie set for global_user_id=${result.user?.global_user_id}`);
    }

    return res.json(result);
  }

  @Post('hydrate-session')
  @HttpCode(HttpStatus.OK)
  async hydrateSession(@Body() dto: HydrateSessionDto, @Res() res: Response) {
    // 1. Verify the token exists and is valid
    const tokenData = await this.universalAuthService.verifyRefreshToken(dto.refreshToken);
    if (!tokenData) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid or expired refresh token' });
    }

    // 2. Set the UAI session cookie on the UAI domain
    res.cookie('uai_session', dto.refreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    logger.log(`[HYDRATE-SESSION] UAI session cookie set for global_user_id=${tokenData.global_user_id}`);
    return res.json({ message: 'Session hydrated successfully' });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies?.uai_session || req.body?.refreshToken;
    
    if (refreshToken) {
      await this.universalAuthService.logout(refreshToken);
    }
    
    // Clear the UAI session cookie
    res.clearCookie('uai_session', {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
    });
    
    return res.json({ message: 'Logged out successfully' });
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
    
    let roles: string[] = [];
    if (req.user.role) {
      roles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    } else if (req.user.visas) {
      roles = req.user.visas.map((v: any) => v.role?.toLowerCase());
    }

    return this.universalAuthService.adminChangePassword(userId, roles, dto.target_email, dto.new_password);
  }

  @Post('update-unverified-email')
  async updateUnverifiedEmail(@Body() dto: UpdateUnverifiedEmailDto, @Req() req: Request) {
    return this.universalAuthService.updateUnverifiedEmail(dto, req.headers.authorization);
  }
}