import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase client for Server Components, Server Actions,
 * and Route Handlers with secure cookie persistence.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
 * @param returnPath Safe relative path to redirect back to post-login
 * @returns Authenticated Supabase User object, or null in placeholder environments
 */
export async function requireAuthUser(returnPath = '/dashboard'): Promise<User | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase environment is unconfigured (e.g. static build or mock dev),
  // avoid blocking compilation or throwing false redirect during SSG
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return null;
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
