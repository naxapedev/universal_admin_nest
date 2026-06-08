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
      const payload = this.jwtService.verify<JwtPayload>(token);

      // Attach decoded user to request — accessible via @CurrentUser()
      (request as any).user = payload;
      return true;
    } catch (err) {
      console.error('JWT Verification Error:', err.message);
      throw new UnauthorizedException('Access token is invalid or expired.');
    }
  }
}
