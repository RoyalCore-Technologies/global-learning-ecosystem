import { describe, it, expect } from 'vitest';
import {
  UserRole,
  DEFAULT_ASSIGNABLE_ROLES,
  PRIVILEGED_ROLES,
  isPrivilegedRole,
  canUserSelfAssignRole
} from './roles.js';

describe('Role Security & Hierarchy (Condition 7)', () => {
  it('allows self-assignment only for unprivileged default roles', () => {
    expect(canUserSelfAssignRole(UserRole.STUDENT)).toBe(true);
    expect(canUserSelfAssignRole(UserRole.BEGINNER)).toBe(true);
  });

  it('strictly rejects self-assignment of privileged roles', () => {
    expect(canUserSelfAssignRole(UserRole.EDUCATOR)).toBe(false);
    expect(canUserSelfAssignRole(UserRole.CREATOR)).toBe(false);
    expect(canUserSelfAssignRole(UserRole.RESEARCHER)).toBe(false);
    expect(canUserSelfAssignRole(UserRole.ADMIN)).toBe(false);
  });

  it('correctly identifies privileged roles', () => {
    expect(isPrivilegedRole(UserRole.ADMIN)).toBe(true);
    expect(isPrivilegedRole(UserRole.EDUCATOR)).toBe(true);
    expect(isPrivilegedRole(UserRole.RESEARCHER)).toBe(true);
    expect(isPrivilegedRole(UserRole.CREATOR)).toBe(true);
    expect(isPrivilegedRole(UserRole.STUDENT)).toBe(false);
    expect(isPrivilegedRole(UserRole.BEGINNER)).toBe(false);
  });
});
