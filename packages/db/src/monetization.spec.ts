import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Monetization Foundation Database & RLS Tests', () => {
  let db: PGlite;
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const migration001 = fs.readFileSync(path.join(migrationsDir, '001_role_security_policy.sql'), 'utf8');
  const migration002 = fs.readFileSync(path.join(migrationsDir, '002_learnova_master_schema.sql'), 'utf8');
  const migration003 = fs.readFileSync(path.join(migrationsDir, '003_storage_buckets.sql'), 'utf8');
  const migration004 = fs.readFileSync(path.join(migrationsDir, '004_social_foundation.sql'), 'utf8');
  const migration005 = fs.readFileSync(path.join(migrationsDir, '005_learning_foundation.sql'), 'utf8');
  const migration006 = fs.readFileSync(path.join(migrationsDir, '006_creator_community.sql'), 'utf8');
  const migration007 = fs.readFileSync(path.join(migrationsDir, '007_ai_learning_foundation.sql'), 'utf8');
  const migration008 = fs.readFileSync(path.join(migrationsDir, '008_adaptive_learning.sql'), 'utf8');
  const migration009 = fs.readFileSync(path.join(migrationsDir, '009_ai_safety_and_localization.sql'), 'utf8');

  const testUserId = '00000000-0000-0000-0000-000000000001';
  const otherUserId = '00000000-0000-0000-0000-000000000002';
  const creatorId = '00000000-0000-0000-0000-000000000003';
  const adminId = '00000000-0000-0000-0000-000000000099';

  beforeAll(async () => {
    db = new PGlite();

    // 1. Mock Supabase Auth & Storage Schemas
    await db.exec(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
          CREATE ROLE supabase_admin;
        END IF;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE SCHEMA IF NOT EXISTS storage;

      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
        email text,
        created_at timestamptz DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$ LANGUAGE sql STABLE;

      CREATE TABLE IF NOT EXISTS storage.buckets (
        id text PRIMARY KEY,
        name text NOT NULL,
        public boolean DEFAULT false,
        file_size_limit bigint,
        allowed_mime_types text[]
      );

      CREATE TABLE IF NOT EXISTS storage.objects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id text REFERENCES storage.buckets(id),
        name text,
        owner uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION storage.foldername(name text)
      RETURNS text[] AS $$
        SELECT string_to_array(name, '/');
      $$ LANGUAGE sql IMMUTABLE;
    `);

    // 2. Execute migrations 001 - 009
    await db.exec(migration001);
    await db.exec(migration002);
    await db.exec(migration003);
    await db.exec(migration004);
    await db.exec(migration005);
    await db.exec(migration006);
    await db.exec(migration007);
    await db.exec(migration008);
    await db.exec(migration009);

    // Grant table privileges to authenticated role
    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    `);

    // Seed test users (handle_new_user automatically creates public.profiles)
    await db.exec(`
      INSERT INTO auth.users (id, raw_user_meta_data, email)
      VALUES 
        ('${testUserId}', '{"username": "learner_one", "display_name": "Learner One"}'::jsonb, 'learner_one@example.com'),
        ('${otherUserId}', '{"username": "learner_two", "display_name": "Learner Two"}'::jsonb, 'learner_two@example.com'),
        ('${creatorId}', '{"username": "creator_one", "display_name": "Creator One", "role": "INSTRUCTOR"}'::jsonb, 'creator_one@example.com'),
        ('${adminId}', '{"username": "platform_admin", "display_name": "Admin User", "role": "ADMIN"}'::jsonb, 'platform_admin@example.com');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it('verifies subscriptions table enforces RLS and restricts access to subscription owner', async () => {
    // Insert subscription as admin/system
    const subId = '11111111-1111-1111-1111-111111111111';
    await db.query(`
      INSERT INTO public.subscriptions (id, user_id, provider, provider_customer_id, provider_subscription_id, status, tier, current_period_start, current_period_end)
      VALUES ('${subId}', '${testUserId}', 'STRIPE', 'cus_123', 'sub_123', 'ACTIVE', 'PRO_LEARNER', now(), now() + interval '30 days');
    `);

    // Authenticated as testUserId -> can see own subscription
    await db.exec('BEGIN;');
    await db.exec(`SET LOCAL ROLE authenticated;`);
    await db.exec(`SET LOCAL request.jwt.claim.sub = '${testUserId}';`);
    const ownResult = await db.query(`SELECT id, tier, status FROM public.subscriptions;`);
    expect(ownResult.rows.length).toBe(1);
    expect((ownResult.rows[0] as any).id).toBe(subId);
    await db.exec('COMMIT;');

    // Authenticated as otherUserId -> cannot see testUserId's subscription
    await db.exec('BEGIN;');
    await db.exec(`SET LOCAL ROLE authenticated;`);
    await db.exec(`SET LOCAL request.jwt.claim.sub = '${otherUserId}';`);
    const otherResult = await db.query(`SELECT id, tier, status FROM public.subscriptions;`);
    expect(otherResult.rows.length).toBe(0);
    await db.exec('COMMIT;');
  });

  it('verifies creator_payout_records enforces RLS isolating payouts to creator', async () => {
    const payoutId = '22222222-2222-2222-2222-222222222222';
    await db.query(`
      INSERT INTO public.creator_payout_records (id, creator_id, amount_cents, currency, provider_transfer_id, status)
      VALUES ('${payoutId}', '${creatorId}', 12500, 'USD', 'tr_abc', 'PAID');
    `);

    // Authenticated as creator -> can view own payout record
    await db.exec('BEGIN;');
    await db.exec(`SET LOCAL ROLE authenticated;`);
    await db.exec(`SET LOCAL request.jwt.claim.sub = '${creatorId}';`);
    const creatorResult = await db.query(`SELECT id, amount_cents, status FROM public.creator_payout_records;`);
    expect(creatorResult.rows.length).toBe(1);
    expect((creatorResult.rows[0] as any).id).toBe(payoutId);
    expect((creatorResult.rows[0] as any).amount_cents).toBe(12500);
    await db.exec('COMMIT;');

    // Authenticated as learner -> cannot view creator's payout record
    await db.exec('BEGIN;');
    await db.exec(`SET LOCAL ROLE authenticated;`);
    await db.exec(`SET LOCAL request.jwt.claim.sub = '${testUserId}';`);
    const learnerResult = await db.query(`SELECT id, amount_cents, status FROM public.creator_payout_records;`);
    expect(learnerResult.rows.length).toBe(0);
    await db.exec('COMMIT;');
  });
});
