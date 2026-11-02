import { Injectable, ForbiddenException } from '@nestjs/common';
import { UserRole, isPrivilegedRole, canUserSelfAssignRole } from '@platform/types';

@Injectable()
export class RoleSecurityService {
  /**
   * Enforces server-side zero-trust role assignment validation.
   * Prevents client-side self-assignment of privileged roles.
   *
   * @param targetRole The role requested in the payload
   * @param isServiceOrAdmin Whether the actor has verified administrative / service-role credentials
   * @throws ForbiddenException if unprivileged user attempts to assign a privileged role
   */
  assertCanAssignRole(targetRole: UserRole | string, isServiceOrAdmin = false): void {
    if (isServiceOrAdmin) {
      return; // Administrative escalation allowed via verified admin / service-role routines
    }

    if (isPrivilegedRole(targetRole)) {
      throw new ForbiddenException(
        `Privileged role [${targetRole}] cannot be self-assigned. Formal verification, institutional vetting, or administrative promotion is required.`
      );
    }

    if (!canUserSelfAssignRole(targetRole)) {
      throw new ForbiddenException(`Invalid or unauthorized role assignment: [${targetRole}].`);
    }
  }

  /**
   * Validates a profile mutation payload to ensure that role modifications
   * cannot be smuggled through generic profile update endpoints.
   */
  sanitizeProfileMutation<T extends { role?: UserRole | string }>(
    payload: T,
    isServiceOrAdmin = false
  ): T {
    if (payload.role !== undefined) {
      this.assertCanAssignRole(payload.role, isServiceOrAdmin);
    }
    return payload;
  }
}
