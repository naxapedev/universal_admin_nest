import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  id?: string;
  global_user_id?: string;
  role?: string | string[];
  // companyId?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/**
 * Reads the `accessToken` HttpOnly cookie, verifies the JWT,
 * and attaches the decoded payload to `req.user`.
 *
 * This replaces the Express `auth` middleware.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract token from HttpOnly cookie (same mechanism as Express)
    let token = request.cookies?.['accessToken'];

    // Fallback: Check Authorization Bearer header (useful for Postman or non-browser clients)
    if (!token) {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new UnauthorizedException('No access token provided.');
    }

    try {
      // Decode without verifying to check the header
      const decoded: any = this.jwtService.decode(token, { complete: true });
      if (!decoded) {
        throw new UnauthorizedException('Invalid token format.');
      }

      let payload;
      if (decoded.header && decoded.header.kid) {
        // App Access Token (signed with RS256 using product private key)
        const product = await this.prisma.productRegistry.findUnique({
          where: { product_id: decoded.header.kid }
        });

        if (!product || !product.app_public_key) {
          throw new UnauthorizedException('Invalid product key ID.');
        }

        payload = this.jwtService.verify<JwtPayload>(token, {
          secret: product.app_public_key,
          algorithms: ['RS256']
        });
      } else {
        // Master Access Token (signed with HS256 using JWT_SECRET)
        payload = this.jwtService.verify<JwtPayload>(token);
      }

      // Attach decoded user to request — accessible via @CurrentUser()
      (request as any).user = payload;
      return true;
    } catch (err) {
      console.error('JWT Verification Error:', err.message);
      throw new UnauthorizedException('Access token is invalid or expired.');
    }
  }
}
