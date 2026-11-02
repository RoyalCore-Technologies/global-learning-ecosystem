export enum UserRole {
  STUDENT = 'STUDENT',
  BEGINNER = 'BEGINNER',
  EDUCATOR = 'EDUCATOR',
  CREATOR = 'CREATOR',
  RESEARCHER = 'RESEARCHER',
  ADMIN = 'ADMIN'
}

/**
 * Roles that users may select during public sign-up or profile setup.
 * All newly registered users default to unprivileged learning roles.
 */
export const DEFAULT_ASSIGNABLE_ROLES: readonly UserRole[] = [
  UserRole.STUDENT,
  UserRole.BEGINNER
] as const;

/**
 * Privileged roles requiring formal verification, credential review, or administrator grant.
 * Condition 7: Strictly forbidden from user self-assignment.
 */
export const PRIVILEGED_ROLES: readonly UserRole[] = [
  UserRole.EDUCATOR,
  UserRole.CREATOR,
  UserRole.RESEARCHER,
  UserRole.ADMIN
] as const;

/**
 * Checks whether a given role is privileged.
 */
export function isPrivilegedRole(role: UserRole | string): boolean {
  return (PRIVILEGED_ROLES as readonly string[]).includes(role);
}

/**
 * Validates whether a user can self-assign a role.
 * Enforces zero-trust role onboarding.
 */
export function canUserSelfAssignRole(targetRole: UserRole | string): boolean {
  return (DEFAULT_ASSIGNABLE_ROLES as readonly string[]).includes(targetRole);
}
