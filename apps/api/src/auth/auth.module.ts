import { Module } from '@nestjs/common';
import { RoleSecurityService } from './role-security.service.js';
import { RoleAssignmentSecurityGuard } from './role-assignment.guard.js';

@Module({
  providers: [RoleSecurityService, RoleAssignmentSecurityGuard],
  exports: [RoleSecurityService, RoleAssignmentSecurityGuard]
})
export class AuthModule {}
