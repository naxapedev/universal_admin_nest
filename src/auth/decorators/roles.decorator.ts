import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Attach required roles to a route handler.
 * Example: @Roles('superadmin', 'lead')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
