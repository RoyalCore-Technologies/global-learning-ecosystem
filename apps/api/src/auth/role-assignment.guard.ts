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
      // Strictly enforce Security Rule 1: Never authorize based on client-writable user_metadata!
      // Only trusted server-verified roles (from app_metadata or database profile) or service-role are allowed.
      const user = request.user;
      const isServiceOrAdmin =
        user?.role === 'ADMIN' ||
        user?.dbRole === 'service_role' ||
        user?.app_metadata?.role === 'ADMIN' ||
        user?.app_metadata?.role === 'service_role';

      this.roleSecurityService.assertCanAssignRole(body.role, isServiceOrAdmin);
    }

    return true;
  }
}
