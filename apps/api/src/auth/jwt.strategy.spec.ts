import { describe, it, expect, beforeEach } from 'vitest';
import { JwtStrategy, type SupabaseJwtPayload } from './jwt.strategy.js';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@platform/types';

describe('JwtStrategy (Supabase Authentication & Signature Verification)', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = 'super-secret-test-key-32-characters-minimum';
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    strategy = new JwtStrategy();
  });

  it('successfully validates a legitimate authenticated student JWT payload', async () => {
    const payload: SupabaseJwtPayload = {
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'student@learnova.edu',
      role: 'authenticated', // Supabase DB role
      aud: 'authenticated',
      app_metadata: {
        role: UserRole.STUDENT,
      },
      user_metadata: {
        display_name: 'Student Learner',
      },
    };

    const user = await strategy.validate(payload);
    expect(user).toBeDefined();
    expect(user.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(user.email).toBe('student@learnova.edu');
    expect(user.dbRole).toBe('authenticated');
    expect(user.role).toBe(UserRole.STUDENT);
  });

  it('rejects a JWT payload missing the subject identifier (sub)', async () => {
    const invalidPayload = {
      email: 'no-sub@learnova.edu',
      role: 'authenticated',
    } as SupabaseJwtPayload;

    await expect(strategy.validate(invalidPayload)).rejects.toThrow(UnauthorizedException);
    await expect(strategy.validate(invalidPayload)).rejects.toThrow('missing subject identifier (sub)');
  });

  it('rejects a JWT with an invalid audience', async () => {
    const badAudPayload: SupabaseJwtPayload = {
      sub: '22222222-2222-2222-2222-222222222222',
      email: 'bad-aud@learnova.edu',
      aud: 'unauthorized_audience',
      role: 'authenticated',
    };

    await expect(strategy.validate(badAudPayload)).rejects.toThrow(UnauthorizedException);
    await expect(strategy.validate(badAudPayload)).rejects.toThrow('Invalid token audience');
  });

  it('MANDATORY SECURITY RULE 1: rejects forged user_metadata attempting admin role escalation', async () => {
    // Malicious attacker registers and injects admin flags into user_metadata
    const forgedPayload: SupabaseJwtPayload = {
      sub: '33333333-3333-3333-3333-333333333333',
      email: 'attacker@learnova.test',
      role: 'authenticated',
      aud: 'authenticated',
      app_metadata: {}, // Empty: backend has not granted elevated status
      user_metadata: {
        is_admin: true,
        role: 'ADMIN',
        permissions: ['ALL'],
      },
    };

    const user = await strategy.validate(forgedPayload);

    // MUST NOT elevate to ADMIN!
    expect(user.role).toBe(UserRole.STUDENT);
    expect(user.role).not.toBe(UserRole.ADMIN);
  });

  it('resolves elevated role strictly when present in server-governed app_metadata', async () => {
    const verifiedAdminPayload: SupabaseJwtPayload = {
      sub: '44444444-4444-4444-4444-444444444444',
      email: 'admin@learnova.internal',
      role: 'authenticated',
      aud: 'authenticated',
      app_metadata: {
        role: UserRole.ADMIN,
      },
    };

    const user = await strategy.validate(verifiedAdminPayload);
    expect(user.role).toBe(UserRole.ADMIN);
  });
});
