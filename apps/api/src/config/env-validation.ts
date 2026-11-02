/**
 * Validates critical infrastructure configuration on production application startup.
 * Prevents unconfigured or insecure containers from serving requests.
 */
export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV === 'production') {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: SUPABASE_URL must be configured in production.'
      );
    }
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('FATAL CONFIGURATION ERROR: SUPABASE_URL must use HTTPS protocol in production.');
      }
    } catch (err: any) {
      throw new Error(`FATAL CONFIGURATION ERROR: Invalid SUPABASE_URL format: ${err.message}`);
    }
  }
}
