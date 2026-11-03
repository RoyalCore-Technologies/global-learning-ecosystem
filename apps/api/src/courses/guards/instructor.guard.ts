import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@platform/types';
import type { AuthenticatedUser } from '../../auth/jwt.strategy.js';

export const AUTHORIZED_COURSE_CREATOR_ROLES: readonly UserRole[] = [
  UserRole.EDUCATOR,
  UserRole.CREATOR,
  UserRole.RESEARCHER,
  UserRole.ADMIN,
] as const;

@Injectable()
export class InstructorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user || !AUTHORIZED_COURSE_CREATOR_ROLES.includes(user.role)) {
      throw new ForbiddenException(
        'Access Denied: Course authoring requires verified EDUCATOR, CREATOR, RESEARCHER, or ADMIN credentials.'
      );
    }

    return true;
  }
}
