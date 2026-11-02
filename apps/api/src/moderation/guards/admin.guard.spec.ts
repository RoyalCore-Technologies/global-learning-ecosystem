import { describe, it, expect } from 'vitest';
import { AdminGuard } from './admin.guard.js';
import { UserRole } from '@platform/types';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  function createMockContext(user?: { role: UserRole }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access when user has ADMIN role', () => {
    const ctx = createMockContext({ role: UserRole.ADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user has STUDENT role', () => {
    const ctx = createMockContext({ role: UserRole.STUDENT });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has EDUCATOR role', () => {
    const ctx = createMockContext({ role: UserRole.EDUCATOR });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no user is present', () => {
    const ctx = createMockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
