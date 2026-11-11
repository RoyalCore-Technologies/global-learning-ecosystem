import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Learnova Milestone 5.2: AI Learning Foundation Schema & RLS (PGlite Engine Tests)', () => {
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

  const studentUser1 = '11111111-1111-1111-1111-111111111111';
  const studentUser2 = '22222222-2222-2222-2222-222222222222';
  const educatorUser = '33333333-3333-3333-3333-333333333333';

  let sessionId: string;

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

    // 2. Execute all migrations 001 - 009
    await db.exec(migration001);
    await db.exec(migration002);
    await db.exec(migration003);
    await db.exec(migration004);
    await db.exec(migration005);
    await db.exec(migration006);
    await db.exec(migration007);
    await db.exec(migration008);
    await db.exec(migration009);

    // Grant table privileges to authenticated role for real RLS enforcement testing
    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    `);

    // Seed test users
    await db.exec(`
      INSERT INTO auth.users (id, raw_user_meta_data, email)
      VALUES 
        ('${studentUser1}', '{"username": "student_alpha", "display_name": "Student Alpha"}'::jsonb, 'alpha@learnova.test'),
        ('${studentUser2}', '{"username": "student_beta", "display_name": "Student Beta"}'::jsonb, 'beta@learnova.test'),
        ('${educatorUser}', '{"username": "prof_turing", "display_name": "Prof. Turing", "role": "EDUCATOR"}'::jsonb, 'turing@learnova.test');
    `);
  });

  it('provisions AI tables with correct schemas and constraints', async () => {
    const tableRes = await db.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename LIKE 'ai_%'
      ORDER BY tablename;
    `);

    const tableNames = tableRes.rows.map((r) => r.tablename);
    expect(tableNames).toContain('ai_assessments');
    expect(tableNames).toContain('ai_learning_messages');
    expect(tableNames).toContain('ai_learning_sessions');
  });

  it('allows learner to create an AI learning session and records messages', async () => {
    // Act as student 1
    await db.exec(`SET request.jwt.claim.sub = '${studentUser1}';`);

    const sessionRes = await db.query<{ id: string; mode: string }>(`
      INSERT INTO public.ai_learning_sessions (user_id, mode, learner_level, title)
      VALUES ('${studentUser1}', 'SOCRATIC', 'INTERMEDIATE', 'Distributed Consensus Exploration')
      RETURNING id, mode;
    `);

    expect(sessionRes.rows.length).toBe(1);
    sessionId = sessionRes.rows[0].id;
    expect(sessionRes.rows[0].mode).toBe('SOCRATIC');

    // Add user query message
    await db.query(`
      INSERT INTO public.ai_learning_messages (session_id, sender, content)
      VALUES ('${sessionId}', 'user', 'How does Raft guarantee leader completeness?');
    `);

    // Add AI answer message with citations
    await db.query(`
      INSERT INTO public.ai_learning_messages (
        session_id, sender, content, citations, provider, model
      ) VALUES (
        '${sessionId}',
        'ai',
        'Raft guarantees leader completeness by enforcing majority quorum intersection...',
        '["Ongaro & Ousterhout (2014)"]'::jsonb,
        'anthropic',
        'claude-3-7-sonnet'
      );
    `);

    const msgRes = await db.query<{ content: string; sender: string }>(`
      SELECT content, sender FROM public.ai_learning_messages
      WHERE session_id = '${sessionId}'
      ORDER BY created_at ASC;
    `);

    expect(msgRes.rows).toHaveLength(2);
    expect(msgRes.rows[0].sender).toBe('user');
    expect(msgRes.rows[1].sender).toBe('ai');
  });

  it('verifies RLS policies registered in pg_policies for AI tables', async () => {
    const policiesRes = await db.query<{ policyname: string; tablename: string }>(`
      SELECT policyname, tablename
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename LIKE 'ai_%';
    `);

    const policies = policiesRes.rows.map((p) => `${p.tablename}:${p.policyname}`);
    expect(policies).toContain('ai_learning_sessions:ai_sessions_select');
    expect(policies).toContain('ai_learning_sessions:ai_sessions_insert');
    expect(policies).toContain('ai_learning_sessions:ai_sessions_update');
    expect(policies).toContain('ai_learning_sessions:ai_sessions_delete');
    expect(policies).toContain('ai_learning_messages:ai_messages_select');
    expect(policies).toContain('ai_learning_messages:ai_messages_insert');
    expect(policies).toContain('ai_assessments:ai_assessments_select');
    expect(policies).toContain('ai_assessments:ai_assessments_insert');
    expect(policies).toContain('ai_assessments:ai_assessments_update');
  });

  it('evaluates learner privacy RLS expression logic directly', async () => {
    // Check if student 1 can access session created by student 1
    const evalStudent1 = await db.query<{ allowed: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM public.ai_learning_sessions s
        WHERE s.id = '${sessionId}' AND (s.user_id = '${studentUser1}' OR public.is_platform_admin('${studentUser1}'))
      ) as allowed;
    `);
    expect(evalStudent1.rows[0].allowed).toBe(true);

    // Check if student 2 can access session created by student 1
    const evalStudent2 = await db.query<{ allowed: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM public.ai_learning_sessions s
        WHERE s.id = '${sessionId}' AND (s.user_id = '${studentUser2}' OR public.is_platform_admin('${studentUser2}'))
      ) as allowed;
    `);
    expect(evalStudent2.rows[0].allowed).toBe(false);
  });

  it('supports knowledge check assessment recording and grading', async () => {
    // Act as student 1
    await db.exec(`SET request.jwt.claim.sub = '${studentUser1}';`);

    const questionsJson = JSON.stringify([
      {
        id: 'q1',
        prompt: 'What principle guarantees that two majorities in cluster size 2f + 1 intersect?',
        options: ['Pigeonhole Principle', 'Byzantine Theorem', 'CAP Conjecture'],
        correct_option_index: 0,
      },
    ]);

    const assessRes = await db.query<{ id: string }>(`
      INSERT INTO public.ai_assessments (
        user_id, topic, level, questions, score, total_questions, percentage, passed, completed_at
      ) VALUES (
        '${studentUser1}',
        'Raft Quorum Invariants',
        'INTERMEDIATE',
        '${questionsJson}'::jsonb,
        1,
        1,
        100.0,
        true,
        now()
      )
      RETURNING id;
    `);

    expect(assessRes.rows.length).toBe(1);

    const record = await db.query<{ passed: boolean; score: number }>(`
      SELECT passed, score FROM public.ai_assessments WHERE id = '${assessRes.rows[0].id}';
    `);
    expect(record.rows[0].passed).toBe(true);
    expect(record.rows[0].score).toBe(1);
  });

  describe('Adaptive Learning & Concept Mastery (008)', () => {
    it('creates and updates learner concept mastery with spaced-repetition attributes', async () => {
      // Act as student 1
      await db.exec(`SET request.jwt.claim.sub = '${studentUser1}';`);

      const insertRes = await db.query<{ id: string; status: string }>(`
        INSERT INTO public.learner_concept_mastery (
          user_id, concept_tag, mastery_score, attempts_count, correct_count,
          review_interval_days, ease_factor, repetition_count, status
        ) VALUES (
          '${studentUser1}', 'quorum-intersection', 1.0, 3, 3,
          6, 2.60, 2, 'MASTERED'
        )
        RETURNING id, status;
      `);

      expect(insertRes.rows.length).toBe(1);
      expect(insertRes.rows[0].status).toBe('MASTERED');

      // Update for review failure (knowledge gap detection)
      const updateRes = await db.query<{ status: string; repetition_count: number }>(`
        UPDATE public.learner_concept_mastery
        SET 
          status = 'NEEDS_REVISION',
          repetition_count = 0,
          review_interval_days = 1,
          mastery_score = 0.5,
          attempts_count = 4,
          last_evaluated_at = now()
        WHERE user_id = '${studentUser1}' AND concept_tag = 'quorum-intersection'
        RETURNING status, repetition_count;
      `);

      expect(updateRes.rows[0].status).toBe('NEEDS_REVISION');
      expect(updateRes.rows[0].repetition_count).toBe(0);
    });

    it('enforces learner privacy: student 2 cannot see student 1 mastery records under active RLS', async () => {
      // Student 1 can see their own mastery record under authenticated role
      await db.exec('BEGIN;');
      await db.exec(`SET LOCAL ROLE authenticated;`);
      await db.exec(`SET LOCAL request.jwt.claim.sub = '${studentUser1}';`);
      const s1Rows = await db.query(`SELECT * FROM public.learner_concept_mastery;`);
      expect(s1Rows.rows.length).toBe(1);
      await db.exec('COMMIT;');

      // Student 2 sees 0 rows on sessions, messages, assessments, and mastery under active RLS
      await db.exec('BEGIN;');
      await db.exec(`SET LOCAL ROLE authenticated;`);
      await db.exec(`SET LOCAL request.jwt.claim.sub = '${studentUser2}';`);

      const s2Sessions = await db.query(`SELECT * FROM public.ai_learning_sessions;`);
      const s2Messages = await db.query(`SELECT * FROM public.ai_learning_messages;`);
      const s2Assessments = await db.query(`SELECT * FROM public.ai_assessments;`);
      const s2Mastery = await db.query(`SELECT * FROM public.learner_concept_mastery;`);

      expect(s2Sessions.rows.length).toBe(0);
      expect(s2Messages.rows.length).toBe(0);
      expect(s2Assessments.rows.length).toBe(0);
      expect(s2Mastery.rows.length).toBe(0);

      // Student 2 cannot insert a mastery record spoofing student 1's user_id
      await expect(
        db.exec(`
          INSERT INTO public.learner_concept_mastery (user_id, concept_tag, mastery_score)
          VALUES ('${studentUser1}', 'spoofed-concept', 1.0);
        `)
      ).rejects.toThrow();
      await db.exec('ROLLBACK;');
    });
  });

  describe('AI Safety Events & Multilingual Support (009)', () => {
    it('supports multilingual session metadata and enforces ai_safety_events RLS', async () => {
      await db.exec('BEGIN;');
      await db.exec(`SET LOCAL ROLE authenticated;`);
      await db.exec(`SET LOCAL request.jwt.claim.sub = '${studentUser1}';`);

      const langSession = await db.query<{ id: string; language: string; age_group: string }>(`
        INSERT INTO public.ai_learning_sessions (user_id, mode, learner_level, language, age_group, title)
        VALUES ('${studentUser1}', 'SOCRATIC', 'BEGINNER', 'es', 'TEEN', 'Sesión en Español')
        RETURNING id, language, age_group;
      `);
      expect(langSession.rows[0].language).toBe('es');
      expect(langSession.rows[0].age_group).toBe('TEEN');

      const safetyEv = await db.query<{ id: string; category: string; action_taken: string }>(`
        INSERT INTO public.ai_safety_events (user_id, session_id, category, severity, action_taken)
        VALUES ('${studentUser1}', '${langSession.rows[0].id}', 'PROMPT_INJECTION', 'HIGH', 'BLOCKED')
        RETURNING id, category, action_taken;
      `);
      expect(safetyEv.rows[0].category).toBe('PROMPT_INJECTION');
      expect(safetyEv.rows[0].action_taken).toBe('BLOCKED');
      await db.exec('COMMIT;');

      // Student 2 cannot view Student 1 safety events under active RLS
      await db.exec('BEGIN;');
      await db.exec(`SET LOCAL ROLE authenticated;`);
      await db.exec(`SET LOCAL request.jwt.claim.sub = '${studentUser2}';`);
      const s2Events = await db.query(`SELECT * FROM public.ai_safety_events;`);
      expect(s2Events.rows.length).toBe(0);
      await db.exec('COMMIT;');
    });
  });
});
