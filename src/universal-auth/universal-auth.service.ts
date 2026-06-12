


import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { SignupDto, LoginDto, MasterVerifyDto, RefreshAppTokenDto, ResendVerificationDto, VerifyCodeDto } from './dto/universal-auth.dto';

@Injectable()
export class UniversalAuthService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private jwtService: JwtService,
  ) {}

  private generateVerificationCode(): string {
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  }

  private async buildAppAccessToken(user: any, product_id: string): Promise<{ accessToken: string, product_name: string }> {
    const product = await this.prisma.productRegistry.findUnique({
      where: { product_id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let visa = await this.prisma.visa.findFirst({
      where: {
        globalUserId: user.global_user_id,
        productId: product.product_id,
      },
    });

    if (!visa) {
      visa = await this.prisma.visa.create({
        data: {
          globalUserId: user.global_user_id,
          productId: product.product_id,
          role: 'User',
          status: 'Active',
        },
      });
    } else if (visa.status !== 'Active') {
      throw new ForbiddenException(`Your access to ${product.name} is ${visa.status.toLowerCase()}`);
    }

    const username = user.username || user.email;
    const payload = {
      global_user_id: user.global_user_id,
      global_company_id: user.global_company_id,
      email: user.email,
      username,
      visas: [
        { product: product.name, role: visa.role, status: visa.status }
      ],
      aud: product.name
    };

    const newAppAccessToken = this.jwtService.sign(payload, {
      secret: product.app_private_key,
      algorithm: 'RS256',
      expiresIn: '1h',
      issuer: 'Universal-Master',
    });

    return { accessToken: newAppAccessToken, product_name: product.name };
  }

  async masterSignup(dto: SignupDto) {
    const { username, email, password, global_company_id, product_id } = dto;

    const existingUser = await this.prisma.globalUser.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    let product = null;
    let verificationMethod = 'none';

    if (product_id) {
      product = await this.prisma.productRegistry.findUnique({ where: { product_id } });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      verificationMethod = product.verification_method || 'none';
    }

    const password_hash = await bcrypt.hash(password, 10);
    const status = verificationMethod === 'none' ? 'Active' : 'Pending';

    const userData: any = {
      username,
      email,
      password_hash,
      global_company_id: global_company_id || null,
      status,
    };

    if (verificationMethod === 'code') {
      userData.verification_code = this.generateVerificationCode();
    } else if (verificationMethod === 'link') {
      userData.verification_token = crypto.randomUUID();
      userData.verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const user = await this.prisma.globalUser.create({ data: userData });

    if (product) {
      const existingVisa = await this.prisma.visa.findFirst({
        where: {
          globalUserId: user.global_user_id,
          productId: product.product_id,
        }
      });

      if (!existingVisa) {
        await this.prisma.visa.create({
          data: {
            globalUserId: user.global_user_id,
            productId: product.product_id,
            role: 'User',
            status: 'Active',
          }
        });
      }
    }

    if (verificationMethod === 'code') {
      await this.emailService.sendVerificationEmail(user.email, parseInt(userData.verification_code));
      return {
        status: 'verification_required',
        method: 'code',
        email: user.email,
        message: 'A verification code has been sent to your email',
      };
    }

    if (verificationMethod === 'link') {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000/server1/api/v1';
      const verificationLink = `${backendUrl}/universal-auth/verify-link/${userData.verification_token}`;
      await this.emailService.sendVerificationLinkEmail(user.email, verificationLink);
      return {
        status: 'verification_required',
        method: 'link',
        email: user.email,
        message: 'A verification link has been sent to your email',
      };
    }

    return {
      status: 'success',
      global_user_id: user.global_user_id,
      email: user.email,
      username: user.username,
      global_company_id: user.global_company_id,
    };
  }

  async masterLogin(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    const { email, password, product_id } = dto;

    const user = await this.prisma.globalUser.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    if (user.status === 'Suspended') {
      throw new ForbiddenException('User is suspended');
    }

    if (user.status === 'Pending') {
      return {
        status: 'verification_required',
        message: 'Please verify your email before logging in',
        email: user.email,
        method: user.verification_code ? 'code' : user.verification_token ? 'link' : 'unknown'
      };
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new BadRequestException('Invalid credentials');
    }

    if (user.global_company_id) {
      const actualCompany = await this.prisma.company.findFirst({
        where: {
          OR: [
            { id: user.global_company_id },
            { admin_global_user_id: user.global_user_id }
          ]
        }
      });

      if (actualCompany && actualCompany.status === 'inactive') {
        if (user.verification_code) {
          return {
            status: 'verification_required',
            message: 'Verification required',
            user: {
              email: user.email,
              username: user.username || user.email
            }
          };
        }
        throw new ForbiddenException('Account is inactive. Please contact support.');
      }
    }

    const visas = await this.prisma.visa.findMany({
      where: {
        globalUserId: user.global_user_id,
        status: 'Active'
      }
    });

    const username = user.username || user.email;

    const refreshTokenString = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.universalRefreshToken.create({
      data: {
        token: refreshTokenString,
        global_user_id: user.global_user_id,
        expiresAt,
        userAgent,
        ipAddress,
      }
    });

    const responseBody: any = {
      refreshToken: refreshTokenString,
      user: {
        global_user_id: user.global_user_id,
        global_company_id: user.global_company_id,
        email: user.email,
        username,
        visas,
      }
    };

    if (product_id) {
      const appToken = await this.buildAppAccessToken(user, product_id);
      responseBody.appAccessToken = appToken.accessToken;
      responseBody.product_name = appToken.product_name;
    } else {
      const accessToken = this.jwtService.sign(
        {
          global_user_id: user.global_user_id,
          global_company_id: user.global_company_id,
          email: user.email,
          username
        },
        { secret: process.env.JWT_SECRET || 'master_secret', expiresIn: '15m' }
      );
      responseBody.accessToken = accessToken;
    }

    console.log('[DEBUG] masterLogin returning:', JSON.stringify(responseBody, null, 2));
    return responseBody;
  }

  async verifyUserCode(dto: VerifyCodeDto) {
    const { email, verification_code } = dto;

    const user = await this.prisma.globalUser.findFirst({
      where: { email, verification_code, status: 'Pending' }
    });

    if (!user) {
      throw new BadRequestException('Invalid verification code or email');
    }

    await this.prisma.globalUser.update({
      where: { id: user.id },
      data: {
        status: 'Active',
        verification_code: null,
      }
    });

    return {
      status: 'success',
      message: 'Email verified successfully. You can now log in.',
      email: user.email,
    };
  }

  async verifyUserLink(token: string) {
    const user = await this.prisma.globalUser.findFirst({
      where: {
        verification_token: token,
        status: 'Pending',
        verification_expires_at: { gt: new Date() }
      }
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    await this.prisma.globalUser.update({
      where: { id: user.id },
      data: {
        status: 'Active',
        verification_token: null,
        verification_expires_at: null,
      }
    });

    const visa = await this.prisma.visa.findFirst({
      where: { globalUserId: user.global_user_id, status: 'Active' }
    });

    let redirectUrl = process.env.DEFAULT_FRONTEND_URL || 'http://localhost:5173/login';

    if (visa) {
      const product = await this.prisma.productRegistry.findUnique({
        where: { product_id: visa.productId }
      });
      if (product && product.frontend_url) {
        redirectUrl = `${product.frontend_url}/login`;
      }
    }

    return redirectUrl;
  }

  async resendUserVerification(dto: ResendVerificationDto) {
    const { email } = dto;

    const user = await this.prisma.globalUser.findFirst({
      where: { email, status: 'Pending' }
    });

    if (!user) {
      throw new BadRequestException('No pending verification found for this email');
    }

    const visa = await this.prisma.visa.findFirst({
      where: { globalUserId: user.global_user_id, status: 'Active' }
    });

    let verificationMethod = 'code';

    if (visa) {
      const product = await this.prisma.productRegistry.findUnique({
        where: { product_id: visa.productId }
      });
      if (product) {
        verificationMethod = product.verification_method || 'code';
      }
    }

    if (verificationMethod === 'code') {
      const newCode = this.generateVerificationCode();
      
      await this.prisma.globalUser.update({
        where: { id: user.id },
        data: {
          verification_code: newCode,
          verification_token: null,
        }
      });

      await this.emailService.sendVerificationEmail(user.email, parseInt(newCode));

      return {
        status: 'success',
        method: 'code',
        message: 'Verification code resent successfully',
      };
    }

    if (verificationMethod === 'link') {
      const newToken = crypto.randomUUID();
      
      await this.prisma.globalUser.update({
        where: { id: user.id },
        data: {
          verification_token: newToken,
          verification_code: null,
          verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000/server1/api/v1';
      const verificationLink = `${backendUrl}/universal-auth/verify-link/${newToken}`;
      await this.emailService.sendVerificationLinkEmail(user.email, verificationLink);

      return {
        status: 'success',
        method: 'link',
        message: 'Verification link resent successfully',
      };
    }

    throw new BadRequestException('Unable to determine verification method');
  }

  async masterVerify(dto: MasterVerifyDto, userAgent?: string, ipAddress?: string) {
    const { email, verification_code, new_password } = dto;

    const user = await this.prisma.globalUser.findFirst({
      where: { email, verification_code }
    });

    if (!user) {
      throw new BadRequestException('Invalid verification code or email');
    }

    const password_hash = await bcrypt.hash(new_password, 10);

    await this.prisma.globalUser.update({
      where: { id: user.id },
      data: {
        password_hash,
        verification_code: null,
      }
    });

    if (user.global_company_id) {
      await this.prisma.company.updateMany({
        where: {
          OR: [
            { id: user.global_company_id },
            { admin_global_user_id: user.global_user_id }
          ]
        },
        data: { status: 'active' }
      });
    }

    const visas = await this.prisma.visa.findMany({
      where: { globalUserId: user.global_user_id, status: 'Active' }
    });

    const username = user.username || user.email;
    const accessToken = this.jwtService.sign(
      {
        global_user_id: user.global_user_id,
        global_company_id: user.global_company_id,
        email: user.email,
        username
      },
      { secret: process.env.JWT_SECRET || 'master_secret', expiresIn: '15m' }
    );

    const refreshTokenString = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.universalRefreshToken.create({
      data: {
        token: refreshTokenString,
        global_user_id: user.global_user_id,
        expiresAt,
        userAgent,
        ipAddress,
      }
    });

    return {
      message: 'Account verified and password updated successfully',
      accessToken,
      refreshToken: refreshTokenString,
      user: {
        global_user_id: user.global_user_id,
        global_company_id: user.global_company_id,
        email: user.email,
        username,
        visas
      }
    };
  }

  async refreshAppToken(dto: RefreshAppTokenDto) {
    const { refresh_token, product_id } = dto;

    const activeRefreshToken = await this.prisma.universalRefreshToken.findFirst({
      where: {
        token: refresh_token,
        revoked: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!activeRefreshToken) {
      throw new UnauthorizedException('Invalid, expired, or revoked refresh token');
    }

    const global_user_id = activeRefreshToken.global_user_id;

    const user = await this.prisma.globalUser.findUnique({
      where: { global_user_id: global_user_id! }
    });

    if (!user || user.status === 'Suspended') {
      throw new ForbiddenException('User suspended or not found');
    }

    const appToken = await this.buildAppAccessToken(user, product_id);

    return {
      accessToken: appToken.accessToken,
      product_name: appToken.product_name,
    };
  }
}
