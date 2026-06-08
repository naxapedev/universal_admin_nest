import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import type { Response, Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifySuperAdminDto } from './dto/verify-superadmin.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { CreateSuperAdminDto } from './dto/create-superadmin.dto';

const ALLOWED_PORTAL_ROLES = ['superadmin', 'lead', 'developer'];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  /**
   * Roles are stored directly on PortalUser.role — no membership join needed.
   */
  private extractUniqueRoles(user: { role: string[] }): string[] {
    return [...new Set<string>(user.role)];
  }

  private async buildEnrichedUserAndSendToken(
    user: any,
    allRoles: string[],
    statusCode: number,
    req: Request,
    res: Response,
    rememberMe = false,
  ): Promise<void> {
    const enrichedUser = {
      ...user,
      role: allRoles,
      companyId: null, // PortalUsers are not scoped to a company
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
    };

    await this.createSendToken(enrichedUser, statusCode, req, res, {}, rememberMe);
  }

  /**
   * Signs a JWT access token and stores a refresh token cookie.
   */
  private async createSendToken(
    user: any,
    statusCode: number,
    req: Request,
    res: Response,
    additionalData: Record<string, any> = {},
    rememberMe = false,
  ): Promise<void> {
    const expiresIn = rememberMe
      ? (process.env.REMEMBER_ME_JWT_EXPIRES_IN ?? '30d')
      : (process.env.JWT_EXPIRES_IN ?? '1d');

    const cookieMaxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    // 1. Sign the short-lived access token
    const accessToken = this.jwtService.sign(
      {
        id: user.id,
        role: user.role,
        companyId: null,
      },
      { expiresIn: expiresIn as any },
    );

    // 2. Set access token as HttpOnly cookie
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: cookieMaxAge,
      sameSite: 'lax',
      path: '/',
    });

    // 3. Generate and store refresh token
    const refreshTokenString = crypto.randomBytes(40).toString('hex');
    const refreshExpiresInDays = rememberMe ? 30 : 7;
    const refreshExpiresAt = new Date(
      Date.now() + refreshExpiresInDays * 24 * 60 * 60 * 1000,
    );

    // Links to PortalUser via portal_user_id
    await this.prisma.universalRefreshToken.create({
      data: {
        token: refreshTokenString,
        portal_user_id: user.id,
        expiresAt: refreshExpiresAt,
        userAgent: req.headers['user-agent'] ?? 'unknown',
        ipAddress: req.ip ?? 'unknown',
      },
    });

    // 4. Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshTokenString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: refreshExpiresAt.getTime() - Date.now(),
      sameSite: 'lax',
      path: '/',
    });

    // 5. Send response — strip password before returning
    const { password: _pw, ...safeUser } = user;
    res.status(statusCode).json({
      status: 'success',
      data: {
        user: {
          ...safeUser,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
        },
        ...additionalData,
      },
    });
  }

  // ─────────────────────────────────────────────
  // CREATE SUPER ADMIN
  // ─────────────────────────────────────────────
  async createSuperAdmin(dto: CreateSuperAdminDto, res: Response): Promise<void> {
    const { first_name, last_name, email, password } = dto;

    // Only one superadmin allowed
    const existingSuperAdmin = await this.prisma.portalUser.findFirst({
      where: { role: { has: 'superadmin' } },
    });

    if (existingSuperAdmin) {
      throw new ForbiddenException('A superadmin account is already registered. Only login is allowed.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const superAdmin = await this.prisma.portalUser.create({
      data: {
        email,
        password: hashedPassword,
        first_name,
        last_name,
        role: ['developer'],
        status: 'active',
        isVerified: false,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Super admin created successfully',
      data: {
        id: superAdmin.id,
        first_name: superAdmin.first_name,
        last_name: superAdmin.last_name,
        email: superAdmin.email,
        role: superAdmin.role,
      },
    });
  }

  // ─────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────
  async login(dto: LoginDto, req: Request, res: Response): Promise<void> {
    const { email, password, rememberMe = false } = dto;

    // 1. Find PortalUser by email
    const user = await this.prisma.portalUser.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Incorrect email, please try with a different email!');
    }

    // 2. Collect roles
    const allRoles = this.extractUniqueRoles(user);

    // 3. Check portal access
    const hasPortalAccess = allRoles.some((r) => ALLOWED_PORTAL_ROLES.includes(r));
    if (!hasPortalAccess) {
      throw new BadRequestException('Only authorized users can login to this portal!');
    }

    // 4. Check suspended
    if (user.status === 'suspended') {
      throw new BadRequestException('This user has been suspended, please contact support.');
    }

    // 5. Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new BadRequestException('Invalid password!');
    }

    // 6. SuperAdmin 7-day re-verification
    if (allRoles.includes('superadmin')) {
      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      const lastVerifiedAt = user.lastVerifiedAt
        ? new Date(user.lastVerifiedAt).getTime()
        : 0;
      const sevenDaysPassed = now - lastVerifiedAt > oneWeek;

      if (sevenDaysPassed) {
        const verificationCode = crypto.randomInt(100000, 999999);
        await this.prisma.portalUser.update({
          where: { id: user.id },
          data: {
            isVerified: false,
            verificationCode,
            verificationCodeExpiresAt: new Date(now + 24 * 60 * 60 * 1000),
          },
        });

        await this.emailService.sendVerificationEmail(user.email, verificationCode);

        throw new BadRequestException(
          'Your verification has expired. A new code has been sent to your email. Please verify again to continue.',
        );
      }

      if (!user.isVerified) {
        throw new BadRequestException(
          'Please verify your email to continue. Check your inbox for the verification code.',
        );
      }
    }

    // 7. Update last login timestamp asynchronously (fire-and-forget)
    this.prisma.portalUser.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    }).catch(err => this.logger.error('Failed to update last login', err));

    // 8. Issue tokens
    await this.buildEnrichedUserAndSendToken(user, allRoles, 200, req, res, rememberMe);
  }

  // ─────────────────────────────────────────────
  // SET NEW PASSWORD
  // ─────────────────────────────────────────────
  async setNewPassword(
    userId: string,
    dto: SetPasswordDto,
    res: Response,
  ): Promise<void> {
    const { oldPassword, newPassword } = dto;

    const user = await this.prisma.portalUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found!');

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new BadRequestException('Invalid old password!');

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.portalUser.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully!',
      data: { userId },
    });
  }

  // ─────────────────────────────────────────────
  // CHANGE COMPANY STATUS
  // ─────────────────────────────────────────────
  async changeCompanyStatus(
    companyId: string,
    status: string,
    res: Response,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: status || 'inactive' },
    });

    res.status(200).json({
      status: 'success',
      message: 'Company status updated successfully',
    });
  }

  // ─────────────────────────────────────────────
  // VERIFY SUPER ADMIN (7-day code)
  // ─────────────────────────────────────────────
  async verifySuperAdmin(
    dto: VerifySuperAdminDto,
    req: Request,
    res: Response,
  ): Promise<void> {
    const { email, code } = dto;

    const user = await this.prisma.portalUser.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('User not found');

    const allRoles = this.extractUniqueRoles(user);
    if (!allRoles.includes('superadmin')) {
      throw new ForbiddenException('Access denied. Only super admin can verify.');
    }

    if (user.verificationCode !== parseInt(code, 10)) {
      throw new BadRequestException('Invalid verification code');
    }

    if (
      user.verificationCodeExpiresAt &&
      Date.now() > new Date(user.verificationCodeExpiresAt).getTime()
    ) {
      throw new BadRequestException('Verification code expired');
    }

    await this.prisma.portalUser.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        lastVerifiedAt: new Date(),
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
    });

    await this.buildEnrichedUserAndSendToken(user, allRoles, 200, req, res);
  }

  // ─────────────────────────────────────────────
  // COMPLETE PORTAL USER REGISTRATION
  // Used for onboarding leads / developers via invite link
  // ─────────────────────────────────────────────
  async completeRegistration(
    token: string,
    dto: CompleteRegistrationDto,
    req: Request,
    res: Response,
  ): Promise<void> {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new BadRequestException('Invalid or expired registration token.');
    }

    if (!decoded?.userId) {
      throw new BadRequestException('Invalid token payload.');
    }

    const user = await this.prisma.portalUser.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    await this.prisma.portalUser.update({
      where: { id: user.id },
      data: {
        email: dto.email,
        password: hashedPassword,
        status: 'active',
      },
    });

    const allRoles = this.extractUniqueRoles(user);
    const updatedUser = { ...user, email: dto.email };
    await this.buildEnrichedUserAndSendToken(updatedUser, allRoles, 200, req, res);
  }

  // ─────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────
  async logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.cookies as { refreshToken?: string };

    if (refreshToken) {
      await this.prisma.universalRefreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      });
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
  }

  // ─────────────────────────────────────────────
  // REFRESH SESSION
  // ─────────────────────────────────────────────
  async refreshSession(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.cookies as { refreshToken?: string };

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided.');
    }

    // 1. Look up refresh token record
    const tokenRecord = await this.prisma.universalRefreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (
      !tokenRecord ||
      tokenRecord.revoked ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    // 2. Load PortalUser via portal_user_id
    const user = await this.prisma.portalUser.findFirst({
      where: { id: tokenRecord.portal_user_id ?? '' },
    });

    if (!user) {
      throw new ForbiddenException('User not found or suspended.');
    }

    const allRoles = this.extractUniqueRoles(user);

    // 3. Rotate — revoke old token
    await this.prisma.universalRefreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    // 4. Issue new tokens (rememberMe=true keeps 30-day refresh)
    await this.buildEnrichedUserAndSendToken(user, allRoles, 200, req, res, true);
  }
}
