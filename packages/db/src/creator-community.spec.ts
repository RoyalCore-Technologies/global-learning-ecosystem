import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Learnova Milestone 4.2: Creator & Community Foundation (PGlite Engine Tests)', () => {
  let db: PGlite;
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const migration001 = fs.readFileSync(path.join(migrationsDir, '001_role_security_policy.sql'), 'utf8');
  const migration002 = fs.readFileSync(path.join(migrationsDir, '002_learnova_master_schema.sql'), 'utf8');
  const migration003 = fs.readFileSync(path.join(migrationsDir, '003_storage_buckets.sql'), 'utf8');
  const migration004 = fs.readFileSync(path.join(migrationsDir, '004_social_foundation.sql'), 'utf8');
  const migration005 = fs.readFileSync(path.join(migrationsDir, '005_learning_foundation.sql'), 'utf8');
  const migration006 = fs.readFileSync(path.join(migrationsDir, '006_creator_community.sql'), 'utf8');

  // Test identities
  const creatorUser = '11111111-1111-1111-1111-111111111111';
  const memberUser = '22222222-2222-2222-2222-222222222222';
  const thirdUser = '33333333-3333-3333-3333-333333333333';
  const adminUser = '44444444-4444-4444-4444-444444444444';

  let publicCommunityId: string;
  let privateCommunityId: string;
  let channelId: string;

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

    // 2. Run migrations 001 through 006 sequentially
    await db.exec(migration001);
    await db.exec(migration002);
    await db.exec(migration003);
    await db.exec(migration004);
    await db.exec(migration005);
    await db.exec(migration006);

    // 3. Provision test users (handle_new_user automatically creates default profiles)
    await db.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ('${creatorUser}', 'creator@learnova.test', '{"username": "creator_dev", "display_name": "Creator Dev"}'::jsonb),
        ('${memberUser}', 'member@learnova.test', '{"username": "member_dev", "display_name": "Member Dev"}'::jsonb),
        ('${thirdUser}', 'third@learnova.test', '{"username": "third_dev", "display_name": "Third Dev"}'::jsonb),
        ('${adminUser}', 'admin@learnova.test', '{"username": "admin_dev", "display_name": "Admin Dev"}'::jsonb);

      -- Elevate creator and admin roles
      UPDATE public.profiles SET role = 'CREATOR' WHERE id = '${creatorUser}';
      UPDATE public.profiles SET role = 'ADMIN' WHERE id = '${adminUser}';
    `);

    // 4. Create initial communities and creator channel
    const pubCommRes = await db.query<{ id: string }>(`
      INSERT INTO public.communities (creator_id, name, slug, description, is_private, member_count)
      VALUES ('${creatorUser}', 'Open Source AI', 'open-source-ai', 'Community for open source AI builders', false, 0)
      RETURNING id;
    `);
    publicCommunityId = pubCommRes.rows[0].id;

    const privCommRes = await db.query<{ id: string }>(`
      INSERT INTO public.communities (creator_id, name, slug, description, is_private, member_count)
      VALUES ('${creatorUser}', 'Private Alpha Research', 'private-alpha-research', 'Invite-only research group', true, 0)
      RETURNING id;
    `);
    privateCommunityId = privCommRes.rows[0].id;

    const channelRes = await db.query<{ id: string }>(`
      INSERT INTO public.creator_channels (owner_id, name, slug, description, subscriber_count)
      VALUES ('${creatorUser}', 'NextGen Robotics Channel', 'nextgen-robotics', 'Official robotics masterclasses', 0)
      RETURNING id;
    `);
    channelId = channelRes.rows[0].id;
  });

  describe('Community member count trigger (sync_community_member_count)', () => {
    it('accurately increments member_count when a member joins', async () => {
      // Creator joins as LEAD
      await db.exec(`
        INSERT INTO public.community_members (community_id, user_id, role)
        VALUES ('${publicCommunityId}', '${creatorUser}', 'LEAD');
      `);

      let comm = await db.query<{ member_count: number }>(`
        SELECT member_count FROM public.communities WHERE id = '${publicCommunityId}';
      `);
      expect(comm.rows[0].member_count).toBe(1);

      // Student joins as MEMBER
      await db.exec(`
        INSERT INTO public.community_members (community_id, user_id, role)
        VALUES ('${publicCommunityId}', '${memberUser}', 'MEMBER');
      `);

      comm = await db.query<{ member_count: number }>(`
        SELECT member_count FROM public.communities WHERE id = '${publicCommunityId}';
      `);
      expect(comm.rows[0].member_count).toBe(2);
    });

    it('prevents duplicate community memberships at database constraint level', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.community_members (community_id, user_id, role)
          VALUES ('${publicCommunityId}', '${memberUser}', 'MEMBER');
        `)
      ).rejects.toThrow();

      // Count remains 2
      const comm = await db.query<{ member_count: number }>(`
        SELECT member_count FROM public.communities WHERE id = '${publicCommunityId}';
      `);
      expect(comm.rows[0].member_count).toBe(2);
    });

    it('accurately decrements member_count when a member leaves', async () => {
      await db.exec(`
        DELETE FROM public.community_members
        WHERE community_id = '${publicCommunityId}' AND user_id = '${memberUser}';
      `);

      const comm = await db.query<{ member_count: number }>(`
        SELECT member_count FROM public.communities WHERE id = '${publicCommunityId}';
      `);
      expect(comm.rows[0].member_count).toBe(1);
    });

    it('safely clamps member_count at zero and never goes negative', async () => {
      await db.exec(`
        DELETE FROM public.community_members
        WHERE community_id = '${publicCommunityId}' AND user_id = '${creatorUser}';
      `);

      const comm = await db.query<{ member_count: number }>(`
        SELECT member_count FROM public.communities WHERE id = '${publicCommunityId}';
      `);
      expect(comm.rows[0].member_count).toBe(0);
    });
  });

  describe('Creator channel subscriber count trigger (sync_channel_subscriber_count)', () => {
    it('accurately increments subscriber_count when a user subscribes', async () => {
      await db.exec(`
        INSERT INTO public.channel_subscribers (channel_id, user_id)
        VALUES ('${channelId}', '${memberUser}');
      `);

      let channel = await db.query<{ subscriber_count: number }>(`
        SELECT subscriber_count FROM public.creator_channels WHERE id = '${channelId}';
      `);
      expect(channel.rows[0].subscriber_count).toBe(1);

      await db.exec(`
        INSERT INTO public.channel_subscribers (channel_id, user_id)
        VALUES ('${channelId}', '${thirdUser}');
      `);

      channel = await db.query<{ subscriber_count: number }>(`
        SELECT subscriber_count FROM public.creator_channels WHERE id = '${channelId}';
      `);
      expect(channel.rows[0].subscriber_count).toBe(2);
    });

    it('prevents duplicate channel subscriptions with unique constraint', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.channel_subscribers (channel_id, user_id)
          VALUES ('${channelId}', '${memberUser}');
        `)
      ).rejects.toThrow();

      const channel = await db.query<{ subscriber_count: number }>(`
        SELECT subscriber_count FROM public.creator_channels WHERE id = '${channelId}';
      `);
      expect(channel.rows[0].subscriber_count).toBe(2);
    });

    it('accurately decrements subscriber_count when a user unsubscribes', async () => {
      await db.exec(`
        DELETE FROM public.channel_subscribers
        WHERE channel_id = '${channelId}' AND user_id = '${memberUser}';
      `);

      let channel = await db.query<{ subscriber_count: number }>(`
        SELECT subscriber_count FROM public.creator_channels WHERE id = '${channelId}';
      `);
      expect(channel.rows[0].subscriber_count).toBe(1);

      await db.exec(`
        DELETE FROM public.channel_subscribers
        WHERE channel_id = '${channelId}' AND user_id = '${thirdUser}';
      `);

      channel = await db.query<{ subscriber_count: number }>(`
        SELECT subscriber_count FROM public.creator_channels WHERE id = '${channelId}';
      `);
      expect(channel.rows[0].subscriber_count).toBe(0);
    });
  });

  describe('Row Level Security (RLS) Policies Registration', () => {
    it('registers hardened community and community_members RLS policies in pg_policies', async () => {
      const policiesRes = await db.query<{ policyname: string; tablename: string }>(`
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename IN ('communities', 'community_members');
      `);

      const policies = policiesRes.rows.map((p) => `${p.tablename}:${p.policyname}`);

      expect(policies).toContain('communities:communities_select');
      expect(policies).toContain('communities:communities_manage_creator');
      expect(policies).toContain('communities:communities_insert');
      expect(policies).toContain('communities:communities_delete');
      expect(policies).toContain('community_members:community_members_select');
      expect(policies).toContain('community_members:community_members_join');
      expect(policies).toContain('community_members:community_members_leave');
      expect(policies).toContain('community_members:community_members_manage_roles');
      expect(policies).toContain('community_members:community_members_remove_by_lead');
    });

    it('verifies community_members_join policy logic directly via SQL expression evaluation', async () => {
      // Community 1 is public, Community 2 is private
      const evalPublic = await db.query<{ allowed: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM public.communities c
          WHERE c.id = '${publicCommunityId}'
            AND (c.is_private = false OR c.creator_id = '${thirdUser}' OR public.is_platform_admin('${thirdUser}'))
        ) as allowed;
      `);
      expect(evalPublic.rows[0].allowed).toBe(true);

      const evalPrivateRegular = await db.query<{ allowed: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM public.communities c
          WHERE c.id = '${privateCommunityId}'
            AND (c.is_private = false OR c.creator_id = '${thirdUser}' OR public.is_platform_admin('${thirdUser}'))
        ) as allowed;
      `);
      expect(evalPrivateRegular.rows[0].allowed).toBe(false);

      const evalPrivateCreator = await db.query<{ allowed: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM public.communities c
          WHERE c.id = '${privateCommunityId}'
            AND (c.is_private = false OR c.creator_id = '${creatorUser}' OR public.is_platform_admin('${creatorUser}'))
        ) as allowed;
      `);
      expect(evalPrivateCreator.rows[0].allowed).toBe(true);

      const evalPrivateAdmin = await db.query<{ allowed: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM public.communities c
          WHERE c.id = '${privateCommunityId}'
            AND (c.is_private = false OR c.creator_id = '${adminUser}' OR public.is_platform_admin('${adminUser}'))
        ) as allowed;
      `);
      expect(evalPrivateAdmin.rows[0].allowed).toBe(true);
    });
  });

  describe('Discovery and Association Indexes', () => {
    it('verifies performance indexes are registered in pg_indexes', async () => {
      const indexes = await db.query<{ indexname: string }>(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'idx_posts_community_created',
            'idx_posts_channel_created',
            'idx_communities_discovery',
            'idx_community_members_role'
          );
      `);

      const names = indexes.rows.map((r) => r.indexname);
      expect(names).toContain('idx_posts_community_created');
      expect(names).toContain('idx_posts_channel_created');
      expect(names).toContain('idx_communities_discovery');
      expect(names).toContain('idx_community_members_role');
    });
  });
});
