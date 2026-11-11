import { getSupabaseBrowserClient } from './supabase/client';
import type { ApiResponse, AiStreamChunk } from '@platform/types';

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

async function buildApiHeaders(
  skipAuth: boolean,
  customHeaders?: HeadersInit
): Promise<Headers> {
  const headers = new Headers(customHeaders || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

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

  return headers;
}

function resolveApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const path =
    cleanEndpoint.startsWith('api/') || cleanEndpoint.startsWith('health')
      ? cleanEndpoint
      : `api/v1/${cleanEndpoint}`;

  return cleanEndpoint.startsWith('http')
    ? cleanEndpoint
    : `/backend-api/${path}`;
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
  const headers = await buildApiHeaders(skipAuth, customHeaders);
  const url = resolveApiUrl(endpoint);

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
        errorJson.code || 'FORBIDDEN',
        errorJson.message || 'Access Denied: You do not have permission to perform this action.'
      );
    }

    // Parse API response
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        response.status,
        json.code || 'API_ERROR',
        json.message || `Request failed with status ${response.status}`,
        json.details
      );
    }

    // Wrap in standard ApiResponse envelope if not already enveloped
    if (typeof json === 'object' && json !== null && 'success' in json && 'data' in json) {
      return {
        ...json,
        meta: {
          timestamp: new Date().toISOString(),
          ...(json.meta || {}),
        },
      };
    }

    return {
      success: true,
      data: json as T,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      500,
      'NETWORK_ERROR',
      (error as Error).message || 'Failed to communicate with Learnova backend service.'
    );
  }
}

/**
 * Consumes Server-Sent Events (`text/event-stream`) from Learnova AI streaming endpoints.
 */
export async function streamAiClient(
  endpoint: string,
  body: unknown,
  onChunk: (chunk: AiStreamChunk) => void,
  signal?: AbortSignal
): Promise<void> {
  const headers = await buildApiHeaders(false, {
    Accept: 'text/event-stream',
  });
  const url = resolveApiUrl(endpoint);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (response.status === 401) {
    throw new ApiError(
      401,
      'UNAUTHORIZED',
      'Sign in required to interact with the AI Learning Companion.'
    );
  }

  if (response.status === 403) {
    const errJson = await response.json().catch(() => ({}));
    throw new ApiError(
      403,
      errJson.code || 'FORBIDDEN',
      errJson.message || 'You do not have access to this course context.'
    );
  }

  if (!response.ok || !response.body) {
    const errJson = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status || 500,
      errJson.code || 'STREAM_ERROR',
      errJson.message || `Streaming request failed (${response.status}).`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const parsed = JSON.parse(payload) as AiStreamChunk;
        onChunk(parsed);
      } catch {
        // Ignore partial non-JSON lines
      }
    }
  }
}
