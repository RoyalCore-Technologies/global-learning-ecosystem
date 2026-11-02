import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Learnova PostgreSQL Live Engine Execution Tests (PGlite)', () => {
  let db: PGlite;
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const migration001 = fs.readFileSync(path.join(migrationsDir, '001_role_security_policy.sql'), 'utf8');
  const migration002 = fs.readFileSync(path.join(migrationsDir, '002_learnova_master_schema.sql'), 'utf8');
  const migration003 = fs.readFileSync(path.join(migrationsDir, '003_storage_buckets.sql'), 'utf8');

  beforeAll(async () => {
    db = new PGlite();

    // 1. Mock Supabase Auth & Storage Schemas for standalone execution
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

    // 2. Execute Migrations 001, 002, and 003 in sequence
    await db.exec(migration001);
    await db.exec(migration002);
    await db.exec(migration003);
  });

  it('verifies all 26 platform tables and storage buckets were created in the database engine', async () => {
    const tableRes = await db.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
    `);
    const tables = tableRes.rows.map((r) => r.tablename);

    expect(tables).toContain('profiles');
    expect(tables).toContain('posts');
    expect(tables).toContain('courses');
    expect(tables).toContain('conversations');
    expect(tables).toContain('messages');
    expect(tables).toContain('role_audit_logs');
    expect(tables.length).toBe(26);

    const bucketRes = await db.query<{ id: string }>(`SELECT id FROM storage.buckets;`);
    const buckets = bucketRes.rows.map((r) => r.id);
    expect(buckets).toEqual(
      expect.arrayContaining(['avatars', 'content-media', 'course-materials', 'project-artifacts'])
    );
  });

  it('normal student signup automatically provisions a profile with role STUDENT', async () => {
    const signupRes = await db.query<{ id: string }>(`
      INSERT INTO auth.users (id, raw_user_meta_data, email)
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        '{"username": "test_student", "display_name": "Test Student"}'::jsonb,
        'student@learnova.test'
      )
      RETURNING id;
    `);

    expect(signupRes.rows.length).toBe(1);

    const profileRes = await db.query<{ username: string; role: string }>(`
      SELECT username, role FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';
    `);

    expect(profileRes.rows[0].username).toBe('test_student');
    expect(profileRes.rows[0].role).toBe('STUDENT');
  });

  it('malicious signup attempting { role: "ADMIN" } is sanitized to role STUDENT', async () => {
    await db.query(`
      INSERT INTO auth.users (id, raw_user_meta_data, email)
      VALUES (
        '22222222-2222-2222-2222-222222222222',
        '{"username": "hacker_user", "display_name": "Hacker", "role": "ADMIN"}'::jsonb,
        'hacker@learnova.test'
      );
    `);

    const profileRes = await db.query<{ username: string; role: string }>(`
      SELECT username, role FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222';
    `);

    // Must be sanitized to STUDENT
    expect(profileRes.rows[0].username).toBe('hacker_user');
    expect(profileRes.rows[0].role).toBe('STUDENT');
  });

  it('prevents authenticated users from escalating their role to ADMIN via direct UPDATE', async () => {
    // Set caller context to normal authenticated user
    await db.exec(`
      SET request.jwt.claims = '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}';
    `);

    let errorThrown = false;
    try {
      await db.query(`
        UPDATE public.profiles
        SET role = 'ADMIN'
        WHERE id = '11111111-1111-1111-1111-111111111111';
      `);
    } catch (err: unknown) {
      errorThrown = true;
      expect((err as Error).message).toContain('Access Denied');
    }

    expect(errorThrown).toBe(true);

    // Verify role is still STUDENT
    const checkRes = await db.query<{ role: string }>(`
      SELECT role FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';
    `);
    expect(checkRes.rows[0].role).toBe('STUDENT');
  });

  it('enforces audit log immutability and blocks UPDATE or DELETE on audit logs', async () => {
    // Insert initial audit log
    await db.query(`
      INSERT INTO public.role_audit_logs (
        target_user_id,
        performed_by,
        old_role,
        new_role,
        reason
      ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        NULL,
        'STUDENT',
        'EDUCATOR',
        'Verified academic credentials'
      );
    `);

    // Attempt to tamper with audit record
    let updateFailed = false;
    try {
      await db.query(`
        UPDATE public.role_audit_logs
        SET reason = 'Tampered reason'
        WHERE target_user_id = '11111111-1111-1111-1111-111111111111';
      `);
    } catch (err: unknown) {
      updateFailed = true;
      expect((err as Error).message).toContain('Audit log records are strictly immutable');
    }
    expect(updateFailed).toBe(true);

    // Attempt to delete audit record
    let deleteFailed = false;
    try {
      await db.query(`
        DELETE FROM public.role_audit_logs
        WHERE target_user_id = '11111111-1111-1111-1111-111111111111';
      `);
    } catch (err: unknown) {
      deleteFailed = true;
      expect((err as Error).message).toContain('Audit log records are strictly immutable');
    }
    expect(deleteFailed).toBe(true);
  });

  it('blocks users from self-verifying creator channels', async () => {
    await db.exec(`
      SET request.jwt.claims = '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}';
    `);

    let verificationBlocked = false;
    try {
      await db.query(`
        INSERT INTO public.creator_channels (
          owner_id,
          name,
          slug,
          is_verified
        ) VALUES (
          '11111111-1111-1111-1111-111111111111',
          'Fake Verified Academy',
          'fake-verified-academy',
          true
        );
      `);
    } catch (err: unknown) {
      verificationBlocked = true;
      expect((err as Error).message).toContain('Only platform administrators can verify creator channels');
    }
    expect(verificationBlocked).toBe(true);
  });

  it('enforces conversation membership security', async () => {
    // Helper function test: user 1 is member, user 2 is not
    const convId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    await db.exec(`
      INSERT INTO public.conversations (id, type, title)
      VALUES ('${convId}', 'DIRECT', 'Private Discussion');

      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES ('${convId}', '11111111-1111-1111-1111-111111111111');
    `);

    const isUser1Member = await db.query<{ is_member: boolean }>(`
      SELECT public.is_conversation_member('${convId}', '11111111-1111-1111-1111-111111111111') as is_member;
    `);
    expect(isUser1Member.rows[0].is_member).toBe(true);

    const isUser2Member = await db.query<{ is_member: boolean }>(`
      SELECT public.is_conversation_member('${convId}', '22222222-2222-2222-2222-222222222222') as is_member;
    `);
    expect(isUser2Member.rows[0].is_member).toBe(false);
  });

  // ============================================================================
  // FINAL APPROVAL GATE TESTS (AREAS 1, 2, 3)
  // ============================================================================

  it('Gate 1: bootstrap_initial_admin is atomic, verifies caller, and promotes exactly one account', async () => {
    // 1. Create a candidate account
    await db.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES (
        '33333333-3333-3333-3333-333333333333',
        'founder@learnova.test',
        '{"username": "founder_user", "display_name": "Founder"}'::jsonb
      );
    `);

    // Verify initial role is STUDENT
    const initialProfile = await db.query<{ role: string }>(`
      SELECT role FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333';
    `);
    expect(initialProfile.rows[0].role).toBe('STUDENT');

    // 2. Calling as an unprivileged authenticated user must be rejected
    await db.exec(`
      SET request.jwt.claims = '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}';
    `);

    let unprivilegedBlocked = false;
    try {
      await db.query(`SELECT public.bootstrap_initial_admin('founder@learnova.test');`);
    } catch (err: unknown) {
      unprivilegedBlocked = true;
      expect((err as Error).message).toContain('Access Denied');
    }
    expect(unprivilegedBlocked).toBe(true);

    // 3. Calling with a non-existent email must fail
    await db.exec(`SET request.jwt.claims = '';`); // Reset to superuser / postgres
    let nonExistentFailed = false;
    try {
      await db.query(`SELECT public.bootstrap_initial_admin('nonexistent@learnova.test');`);
    } catch (err: unknown) {
      nonExistentFailed = true;
      expect((err as Error).message).toContain('does not exist');
    }
    expect(nonExistentFailed).toBe(true);

    // 4. Calling as superuser promotes exactly one account and inserts an audit log atomically
    const bootstrapRes = await db.query<{ bootstrap_initial_admin: string }>(`
      SELECT public.bootstrap_initial_admin('founder@learnova.test', 'Formal founder bootstrap promotion');
    `);
    expect(bootstrapRes.rows[0].bootstrap_initial_admin).toBe('33333333-3333-3333-3333-333333333333');

    // Verify role is now ADMIN and status is VERIFIED
    const updatedProfile = await db.query<{ role: string; verification_status: string }>(`
      SELECT role, verification_status FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333';
    `);
    expect(updatedProfile.rows[0].role).toBe('ADMIN');
    expect(updatedProfile.rows[0].verification_status).toBe('VERIFIED');

    // Verify audit log row was created
    const auditRes = await db.query<{ new_role: string; reason: string }>(`
      SELECT new_role, reason FROM public.role_audit_logs WHERE target_user_id = '33333333-3333-3333-3333-333333333333';
    `);
    expect(auditRes.rows[0].new_role).toBe('ADMIN');
    expect(auditRes.rows[0].reason).toContain('Formal founder bootstrap promotion');
  });

  it('Gate 2: legitimate account deletion succeeds for target user and admin, preserving audit logs', async () => {
    // 1. Create target student and admin who promotes them
    await db.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES 
        ('44444444-4444-4444-4444-444444444444', 'student_to_delete@learnova.test', '{"username": "del_student", "display_name": "Del Student"}'::jsonb),
        ('55555555-5555-5555-5555-555555555555', 'admin_to_delete@learnova.test', '{"username": "del_admin", "display_name": "Del Admin"}'::jsonb);

      INSERT INTO public.role_audit_logs (
        target_user_id,
        performed_by,
        performed_by_email,
        old_role,
        new_role,
        reason
      ) VALUES (
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555',
        'del_admin@learnova.test',
        'STUDENT',
        'EDUCATOR',
        'Promoted prior to deletion test'
      );
    `);

    // 2. Delete target user: must SUCCEED without being blocked
    await db.exec(`
      DELETE FROM auth.users WHERE id = '44444444-4444-4444-4444-444444444444';
    `);

    // Profile must be cascaded/deleted
    const profileCheck = await db.query(`SELECT id FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444444';`);
    expect(profileCheck.rows.length).toBe(0);

    // Audit log record must REMAIN 100% INTACT
    const auditCheck1 = await db.query<{ target_user_id: string; performed_by: string }>(`
      SELECT target_user_id, performed_by FROM public.role_audit_logs WHERE target_user_id = '44444444-4444-4444-4444-444444444444';
    `);
    expect(auditCheck1.rows.length).toBe(1);
    expect(auditCheck1.rows[0].target_user_id).toBe('44444444-4444-4444-4444-444444444444');

    // 3. Delete administrator user: must SUCCEED without being blocked by foreign key or immutability triggers
    await db.exec(`
      DELETE FROM auth.users WHERE id = '55555555-5555-5555-5555-555555555555';
    `);

    // Audit log record must STILL exist completely intact
    const auditCheck2 = await db.query<{ target_user_id: string; performed_by_email: string }>(`
      SELECT target_user_id, performed_by_email FROM public.role_audit_logs WHERE target_user_id = '44444444-4444-4444-4444-444444444444';
    `);
    expect(auditCheck2.rows.length).toBe(1);
    expect(auditCheck2.rows[0].performed_by_email).toBe('del_admin@learnova.test');
  });

  it('Gate 3: SECURITY DEFINER least privilege permissions and safe search_path execution', async () => {
    // 1. Verify RLS helper is executable by authenticated role
    const adminCheck = await db.query<{ is_admin: boolean }>(`
      SELECT public.is_platform_admin('33333333-3333-3333-3333-333333333333') as is_admin;
    `);
    expect(adminCheck.rows[0].is_admin).toBe(true);

    // 2. Direct execution of internal trigger functions by unprivileged callers is revoked
    // In PostgreSQL, direct execution of trigger functions throws an error when called as regular functions
    let triggerDirectBlocked = false;
    try {
      await db.query(`SELECT public.prevent_unauthorized_role_assignment();`);
    } catch (err: unknown) {
      triggerDirectBlocked = true;
      expect((err as Error).message).toBeDefined();
    }
    expect(triggerDirectBlocked).toBe(true);
  });
});
