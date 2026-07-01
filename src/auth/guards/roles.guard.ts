import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Checks that req.user.role array contains at least one
 * of the roles declared via @Roles(...) on the route handler.
 * Must be used AFTER JwtAuthGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator — route is open to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    let userRoles: string[] = [];

    if (user?.role) {
      userRoles = Array.isArray(user.role) ? user.role : [user.role];
    } else if (user?.visas && Array.isArray(user.visas)) {
      userRoles = user.visas.map((v: any) => v.role);
    }

    // Normalize roles to lowercase to match @Roles decorator values
    const normalizedUserRoles = userRoles.map(r => r?.toLowerCase() || '');
    const normalizedRequiredRoles = requiredRoles.map(r => r.toLowerCase());

    const hasRole = normalizedRequiredRoles.some((r) => normalizedUserRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
