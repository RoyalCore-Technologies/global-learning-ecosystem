import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException
} from '@nestjs/common';
import { RoleSecurityService } from './role-security.service.js';

@Injectable()
export class RoleAssignmentSecurityGuard implements CanActivate {
  constructor(private readonly roleSecurityService: RoleSecurityService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const body = request.body;

    if (!body || typeof body !== 'object') {
      return true;
    }

    // Check if the request contains a role field
    if ('role' in body && body.role !== undefined) {
      // Check for service-role or admin privilege in user context
      const user = request.user;
      const isServiceOrAdmin =
        user?.role === 'ADMIN' ||
        user?.app_metadata?.role === 'service_role' ||
        user?.user_metadata?.is_admin === true;

      this.roleSecurityService.assertCanAssignRole(body.role, isServiceOrAdmin);
    }

    return true;
  }
}
