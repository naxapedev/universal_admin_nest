import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface JwtPayload {
  id: string;
  role: string[];
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
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract token from HttpOnly cookie (same mechanism as Express)
    const token = request.cookies?.['accessToken'];

    if (!token) {
      throw new UnauthorizedException('No access token provided.');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });

      // Attach decoded user to request — accessible via @CurrentUser()
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired.');
    }
  }
}
