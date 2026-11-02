import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;
  private readonly supabaseServiceRoleKey?: string;

  private defaultAnonClient: SupabaseClient | null = null;
  private adminClient: SupabaseClient | null = null;

  constructor() {
    this.supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://placeholder.supabase.co';
    this.supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'placeholder-anon-key';
    this.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  /**
   * Returns a Supabase client.
   * If an access token is provided, the client executes under the authenticated user's JWT context,
   * enforcing Row Level Security (RLS) rules in PostgreSQL.
   */
  getClient(accessToken?: string): SupabaseClient {
    if (!accessToken) {
      if (!this.defaultAnonClient) {
        this.defaultAnonClient = createClient(this.supabaseUrl, this.supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
      }
      return this.defaultAnonClient;
    }

    return createClient(this.supabaseUrl, this.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  /**
   * Returns an administrative Supabase client using the service-role key.
   * STRICTLY RESTRICTED to internal system tasks and trusted server-side orchestration.
   */
  getAdminClient(): SupabaseClient {
    if (this.adminClient) {
      return this.adminClient;
    }

    const key = this.supabaseServiceRoleKey || this.supabaseAnonKey;
    this.adminClient = createClient(this.supabaseUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    return this.adminClient;
  }
}
