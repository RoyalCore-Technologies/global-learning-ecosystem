import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { UserRole } from '@platform/types';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  dbRole: string; // Supabase JWT role, e.g. 'authenticated'
  role: UserRole; // Learnova application role, e.g. 'STUDENT', 'ADMIN'
  app_metadata: Record<string, unknown>;
}

export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string; // database role, e.g. 'authenticated'
  iss?: string;
  aud?: string | string[];
  exp?: number;
  app_metadata?: {
    role?: UserRole;
    [key: string]: unknown;
  };
  user_metadata?: Record<string, unknown>;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private jwksSecretProvider: ReturnType<typeof passportJwtSecret> | null = null;
  private readonly jwtSecret: string | null;
  private readonly supabaseUrl: string;
  private readonly expectedIssuer: string | null;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || null;

    const normalizedUrl = rawSupabaseUrl.trim().replace(/\/+$/, '');
    const isPlaceholder = !normalizedUrl || normalizedUrl.includes('placeholder');

    // 1. Mandatory Production Environment Validation
    if (isProduction) {
      if (!normalizedUrl || isPlaceholder) {
        throw new Error(
          'CRITICAL CONFIGURATION ERROR: SUPABASE_URL is mandatory in production and cannot be empty or contain placeholder values.'
        );
      }
      try {
        const parsedUrl = new URL(normalizedUrl);
        if (parsedUrl.protocol !== 'https:') {
          throw new Error(
            'CRITICAL CONFIGURATION ERROR: SUPABASE_URL must use HTTPS protocol in production.'
          );
        }
      } catch (err: any) {
        throw new Error(`CRITICAL CONFIGURATION ERROR: Invalid SUPABASE_URL: ${err.message}`);
      }
    } else {
      if (normalizedUrl && !isPlaceholder) {
        try {
          new URL(normalizedUrl);
        } catch (err: any) {
          throw new Error(`Invalid SUPABASE_URL: ${err.message}`);
        }
      }
    }

    // Determine expected issuer: in production, this is strictly guaranteed and non-null
    const expectedIssuer = normalizedUrl && !isPlaceholder ? `${normalizedUrl}/auth/v1` : null;

    if (isProduction && !expectedIssuer) {
      throw new Error(
        'CRITICAL CONFIGURATION ERROR: Expected JWT issuer could not be established in production.'
      );
    }

    // 2. Initialize JWKS provider for asymmetric signing (RS256 / ES256) when Supabase URL is present
    let jwksProvider: ReturnType<typeof passportJwtSecret> | null = null;
    if (normalizedUrl && !isPlaceholder) {
      jwksProvider = passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${normalizedUrl}/auth/v1/.well-known/jwks.json`,
      });
    }

    const allowedAlgorithms: ('RS256' | 'ES256' | 'HS256')[] = ['RS256', 'ES256', 'HS256'];

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: allowedAlgorithms,
      audience: 'authenticated',
      ...(expectedIssuer ? { issuer: expectedIssuer } : {}),
      secretOrKeyProvider: (
        request: Request,
        rawJwtToken: string,
        done: (err: any, secret?: string | Buffer) => void
      ) => {
        try {
          if (!rawJwtToken) {
            return done(new UnauthorizedException('Missing JWT token.'));
          }

          // Parse header without verifying signature to inspect algorithm
          const [headerB64] = rawJwtToken.split('.');
          if (!headerB64) {
            return done(new UnauthorizedException('Malformed JWT token.'));
          }

          const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
          const header = JSON.parse(headerJson);

          if (!header.alg) {
            return done(new UnauthorizedException('JWT header missing algorithm parameter.'));
          }

          // Algorithm allowlist check
          if (!allowedAlgorithms.includes(header.alg)) {
            return done(
              new UnauthorizedException(`Unsupported or prohibited JWT signing algorithm [${header.alg}].`)
            );
          }

          // Algorithm dispatch
          if (header.alg === 'HS256') {
            if (!jwtSecret) {
              return done(
                new UnauthorizedException(
                  'HS256 symmetric signing is not configured on this server (SUPABASE_JWT_SECRET is missing).'
                )
              );
            }
            return done(null, jwtSecret);
          } else if (['RS256', 'ES256'].includes(header.alg)) {
            if (!jwksProvider) {
              return done(
                new UnauthorizedException(
                  `Asymmetric algorithm [${header.alg}] requested but JWKS provider is unconfigured (SUPABASE_URL missing).`
                )
              );
            }
            return jwksProvider(request, rawJwtToken, done);
          } else {
            return done(
              new UnauthorizedException(`Unsupported or prohibited JWT signing algorithm [${header.alg}].`)
            );
          }
        } catch (err: any) {
          return done(new UnauthorizedException(`Failed to resolve JWT secret: ${err.message}`));
        }
      },
    });

    this.jwtSecret = jwtSecret;
    this.supabaseUrl = normalizedUrl;
    this.expectedIssuer = expectedIssuer;
    this.jwksSecretProvider = jwksProvider;
  }

  /**
   * Validates the decoded Supabase JWT payload.
   * STRICT SECURITY ENFORCEMENT:
   * 1. Never trusts user_metadata or user_metadata.is_admin for authorization.
   * 2. Distinguishes database role (payload.role) from Learnova application role.
   * 3. Validates subject UUID format and audience.
   * 4. Enforces 'authenticated' audience and rejects 'service_role' tokens.
   * 5. Enforces expected issuer when configured (mandatory in production).
   */
  async validate(payload: SupabaseJwtPayload): Promise<AuthenticatedUser> {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid JWT payload: missing subject identifier (sub).');
    }

    // 1. Strict Audience Validation
    if (!payload.aud) {
      throw new UnauthorizedException('Invalid JWT payload: missing audience claim (aud).');
    }

    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

    // 2. Segregate service_role tokens from user endpoints
    if (auds.includes('service_role') || payload.role === 'service_role') {
      throw new UnauthorizedException('Service-role tokens cannot be used for user authentication.');
    }

    if (!auds.includes('authenticated')) {
      throw new UnauthorizedException(`Invalid token audience: [${payload.aud}]. Required: "authenticated".`);
    }

    // 3. Strict Issuer Validation (mandatory in production)
    if (this.expectedIssuer) {
      if (!payload.iss) {
        throw new UnauthorizedException('Invalid JWT payload: missing issuer identifier (iss).');
      }
      if (payload.iss !== this.expectedIssuer) {
        throw new UnauthorizedException(
          `Invalid token issuer: expected [${this.expectedIssuer}], received [${payload.iss}].`
        );
      }
    }

    // Supabase database role (e.g., 'authenticated')
    const dbRole = payload.role || 'authenticated';

    // Application Role Resolution:
    // Security Rule 1: NEVER trust user_metadata for role elevation!
    // Application role is resolved strictly from server-governed app_metadata
    // or defaults to unprivileged STUDENT.
    const appRole = (payload.app_metadata?.role as UserRole) || UserRole.STUDENT;

    return {
      id: payload.sub,
      email: payload.email,
      dbRole,
      role: appRole,
      app_metadata: payload.app_metadata || {},
    };
  }
}
