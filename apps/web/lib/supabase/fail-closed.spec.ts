import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from './middleware';
import { requireAuthUser } from './server';

describe('Frontend Production Fail-Closed Behavior', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('requireAuthUser (Origin Server Layer)', () => {
    it('throws fatal configuration error in production if NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      await expect(requireAuthUser('/dashboard')).rejects.toThrow(
        /FATAL CONFIGURATION ERROR: Supabase authentication credentials are missing or unconfigured/i
      );
    });

    it('throws fatal configuration error in production if NEXT_PUBLIC_SUPABASE_URL contains placeholder', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-anon-key';

      await expect(requireAuthUser('/dashboard')).rejects.toThrow(
        /FATAL CONFIGURATION ERROR: Supabase authentication credentials are missing or unconfigured/i
      );
    });
  });

  describe('updateSession Middleware (Edge Proxy Layer)', () => {
    it('returns 503 Service Unavailable for protected routes in production when configuration is missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const req = new NextRequest('https://learnova.internal/dashboard');
      const res = await updateSession(req);

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toBe('service_unavailable');
      expect(json.message).toMatch(/Authentication service is unconfigured or unavailable/i);
    });

    it('returns 503 for all protected ecosystem routes (/creator, /courses, /ai-assistant) when unconfigured in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const protectedPaths = ['/creator', '/courses', '/ai-assistant', '/messages', '/bookmarks'];

      for (const path of protectedPaths) {
        const req = new NextRequest(`https://learnova.internal${path}`);
        const res = await updateSession(req);
        expect(res.status).toBe(503);
      }
    });

    it('permits public routes (/, /explore, /api/health) to pass through even if Supabase is unconfigured', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const publicPaths = ['/', '/explore', '/api/health'];

      for (const path of publicPaths) {
        const req = new NextRequest(`https://learnova.internal${path}`);
        const res = await updateSession(req);
        // NextResponse.next() returns a 200 pass-through response
        expect(res.status).toBe(200);
      }
    });

    it('redirects to login with error indicator in local development when unconfigured', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const req = new NextRequest('https://learnova.internal/dashboard');
      const res = await updateSession(req);

      expect(res.status).toBe(307); // Temporary redirect
      const location = res.headers.get('location');
      expect(location).toContain('/auth/login?error=auth_unconfigured');
    });
  });
});
