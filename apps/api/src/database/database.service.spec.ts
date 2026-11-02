import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    service = new DatabaseService();
  });

  it('creates an anonymous Supabase client when no access token is passed', () => {
    const client = service.getClient();
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
  });

  it('reuses the default anonymous client instance across multiple calls', () => {
    const client1 = service.getClient();
    const client2 = service.getClient();
    expect(client1).toBe(client2);
  });

  it('creates an authenticated user-scoped client with Authorization header when accessToken is passed', () => {
    const token = 'mock-user-jwt-token-xyz';
    const client = service.getClient(token);
    expect(client).toBeDefined();
    // Scoped client is distinct from default client
    expect(client).not.toBe(service.getClient());
  });

  it('creates an administrative service-role client', () => {
    const adminClient = service.getAdminClient();
    expect(adminClient).toBeDefined();
    expect(adminClient.from).toBeDefined();
  });
});
