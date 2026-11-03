import { describe, it, expect } from 'vitest';
import { InstructorGuard } from './instructor.guard.js';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@platform/types';

describe('InstructorGuard', () => {
  const guard = new InstructorGuard();

  function createMockContext(user?: { role: UserRole }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows EDUCATOR role to pass', () => {
    const context = createMockContext({ role: UserRole.EDUCATOR });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows CREATOR role to pass', () => {
    const context = createMockContext({ role: UserRole.CREATOR });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows RESEARCHER role to pass', () => {
    const context = createMockContext({ role: UserRole.RESEARCHER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows ADMIN role to pass', () => {
    const context = createMockContext({ role: UserRole.ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException for STUDENT role', () => {
    const context = createMockContext({ role: UserRole.STUDENT });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no user is authenticated', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
