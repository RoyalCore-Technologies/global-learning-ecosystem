import { describe, it, expect } from 'vitest';
import { GET } from './route.js';

describe('Web Health Route (/api/health)', () => {
  it('returns ok status and service health payload', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('platform-web');
    expect(body.version).toBe('0.1.0');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
  });
});
