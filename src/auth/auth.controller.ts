import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifySuperAdminDto } from './dto/verify-superadmin.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { CreateSuperAdminDto } from './dto/create-superadmin.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('server1/api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/superadmin
   * Public — creates the initial superadmin account
   */
  @Post('superadmin')
  async createSuperAdmin(
    @Body() dto: CreateSuperAdminDto,
    @Res() res: Response,
  ): Promise<void> {
    return this.authService.createSuperAdmin(dto, res);
  }

  /**
   * POST /auth/login
   * Public — validates credentials and sets HttpOnly cookies
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.authService.login(dto, req, res);
  }

  /**
   * PATCH /auth/set-new-password/:id
   * Protected — requires valid JWT; restricted to 'admin' role
   */
  @Patch('set-new-password/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setNewPassword(
    @Param('id') id: string,
    @Body() dto: SetPasswordDto,
    @Res() res: Response,
  ): Promise<void> {
    return this.authService.setNewPassword(id, dto, res);
  }

  /**
   * PATCH /auth/change-status/:id
   * Protected — requires valid JWT; restricted to 'superadmin' role
   */
  @Patch('change-status/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  async changeCompanyStatus(
    @Param('id') companyId: string,
    @Body('status') status: string,
    @Res() res: Response,
  ): Promise<void> {
    return this.authService.changeCompanyStatus(
      companyId,
      status,
      res,
    );
  }

  /**
   * PATCH /auth/complete/:token
   * Public — finishes company registration via one-time JWT link
   */
  @Patch('complete/:token')
  async completeRegistration(
    @Param('token') token: string,
    @Body() dto: CompleteRegistrationDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.authService.completeRegistration(token, dto, req, res);
  }

  /**
   * PATCH /auth/verify
   * Public — superadmin submits email + 6-digit code to satisfy 7-day re-verification
   */
  @Patch('verify')
  async verifySuperAdmin(
    @Body() dto: VerifySuperAdminDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.authService.verifySuperAdmin(dto, req, res);
  }

  /**
   * POST /auth/logout
   * Public — revokes refresh token and clears both cookies
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.authService.logout(req, res);
  }

  /**
   * POST /auth/refresh
   * Public — reads refreshToken cookie, rotates tokens, issues new cookies
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.authService.refreshSession(req, res);
  }
}
