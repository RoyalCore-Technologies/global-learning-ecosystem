import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase client for Server Components, Server Actions,
 * and Route Handlers with secure cookie persistence.
 *
 * FAIL-CLOSED: In production, missing credentials immediately throw to prevent
 * unauthorized or malformed requests from proceeding.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      supabaseUrl.includes('placeholder') ||
      supabaseAnonKey.includes('placeholder')
    ) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are strictly required in production.'
      );
    }
  }

  return createServerClient(
    supabaseUrl || 'https://placeholder-project.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Defense-in-depth server-side session validator for Server Components & Layouts.
 * Ensures protected server routes cannot be accessed without an active Supabase user session,
 * independent of whether middleware was applied.
 *
 * FAIL-CLOSED GUARANTEES:
 * 1. Never returns null to permit unauthenticated rendering of protected content.
 * 2. In production runtime, missing or placeholder configuration throws a fatal error immediately.
 * 3. In non-production unconfigured environments, safely redirects to login with error details.
 * 4. Missing or invalid user session redirects immediately to /auth/login.
 *
 * @param returnPath Safe relative path to redirect back to post-login
 * @returns Authenticated Supabase User object
 */
export async function requireAuthUser(returnPath = '/dashboard'): Promise<User> {
  const isProduction = process.env.NODE_ENV === 'production';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder')
  );

  // Production Fail-Closed: Never allow protected routes to run unconfigured
  if (!isConfigured) {
    if (isProduction) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: Supabase authentication credentials are missing or unconfigured in production runtime. Access to protected route is denied.'
      );
    }
    redirect(`/auth/login?error=auth_unconfigured&next=${encodeURIComponent(returnPath)}`);
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/auth/login?next=${encodeURIComponent(returnPath)}`);
  }

  return user;
}
