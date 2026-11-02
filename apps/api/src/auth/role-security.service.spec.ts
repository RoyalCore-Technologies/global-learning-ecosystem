import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@platform/types';
import { RoleSecurityService } from './role-security.service.js';
import { RoleAssignmentSecurityGuard } from './role-assignment.guard.js';

describe('RoleSecurityService (Server-Side Role Enforcement)', () => {
  let service: RoleSecurityService;

  beforeEach(() => {
    service = new RoleSecurityService();
  });

  it('allows self-assignment of default roles (STUDENT, BEGINNER)', () => {
    expect(() => service.assertCanAssignRole(UserRole.STUDENT)).not.toThrow();
    expect(() => service.assertCanAssignRole(UserRole.BEGINNER)).not.toThrow();
  });

  it('throws ForbiddenException when an unprivileged client attempts self-assigning ADMIN', () => {
    expect(() => service.assertCanAssignRole(UserRole.ADMIN)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when an unprivileged client attempts self-assigning EDUCATOR', () => {
    expect(() => service.assertCanAssignRole(UserRole.EDUCATOR)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when an unprivileged client attempts self-assigning RESEARCHER or CREATOR', () => {
    expect(() => service.assertCanAssignRole(UserRole.RESEARCHER)).toThrow(ForbiddenException);
    expect(() => service.assertCanAssignRole(UserRole.CREATOR)).toThrow(ForbiddenException);
  });

  it('allows privileged role assignment when executed with admin/service-role authority', () => {
    expect(() => service.assertCanAssignRole(UserRole.ADMIN, true)).not.toThrow();
    expect(() => service.assertCanAssignRole(UserRole.EDUCATOR, true)).not.toThrow();
    expect(() => service.assertCanAssignRole(UserRole.RESEARCHER, true)).not.toThrow();
  });

  it('sanitizes profile mutations and rejects privileged role smuggling', () => {
    expect(() =>
      service.sanitizeProfileMutation({
        displayName: 'John Doe',
        role: UserRole.ADMIN
      })
    ).toThrow(ForbiddenException);

    const validPayload = service.sanitizeProfileMutation({
      displayName: 'Jane Doe',
      role: UserRole.STUDENT
    });
    expect(validPayload.role).toBe(UserRole.STUDENT);
  });
});

describe('RoleAssignmentSecurityGuard', () => {
  let guard: RoleAssignmentSecurityGuard;
  let service: RoleSecurityService;

  beforeEach(() => {
    service = new RoleSecurityService();
    guard = new RoleAssignmentSecurityGuard(service);
  });

  function createMockContext(body: unknown, user?: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          body,
          user
        })
      })
    } as unknown as ExecutionContext;
  }

  it('passes requests without role modification', () => {
    const context = createMockContext({ bio: 'Hello world' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('passes unprivileged role requests from normal users', () => {
    const context = createMockContext({ role: UserRole.STUDENT });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks unauthenticated/unprivileged attempts to set privileged roles', () => {
    const context = createMockContext({ role: UserRole.ADMIN });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows role changes when request has verified admin credentials', () => {
    const context = createMockContext(
      { role: UserRole.EDUCATOR },
      { role: 'ADMIN' }
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('strictly blocks role changes when request attempts to forge admin authority via user_metadata', () => {
    // Malicious user payload trying to exploit user_metadata.is_admin
    const maliciousContext = createMockContext(
      { role: UserRole.ADMIN },
      {
        role: 'STUDENT',
        user_metadata: { is_admin: true, role: 'ADMIN' }
      }
    );
    expect(() => guard.canActivate(maliciousContext)).toThrow(ForbiddenException);
  });
});
