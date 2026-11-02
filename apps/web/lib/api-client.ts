import { getSupabaseBrowserClient } from './supabase/client';
import type { ApiResponse } from '@platform/types';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Standardized, secure API client for communicating with the NestJS backend.
 * Automatically injects the active Supabase JWT Bearer token into headers.
 * Catches 401 and 403 errors cleanly without infinite retry loops.
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const { skipAuth = false, headers: customHeaders, ...fetchOptions } = options;

  const headers = new Headers(customHeaders || {});
  headers.set('Content-Type', 'application/json');

  // Inject Supabase JWT access token if authenticated
  if (!skipAuth && typeof window !== 'undefined') {
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }
    } catch (err) {
      console.warn('[Learnova API Client] Failed to retrieve session for Authorization header:', err);
    }
  }

  // Format request URL through Next.js proxy rewrite or direct API host
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const url = cleanEndpoint.startsWith('http')
    ? cleanEndpoint
    : `/backend-api/${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle 401 Unauthorized (Session Expired or Missing Token)
    if (response.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
        // Redirect to login if a protected request fails authentication
        window.location.href = `/auth/login?error=session_expired&next=${encodeURIComponent(
          window.location.pathname
        )}`;
      }

      throw new ApiError(
        401,
        'UNAUTHORIZED',
        'Authentication required. Please sign in to continue.'
      );
    }

    // Handle 403 Forbidden (Insufficient Application Role / Zero-Trust block)
    if (response.status === 403) {
      const errorJson = await response.json().catch(() => ({}));
      throw new ApiError(
        403,
        'FORBIDDEN',
        errorJson.message || 'Access Denied: You do not possess the required permissions for this action.'
      );
    }

    // Parse JSON response
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        response.status,
        json?.error?.code || 'API_ERROR',
        json?.message || `Request failed with HTTP status ${response.status}`,
        json
      );
    }

    return {
      success: true,
      data: json as T,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      500,
      'NETWORK_ERROR',
      error?.message || 'A network error occurred while communicating with the Learnova API.'
    );
  }
}
