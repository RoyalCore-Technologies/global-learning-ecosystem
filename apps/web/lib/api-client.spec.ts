import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiError } from './api-client.js';

describe('Learnova API Client (Authenticated Transport)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('instantiates ApiError with status, code, and message', () => {
    const error = new ApiError(401, 'UNAUTHORIZED', 'Session expired');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Session expired');
    expect(error.name).toBe('ApiError');
  });

  it('correctly handles successful 200 API responses', async () => {
    const mockData = { id: 'usr-1', email: 'learner@learnova.edu', role: 'STUDENT' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const response = await apiClient<typeof mockData>('api/v1/auth/me', { skipAuth: true });
    expect(response.success).toBe(true);
    expect(response.data).toEqual(mockData);
    expect(response.meta?.timestamp).toBeDefined();
  });

  it('throws ApiError with 401 on unauthenticated responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Token missing' }),
    });

    await expect(apiClient('api/v1/protected', { skipAuth: true })).rejects.toThrow(ApiError);
    await expect(apiClient('api/v1/protected', { skipAuth: true })).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('throws ApiError with 403 when accessing unauthorized resources', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Access Denied: Insufficient permissions' }),
    });

    await expect(apiClient('api/v1/admin/manage', { skipAuth: true })).rejects.toThrow(ApiError);
    await expect(apiClient('api/v1/admin/manage', { skipAuth: true })).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });
});
