import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Updates the user's session by refreshing expired tokens using cookies,
 * and enforces strict route protection boundaries with path-segment matching.
 *
 * FAIL-CLOSED ENFORCEMENT:
 * - Unconfigured production environments return 503 Service Unavailable for protected routes.
 * - Public routes remain accessible without disruption.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  const { pathname, search } = request.nextUrl;

  // 1. Protected application routes requiring an active authenticated session
  const protectedRoutes = [
    '/dashboard',
    '/creator',
    '/ai-assistant',
    '/courses',
    '/messages',
    '/notifications',
    '/bookmarks',
  ];
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Fail-Closed: If Supabase configuration is missing or invalid, NEVER allow protected routes through
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes('placeholder') ||
    supabaseAnonKey.includes('placeholder')
  ) {
    if (isProtectedRoute) {
      if (isProduction) {
        // Return 503 Service Unavailable with JSON payload to fail closed and avoid redirect loops
        return new NextResponse(
          JSON.stringify({
            error: 'service_unavailable',
            message: 'Authentication service is unconfigured or unavailable in this environment.',
          }),
          {
            status: 503,
            headers: {
              'content-type': 'application/json',
              'retry-after': '60',
            },
          }
        );
      } else {
        // In local development without credentials, redirect to login with error indicator
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        url.search = `?error=auth_unconfigured&next=${encodeURIComponent(pathname + search)}`;
        return NextResponse.redirect(url);
      }
    }

    // Public routes (e.g. /, /explore, /api/health) pass through gracefully
    return response;
  }

  // 2. Active Session Refresh & Authentication Verification
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do NOT use supabase.auth.getSession() in middleware as it reads from
  // local cookies without validating with the Supabase Auth server.
  // getUser() sends a request to the Auth server to validate the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Auth routes: authenticated users visiting login/register should be redirected to dashboard
  const authRoutes = ['/auth/login', '/auth/register'];
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
