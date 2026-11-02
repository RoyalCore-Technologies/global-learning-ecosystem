import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Learnova Milestone 2: Social Foundation (PGlite Engine Tests)', () => {
  let db: PGlite;
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const migration001 = fs.readFileSync(path.join(migrationsDir, '001_role_security_policy.sql'), 'utf8');
  const migration002 = fs.readFileSync(path.join(migrationsDir, '002_learnova_master_schema.sql'), 'utf8');
  const migration003 = fs.readFileSync(path.join(migrationsDir, '003_storage_buckets.sql'), 'utf8');
  const migration004 = fs.readFileSync(path.join(migrationsDir, '004_social_foundation.sql'), 'utf8');

  // Test identities
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';
  const educatorUser = '33333333-3333-3333-3333-333333333333';

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

    // 2. Execute Migrations 001, 002, 003, and 004 in sequence
    await db.exec(migration001);
    await db.exec(migration002);
    await db.exec(migration003);
    await db.exec(migration004);

    // 3. Provision test users (triggers automatic handle_new_user profile creation)
    await db.exec(`
      INSERT INTO auth.users (id, raw_user_meta_data, email) VALUES
        ('${userA}', '{"username": "scholar_alex", "display_name": "Alex Scholar"}'::jsonb, 'scholar.a@learnova.edu'),
        ('${userB}', '{"username": "scholar_bianca", "display_name": "Bianca Dev"}'::jsonb, 'scholar.b@learnova.edu'),
        ('${educatorUser}', '{"username": "prof_vance", "display_name": "Prof Marcus Vance"}'::jsonb, 'educator@learnova.edu');

      -- Elevate educator role in service_role context
      SET request.jwt.claims = '{"role": "service_role"}';
      UPDATE public.profiles SET role = 'EDUCATOR' WHERE id = '${educatorUser}';
      RESET request.jwt.claims;
    `);
  });

  it('adds NEW_FOLLOWER and ACCURACY_ENDORSEMENT to notification_type enum', async () => {
    const enumRes = await db.query<{ enumlabel: string }>(`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'notification_type'
      ORDER BY e.enumsortorder;
    `);
    const labels = enumRes.rows.map((r) => r.enumlabel);

    expect(labels).toContain('NEW_FOLLOWER');
    expect(labels).toContain('ACCURACY_ENDORSEMENT');
    expect(labels).toContain('NEW_COMMENT');
    expect(labels).toContain('POST_UPVOTE');
  });

  it('verifies notification_preferences column default structure on profiles', async () => {
    const prefRes = await db.query<{ notification_preferences: any }>(`
      SELECT notification_preferences FROM public.profiles WHERE id = '${userA}';
    `);
    const prefs = prefRes.rows[0].notification_preferences;

    expect(prefs).toBeDefined();
    expect(prefs.in_app.comments).toBe(true);
    expect(prefs.in_app.endorsements).toBe(true);
    expect(prefs.in_app.follows).toBe(true);
    expect(prefs.email.weekly_digest).toBe(true);
  });

  it('verifies is_solution on comments and is_pinned on posts exist with default false', async () => {
    const postRes = await db.query<{ id: string; is_pinned: boolean }>(`
      INSERT INTO public.posts (author_id, title, slug, summary, content, type)
      VALUES (
        '${userA}',
        'Quantum Computing Algorithms in Qiskit',
        'quantum-computing-algorithms',
        'A formal exploration of Shor and Grover algorithms.',
        'Here is the complete quantum circuit formulation...',
        'ARTICLE'
      )
      RETURNING id, is_pinned;
    `);

    expect(postRes.rows[0].is_pinned).toBe(false);
    const postId = postRes.rows[0].id;

    const commentRes = await db.query<{ id: string; is_solution: boolean }>(`
      INSERT INTO public.comments (post_id, author_id, content)
      VALUES ('${postId}', '${userB}', 'Very clear explanation of the Hadamard gate.')
      RETURNING id, is_solution;
    `);

    expect(commentRes.rows[0].is_solution).toBe(false);
  });

  it('verifies GIN full-text search index correctly matches queries', async () => {
    const searchRes = await db.query<{ title: string }>(`
      SELECT title FROM public.posts
      WHERE to_tsvector('english', title || ' ' || coalesce(summary, '') || ' ' || content)
            @@ to_tsquery('english', 'quantum & algorithms');
    `);

    expect(searchRes.rows.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.rows[0].title).toBe('Quantum Computing Algorithms in Qiskit');
  });

  it('automatically synchronizes comment_count when comments are created and deleted', async () => {
    // 1. Get initial post
    const postRes = await db.query<{ id: string; comment_count: number }>(`
      SELECT id, comment_count FROM public.posts WHERE slug = 'quantum-computing-algorithms';
    `);
    const postId = postRes.rows[0].id;
    // Current comment_count should be 1 (from previous test)
    expect(postRes.rows[0].comment_count).toBe(1);

    // 2. Add another comment
    const newCommentRes = await db.query<{ id: string }>(`
      INSERT INTO public.comments (post_id, author_id, content)
      VALUES ('${postId}', '${educatorUser}', 'Peer review: verified proof.')
      RETURNING id;
    `);
    const newCommentId = newCommentRes.rows[0].id;

    const afterAdd = await db.query<{ comment_count: number }>(`
      SELECT comment_count FROM public.posts WHERE id = '${postId}';
    `);
    expect(afterAdd.rows[0].comment_count).toBe(2);

    // 3. Delete the comment
    await db.query(`DELETE FROM public.comments WHERE id = '${newCommentId}';`);

    const afterDelete = await db.query<{ comment_count: number }>(`
      SELECT comment_count FROM public.posts WHERE id = '${postId}';
    `);
    expect(afterDelete.rows[0].comment_count).toBe(1);
  });

  it('automatically synchronizes upvote_count when interactions are toggled', async () => {
    const post = (await db.query<{ id: string; upvote_count: number }>(`
      SELECT id, upvote_count FROM public.posts WHERE slug = 'quantum-computing-algorithms';
    `)).rows[0];

    expect(post.upvote_count).toBe(0);

    // User B upvotes insightful
    await db.query(`
      INSERT INTO public.interactions (user_id, post_id, type)
      VALUES ('${userB}', '${post.id}', 'UPVOTE_INSIGHTFUL');
    `);

    let updatedPost = (await db.query<{ upvote_count: number }>(`
      SELECT upvote_count FROM public.posts WHERE id = '${post.id}';
    `)).rows[0];
    expect(updatedPost.upvote_count).toBe(1);

    // Educator endorses accuracy
    await db.query(`
      INSERT INTO public.interactions (user_id, post_id, type)
      VALUES ('${educatorUser}', '${post.id}', 'ENDORSE_ACCURACY');
    `);

    updatedPost = (await db.query<{ upvote_count: number }>(`
      SELECT upvote_count FROM public.posts WHERE id = '${post.id}';
    `)).rows[0];
    expect(updatedPost.upvote_count).toBe(2);

    // User B toggles off upvote
    await db.query(`
      DELETE FROM public.interactions
      WHERE user_id = '${userB}' AND post_id = '${post.id}' AND type = 'UPVOTE_INSIGHTFUL';
    `);

    updatedPost = (await db.query<{ upvote_count: number }>(`
      SELECT upvote_count FROM public.posts WHERE id = '${post.id}';
    `)).rows[0];
    expect(updatedPost.upvote_count).toBe(1);
  });

  it('automatically generates in-app notifications for social actions respecting preferences', async () => {
    const post = (await db.query<{ id: string }>(`
      SELECT id FROM public.posts WHERE slug = 'quantum-computing-algorithms';
    `)).rows[0];

    // Clear notifications
    await db.query(`DELETE FROM public.notifications;`);

    // 1. User B comments on User A's post -> User A should receive NEW_COMMENT notification
    await db.query(`
      INSERT INTO public.comments (post_id, author_id, content)
      VALUES ('${post.id}', '${userB}', 'Excited to test this circuit.');
    `);

    let notifs = (await db.query<{ recipient_id: string; type: string; title: string }>(`
      SELECT recipient_id, type, title FROM public.notifications;
    `)).rows;

    expect(notifs.length).toBe(1);
    expect(notifs[0].recipient_id).toBe(userA);
    expect(notifs[0].type).toBe('NEW_COMMENT');

    // 2. Self comment: User A comments on User A's own post -> NO notification generated
    await db.query(`
      INSERT INTO public.comments (post_id, author_id, content)
      VALUES ('${post.id}', '${userA}', 'Thanks for testing.');
    `);

    notifs = (await db.query<{ recipient_id: string; type: string }>(`
      SELECT recipient_id, type FROM public.notifications;
    `)).rows;
    // Still 1 notification
    expect(notifs.length).toBe(1);

    // 3. User B follows User A -> User A receives NEW_FOLLOWER notification
    await db.query(`
      INSERT INTO public.follows (follower_id, following_id)
      VALUES ('${userB}', '${userA}');
    `);

    const followNotif = (await db.query<{ recipient_id: string; type: string }>(`
      SELECT recipient_id, type FROM public.notifications WHERE type = 'NEW_FOLLOWER';
    `)).rows;

    expect(followNotif.length).toBe(1);
    expect(followNotif[0].recipient_id).toBe(userA);

    // 4. Respects notification preferences:
    // Disable upvotes in userA's preferences
    await db.query(`
      UPDATE public.profiles
      SET notification_preferences = jsonb_set(notification_preferences, '{in_app,upvotes}', 'false')
      WHERE id = '${userA}';
    `);

    // User B upvotes post -> should NOT generate POST_UPVOTE notification
    await db.query(`
      INSERT INTO public.interactions (user_id, post_id, type)
      VALUES ('${userB}', '${post.id}', 'UPVOTE_INSIGHTFUL');
    `);

    const upvoteNotif = (await db.query<{ id: string }>(`
      SELECT id FROM public.notifications WHERE type = 'POST_UPVOTE';
    `)).rows;
    expect(upvoteNotif.length).toBe(0);
  });
});
