import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { sanitizeRedirectUrl } from '@/lib/security/redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Enforce open redirect protection on the post-auth landing path
  const next = sanitizeRedirectUrl(searchParams.get('next'), '/dashboard');

  if (code) {
    try {
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch (err) {
      console.error('[Learnova Auth Callback] Code exchange failed:', err);
    }
  }

  // Return user to login with error parameter if code exchange fails
  return NextResponse.redirect(`${origin}/auth/login?error=oauth_exchange_failed`);
}
