import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@platform/types';
import type { AuthenticatedUser } from '../../auth/jwt.strategy.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access Denied: Platform administrator credentials required.');
    }

    return true;
  }
}
