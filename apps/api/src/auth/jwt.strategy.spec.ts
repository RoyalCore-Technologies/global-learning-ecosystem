import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JwtStrategy, type SupabaseJwtPayload } from './jwt.strategy.js';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@platform/types';
import jwt from 'jsonwebtoken';
import { validateProductionEnvironment } from '../config/env-validation.js';

const TEST_SECRET = 'super-secret-test-key-32-characters-minimum';
const TEST_SUPABASE_URL = 'https://test-project.supabase.co';
const EXPECTED_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;

// Test helper: Invokes Passport's internal authenticate() method on mock Express request
function authenticateJwt(strategy: JwtStrategy, authHeader?: string): Promise<{
  status: 'success' | 'fail' | 'error';
  user?: any;
  challenge?: any;
  error?: any;
}> {
  return new Promise((resolve) => {
    const req: any = {
      headers: authHeader ? { authorization: authHeader } : {},
    };

    const passportInstance = strategy as any;
    passportInstance.success = (user: any) => resolve({ status: 'success', user });
    passportInstance.fail = (challenge: any) => resolve({ status: 'fail', challenge });
    passportInstance.error = (error: any) => resolve({ status: 'error', error });

    passportInstance.authenticate(req);
  });
}

describe('JwtStrategy (Supabase Authentication & Cryptographic Verification)', () => {
  let strategy: JwtStrategy;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
    process.env.SUPABASE_URL = TEST_SUPABASE_URL;
    strategy = new JwtStrategy();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Direct Payload Validation (validate method)', () => {
    it('successfully validates a legitimate authenticated student JWT payload', async () => {
      const payload: SupabaseJwtPayload = {
        sub: '11111111-1111-1111-1111-111111111111',
        email: 'student@learnova.edu',
        role: 'authenticated', // Supabase DB role
        aud: 'authenticated',
        iss: EXPECTED_ISSUER,
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
        aud: 'authenticated',
        iss: EXPECTED_ISSUER,
      } as SupabaseJwtPayload;

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(invalidPayload)).rejects.toThrow('missing subject identifier (sub)');
    });

    it('rejects a JWT payload missing the audience claim (aud)', async () => {
      const noAudPayload: SupabaseJwtPayload = {
        sub: '22222222-2222-2222-2222-222222222222',
        email: 'no-aud@learnova.edu',
        role: 'authenticated',
        iss: EXPECTED_ISSUER,
      };

      await expect(strategy.validate(noAudPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(noAudPayload)).rejects.toThrow('missing audience claim');
    });

    it('rejects a JWT with an invalid audience', async () => {
      const badAudPayload: SupabaseJwtPayload = {
        sub: '22222222-2222-2222-2222-222222222222',
        email: 'bad-aud@learnova.edu',
        aud: 'unauthorized_audience',
        role: 'authenticated',
        iss: EXPECTED_ISSUER,
      };

      await expect(strategy.validate(badAudPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(badAudPayload)).rejects.toThrow('Invalid token audience');
    });

    it('rejects service_role tokens passed to the user guard', async () => {
      const serviceRolePayload: SupabaseJwtPayload = {
        sub: '00000000-0000-0000-0000-000000000000',
        email: 'service@internal.supabase',
        role: 'service_role',
        aud: 'service_role',
        iss: EXPECTED_ISSUER,
      };

      await expect(strategy.validate(serviceRolePayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(serviceRolePayload)).rejects.toThrow(
        'Service-role tokens cannot be used for user authentication.'
      );
    });

    it('rejects a JWT payload missing the issuer claim (iss) when issuer is configured', async () => {
      const noIssuerPayload: SupabaseJwtPayload = {
        sub: '55555555-5555-5555-5555-555555555555',
        email: 'no-issuer@learnova.edu',
        role: 'authenticated',
        aud: 'authenticated',
      };

      await expect(strategy.validate(noIssuerPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(noIssuerPayload)).rejects.toThrow('missing issuer identifier (iss)');
    });

    it('rejects a token with a mismatched issuer when issuer is configured', async () => {
      const badIssuerPayload: SupabaseJwtPayload = {
        sub: '55555555-5555-5555-5555-555555555555',
        email: 'mismatch-issuer@learnova.edu',
        role: 'authenticated',
        aud: 'authenticated',
        iss: 'https://evil-spoofed-auth.com/auth/v1',
      };

      await expect(strategy.validate(badIssuerPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(badIssuerPayload)).rejects.toThrow('Invalid token issuer');
    });

    it('MANDATORY SECURITY RULE 1: rejects forged user_metadata attempting admin role escalation', async () => {
      const forgedPayload: SupabaseJwtPayload = {
        sub: '33333333-3333-3333-3333-333333333333',
        email: 'attacker@learnova.test',
        role: 'authenticated',
        aud: 'authenticated',
        iss: EXPECTED_ISSUER,
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
        iss: EXPECTED_ISSUER,
        app_metadata: {
          role: UserRole.ADMIN,
        },
      };

      const user = await strategy.validate(verifiedAdminPayload);
      expect(user.role).toBe(UserRole.ADMIN);
    });
  });

  describe('Production Environment Validation & Mandatory Issuer', () => {
    it('throws fatal error on initialization in production if SUPABASE_URL is missing', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      expect(() => new JwtStrategy()).toThrow(
        /SUPABASE_URL is mandatory in production and cannot be empty/i
      );
    });

    it('throws fatal error in production if SUPABASE_URL is a placeholder', () => {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://placeholder-project.supabase.co';

      expect(() => new JwtStrategy()).toThrow(
        /SUPABASE_URL is mandatory in production and cannot be empty or contain placeholder values/i
      );
    });

    it('throws fatal error in production if SUPABASE_URL uses insecure HTTP protocol', () => {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'http://test-project.supabase.co';

      expect(() => new JwtStrategy()).toThrow(
        /SUPABASE_URL must use HTTPS protocol in production/i
      );
    });

    it('throws fatal error in production if SUPABASE_URL is malformed', () => {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'not-a-valid-url';

      expect(() => new JwtStrategy()).toThrow(/Invalid SUPABASE_URL/i);
    });

    it('validateProductionEnvironment() fails fast if SUPABASE_URL is missing or placeholder in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      expect(() => validateProductionEnvironment()).toThrow(
        /FATAL CONFIGURATION ERROR: SUPABASE_URL must be configured in production/i
      );
    });

    it('validateProductionEnvironment() passes when valid HTTPS SUPABASE_URL is configured', () => {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://real-project.supabase.co';

      expect(() => validateProductionEnvironment()).not.toThrow();
    });
  });

  describe('Cryptographic Signature Verification Pipeline (Passport integration)', () => {
    it('successfully verifies and authenticates a valid HS256 signed JWT token', async () => {
      const validPayload = {
        sub: '12345678-1234-1234-1234-1234567890ab',
        email: 'verified.user@learnova.edu',
        aud: 'authenticated',
        iss: EXPECTED_ISSUER,
        role: 'authenticated',
        app_metadata: { role: UserRole.STUDENT },
      };

      const token = jwt.sign(validPayload, TEST_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });

      const result = await authenticateJwt(strategy, `Bearer ${token}`);
      expect(result.status).toBe('success');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(validPayload.sub);
      expect(result.user.email).toBe(validPayload.email);
      expect(result.user.role).toBe(UserRole.STUDENT);
    });

    it('rejects a JWT token signed with an invalid/forged signature', async () => {
      const tamperedPayload = {
        sub: '12345678-1234-1234-1234-1234567890ab',
        email: 'victim@learnova.edu',
        aud: 'authenticated',
        iss: EXPECTED_ISSUER,
      };

      // Signed with a different key
      const forgedToken = jwt.sign(tamperedPayload, 'wrong-attacker-private-key-32chars', {
        algorithm: 'HS256',
        expiresIn: '1h',
      });

      const result = await authenticateJwt(strategy, `Bearer ${forgedToken}`);
      expect(result.status).not.toBe('success');
      const msg = result.error?.message || result.challenge?.message || String(result.challenge || '');
      expect(msg).toMatch(/invalid signature/i);
    });

    it('rejects an expired JWT token', async () => {
      const expiredPayload = {
        sub: '12345678-1234-1234-1234-1234567890ab',
        email: 'expired@learnova.edu',
        aud: 'authenticated',
        iss: EXPECTED_ISSUER,
      };

      // Signed with expiration in the past
      const expiredToken = jwt.sign(expiredPayload, TEST_SECRET, {
        algorithm: 'HS256',
        expiresIn: -60, // 60 seconds ago
      });

      const result = await authenticateJwt(strategy, `Bearer ${expiredToken}`);
      expect(result.status).not.toBe('success');
      const msg = result.error?.message || result.challenge?.message || String(result.challenge || '');
      expect(msg).toMatch(/jwt expired/i);
    });

    it('rejects a JWT token with a mismatched issuer in the cryptographic claims', async () => {
      const badIssuerPayload = {
        sub: '12345678-1234-1234-1234-1234567890ab',
        email: 'imposter@untrusted.org',
        aud: 'authenticated',
        iss: 'https://untrusted-supabase.co/auth/v1',
      };

      const badIssuerToken = jwt.sign(badIssuerPayload, TEST_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });

      const result = await authenticateJwt(strategy, `Bearer ${badIssuerToken}`);
      expect(result.status).not.toBe('success');
      const msg = result.error?.message || result.challenge?.message || String(result.challenge || '');
      expect(msg).toMatch(/jwt issuer invalid/i);
    });

    it('rejects a JWT token with an invalid audience', async () => {
      const badAudPayload = {
        sub: '12345678-1234-1234-1234-1234567890ab',
        email: 'badaud@learnova.edu',
        aud: 'wrong-audience',
        iss: EXPECTED_ISSUER,
      };

      const badAudToken = jwt.sign(badAudPayload, TEST_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });

      const result = await authenticateJwt(strategy, `Bearer ${badAudToken}`);
      expect(result.status).not.toBe('success');
      const msg = result.error?.message || result.challenge?.message || String(result.challenge || '');
      expect(msg).toMatch(/jwt audience invalid/i);
    });

    it('rejects a service_role token presented to the user authentication guard', async () => {
      const serviceRolePayload = {
        sub: '00000000-0000-0000-0000-000000000000',
        email: 'service-role@supabase.co',
        aud: 'service_role',
        iss: EXPECTED_ISSUER,
        role: 'service_role',
      };

      const serviceToken = jwt.sign(serviceRolePayload, TEST_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });

      const result = await authenticateJwt(strategy, `Bearer ${serviceToken}`);
      expect(result.status).not.toBe('success');
    });

    it('rejects tokens using unapproved or prohibited algorithms (e.g. none, HS384)', async () => {
      const unsignedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: '12345678-1234-1234-1234-1234567890ab',
          aud: 'authenticated',
          iss: EXPECTED_ISSUER,
        })
      ).toString('base64url');

      const noneAlgToken = `${unsignedHeader}.${payload}.`;

      const result = await authenticateJwt(strategy, `Bearer ${noneAlgToken}`);
      expect(result.status).not.toBe('success');
      const msg = result.error?.message || result.challenge?.message || String(result.challenge || '');
      expect(msg).toMatch(/Unsupported or prohibited JWT signing algorithm/i);
    });

    it('fails securely when HS256 is requested but SUPABASE_JWT_SECRET is unset (no hardcoded fallback)', async () => {
      delete process.env.SUPABASE_JWT_SECRET;
      // Re-instantiate strategy without secret
      const secureStrategy = new JwtStrategy();

      const testPayload = {
        sub: '12345678-1234-1234-1234-1234567890ab',
        aud: 'authenticated',
        iss: EXPECTED_ISSUER,
      };

      const token = jwt.sign(testPayload, 'temporary-signing-key-32-chars-long', {
        algorithm: 'HS256',
        expiresIn: '1h',
      });

      const result = await authenticateJwt(secureStrategy, `Bearer ${token}`);
      expect(result.status).not.toBe('success');
      const msg = result.error?.message || result.challenge?.message || String(result.challenge || '');
      expect(msg).toMatch(/HS256 symmetric signing is not configured/i);
    });
  });
});
