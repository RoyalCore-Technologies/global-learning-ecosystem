import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Learnova Milestone 3: Learning Foundation (PGlite Engine Tests)', () => {
  let db: PGlite;
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const migration001 = fs.readFileSync(path.join(migrationsDir, '001_role_security_policy.sql'), 'utf8');
  const migration002 = fs.readFileSync(path.join(migrationsDir, '002_learnova_master_schema.sql'), 'utf8');
  const migration003 = fs.readFileSync(path.join(migrationsDir, '003_storage_buckets.sql'), 'utf8');
  const migration004 = fs.readFileSync(path.join(migrationsDir, '004_social_foundation.sql'), 'utf8');
  const migration005 = fs.readFileSync(path.join(migrationsDir, '005_learning_foundation.sql'), 'utf8');

  // Test identities
  const studentUser = '11111111-1111-1111-1111-111111111111';
  const secondStudentUser = '22222222-2222-2222-2222-222222222222';
  const educatorUser = '33333333-3333-3333-3333-333333333333';

  // Test entities
  let courseId: string;
  let emptyCourseId: string;
  let moduleId: string;
  let lesson1Id: string;
  let lesson2Id: string;
  let lesson3Id: string;
  let lesson4Id: string;
  let enrollmentId: string;

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

    // 2. Execute Migrations 001 through 005 in sequence
    await db.exec(migration001);
    await db.exec(migration002);
    await db.exec(migration003);
    await db.exec(migration004);
    await db.exec(migration005);

    // 3. Provision test users (triggers automatic handle_new_user profile creation)
    await db.exec(`
      INSERT INTO auth.users (id, raw_user_meta_data, email) VALUES
        ('${studentUser}', '{"username": "student_alex", "display_name": "Alex Student"}'::jsonb, 'student@learnova.edu'),
        ('${secondStudentUser}', '{"username": "student_bianca", "display_name": "Bianca Dev"}'::jsonb, 'bianca@learnova.edu'),
        ('${educatorUser}', '{"username": "prof_marcus", "display_name": "Prof Marcus Vance"}'::jsonb, 'marcus@cmu.edu');

      -- Elevate educator role in service_role context
      SET request.jwt.claims = '{"role": "service_role"}';
      UPDATE public.profiles SET role = 'EDUCATOR' WHERE id = '${educatorUser}';
      RESET request.jwt.claims;
    `);
  });

  it('verifies migration 005 adds Stitch metadata and counter columns to courses and lessons', async () => {
    // Check columns on public.courses
    const courseColsRes = await db.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'courses';
    `);
    const courseCols = courseColsRes.rows.map((r) => r.column_name);
    expect(courseCols).toContain('enrolled_count');
    expect(courseCols).toContain('rating');
    expect(courseCols).toContain('reviews_count');

    // Check columns on public.lessons
    const lessonColsRes = await db.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lessons';
    `);
    const lessonCols = lessonColsRes.rows.map((r) => r.column_name);
    expect(lessonCols).toContain('transcript');
    expect(lessonCols).toContain('code_lab');
    expect(lessonCols).toContain('resources');
  });

  it('registers authoring RLS policies for course_modules and lessons', async () => {
    const policiesRes = await db.query<{ policyname: string; tablename: string }>(`
      SELECT policyname, tablename
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('course_modules', 'lessons');
    `);
    const policies = policiesRes.rows.map((p) => `${p.tablename}:${p.policyname}`);

    expect(policies).toContain('course_modules:course_modules_insert');
    expect(policies).toContain('course_modules:course_modules_update');
    expect(policies).toContain('course_modules:course_modules_delete');
    expect(policies).toContain('lessons:lessons_insert');
    expect(policies).toContain('lessons:lessons_update');
    expect(policies).toContain('lessons:lessons_delete');
  });

  it('verifies course enrollment counter increments, decrements, and prevents duplicates', async () => {
    // 1. Instructor creates a new course
    const courseRes = await db.query<{ id: string; enrolled_count: number }>(`
      INSERT INTO public.courses (
        instructor_id,
        title,
        slug,
        summary,
        description,
        level,
        tier,
        is_published
      ) VALUES (
        '${educatorUser}',
        'Distributed Consensus Architecture in Rust',
        'distributed-consensus-rust',
        'Formal methods and Paxos/Raft consensus',
        'Complete systems architecture course',
        'ADVANCED',
        'FREE',
        true
      ) RETURNING id, enrolled_count;
    `);

    courseId = courseRes.rows[0].id;
    expect(courseRes.rows[0].enrolled_count).toBe(0);

    // 2. Student 1 enrolls -> enrolled_count becomes 1
    const enrollRes1 = await db.query<{ id: string }>(`
      INSERT INTO public.course_enrollments (user_id, course_id)
      VALUES ('${studentUser}', '${courseId}')
      RETURNING id;
    `);
    enrollmentId = enrollRes1.rows[0].id;

    const countCheck1 = await db.query<{ enrolled_count: number }>(`
      SELECT enrolled_count FROM public.courses WHERE id = '${courseId}';
    `);
    expect(countCheck1.rows[0].enrolled_count).toBe(1);

    // 3. Student 2 enrolls -> enrolled_count becomes 2
    await db.exec(`
      INSERT INTO public.course_enrollments (user_id, course_id)
      VALUES ('${secondStudentUser}', '${courseId}');
    `);

    const countCheck2 = await db.query<{ enrolled_count: number }>(`
      SELECT enrolled_count FROM public.courses WHERE id = '${courseId}';
    `);
    expect(countCheck2.rows[0].enrolled_count).toBe(2);

    // 4. Student 2 unenrolls (cancels enrollment) -> enrolled_count decrements to 1
    await db.exec(`
      DELETE FROM public.course_enrollments
      WHERE user_id = '${secondStudentUser}' AND course_id = '${courseId}';
    `);

    const countCheck3 = await db.query<{ enrolled_count: number }>(`
      SELECT enrolled_count FROM public.courses WHERE id = '${courseId}';
    `);
    expect(countCheck3.rows[0].enrolled_count).toBe(1);

    // 5. Duplicate enrollment prevention: Student 1 trying to enroll again must fail
    await expect(
      db.exec(`
        INSERT INTO public.course_enrollments (user_id, course_id)
        VALUES ('${studentUser}', '${courseId}');
      `)
    ).rejects.toThrow();
  });

  it('safely handles progress calculation for courses with zero lessons', async () => {
    // Create an empty course with zero lessons
    const emptyRes = await db.query<{ id: string }>(`
      INSERT INTO public.courses (
        instructor_id,
        title,
        slug,
        description,
        level,
        tier,
        is_published
      ) VALUES (
        '${educatorUser}',
        'Empty Draft Course',
        'empty-draft-course',
        'Course under construction',
        'BEGINNER',
        'FREE',
        true
      ) RETURNING id;
    `);
    emptyCourseId = emptyRes.rows[0].id;

    // Student enrolls in empty course
    const enrollRes = await db.query<{ id: string; progress_percentage: string; completed_at: string | null }>(`
      INSERT INTO public.course_enrollments (user_id, course_id)
      VALUES ('${studentUser}', '${emptyCourseId}')
      RETURNING id, progress_percentage, completed_at;
    `);

    expect(Number(enrollRes.rows[0].progress_percentage)).toBe(0.0);
    expect(enrollRes.rows[0].completed_at).toBeNull();
  });

  it('correctly calculates progress at 0%, 25%, 50%, 75% and 100% completion with completed_at transition', async () => {
    // 1. Create a module for the course
    const modRes = await db.query<{ id: string }>(`
      INSERT INTO public.course_modules (course_id, title, order_index)
      VALUES ('${courseId}', 'Module 1: Consensus Primitives', 1)
      RETURNING id;
    `);
    moduleId = modRes.rows[0].id;

    // 2. Create 4 lessons with Stitch metadata (transcript, code_lab, resources)
    const l1Res = await db.query<{ id: string }>(`
      INSERT INTO public.lessons (
        module_id, title, slug, order_index, content, duration_minutes, is_preview,
        transcript, code_lab
      ) VALUES (
        '${moduleId}', '1.1 System Models & FLP Impossibility', '1-1-system-models', 1,
        'Lesson content markdown...', 35, true,
        '[{"timestamp_sec": 0, "label": "00:00", "text": "Welcome to FLP theorem overview"}]'::jsonb,
        '{"language": "rust", "starter_code": "fn main() {}"}'::jsonb
      ) RETURNING id;
    `);
    lesson1Id = l1Res.rows[0].id;

    const l2Res = await db.query<{ id: string }>(`
      INSERT INTO public.lessons (module_id, title, slug, order_index, content, duration_minutes, is_preview)
      VALUES ('${moduleId}', '1.2 Logical Clocks & Vector Clocks', '1-2-logical-clocks', 2, 'Content...', 40, false)
      RETURNING id;
    `);
    lesson2Id = l2Res.rows[0].id;

    const l3Res = await db.query<{ id: string }>(`
      INSERT INTO public.lessons (module_id, title, slug, order_index, content, duration_minutes, is_preview)
      VALUES ('${moduleId}', '1.3 State Machine Replication', '1-3-smr', 3, 'Content...', 45, false)
      RETURNING id;
    `);
    lesson3Id = l3Res.rows[0].id;

    const l4Res = await db.query<{ id: string }>(`
      INSERT INTO public.lessons (module_id, title, slug, order_index, content, duration_minutes, is_preview)
      VALUES ('${moduleId}', '1.4 Quorum Intersection Proof', '1-4-quorum-proof', 4, 'Content...', 50, false)
      RETURNING id;
    `);
    lesson4Id = l4Res.rows[0].id;

    // 3. Mark Lesson 1 complete (1/4 = 25.00%)
    await db.exec(`
      INSERT INTO public.lesson_progress (enrollment_id, lesson_id, is_completed)
      VALUES ('${enrollmentId}', '${lesson1Id}', true);
    `);

    const progress1 = await db.query<{ progress_percentage: string; completed_at: string | null }>(`
      SELECT progress_percentage, completed_at FROM public.course_enrollments WHERE id = '${enrollmentId}';
    `);
    expect(Number(progress1.rows[0].progress_percentage)).toBe(25.0);
    expect(progress1.rows[0].completed_at).toBeNull();

    // 4. Mark Lesson 2 complete (2/4 = 50.00%)
    await db.exec(`
      INSERT INTO public.lesson_progress (enrollment_id, lesson_id, is_completed)
      VALUES ('${enrollmentId}', '${lesson2Id}', true);
    `);

    const progress2 = await db.query<{ progress_percentage: string; completed_at: string | null }>(`
      SELECT progress_percentage, completed_at FROM public.course_enrollments WHERE id = '${enrollmentId}';
    `);
    expect(Number(progress2.rows[0].progress_percentage)).toBe(50.0);
    expect(progress2.rows[0].completed_at).toBeNull();

    // 5. Mark Lesson 3 complete (3/4 = 75.00%)
    await db.exec(`
      INSERT INTO public.lesson_progress (enrollment_id, lesson_id, is_completed)
      VALUES ('${enrollmentId}', '${lesson3Id}', true);
    `);

    const progress3 = await db.query<{ progress_percentage: string; completed_at: string | null }>(`
      SELECT progress_percentage, completed_at FROM public.course_enrollments WHERE id = '${enrollmentId}';
    `);
    expect(Number(progress3.rows[0].progress_percentage)).toBe(75.0);
    expect(progress3.rows[0].completed_at).toBeNull();

    // 6. Mark Lesson 4 complete (4/4 = 100.00%) -> completed_at must be populated!
    await db.exec(`
      INSERT INTO public.lesson_progress (enrollment_id, lesson_id, is_completed)
      VALUES ('${enrollmentId}', '${lesson4Id}', true);
    `);

    const progress4 = await db.query<{ progress_percentage: string; completed_at: string | null }>(`
      SELECT progress_percentage, completed_at FROM public.course_enrollments WHERE id = '${enrollmentId}';
    `);
    expect(Number(progress4.rows[0].progress_percentage)).toBe(100.0);
    expect(progress4.rows[0].completed_at).not.toBeNull();
  });

  it('clears completed_at when lesson completion is toggled off or deleted', async () => {
    // 1. Unmark Lesson 4 (toggle is_completed = false) -> progress drops to 75.00%, completed_at cleared
    await db.exec(`
      UPDATE public.lesson_progress
      SET is_completed = false
      WHERE enrollment_id = '${enrollmentId}' AND lesson_id = '${lesson4Id}';
    `);

    const updateCheck = await db.query<{ progress_percentage: string; completed_at: string | null }>(`
      SELECT progress_percentage, completed_at FROM public.course_enrollments WHERE id = '${enrollmentId}';
    `);
    expect(Number(updateCheck.rows[0].progress_percentage)).toBe(75.0);
    expect(updateCheck.rows[0].completed_at).toBeNull();

    // 2. Delete Lesson 3 progress record -> progress drops to 50.00%
    await db.exec(`
      DELETE FROM public.lesson_progress
      WHERE enrollment_id = '${enrollmentId}' AND lesson_id = '${lesson3Id}';
    `);

    const deleteCheck = await db.query<{ progress_percentage: string; completed_at: string | null }>(`
      SELECT progress_percentage, completed_at FROM public.course_enrollments WHERE id = '${enrollmentId}';
    `);
    expect(Number(deleteCheck.rows[0].progress_percentage)).toBe(50.0);
    expect(deleteCheck.rows[0].completed_at).toBeNull();
  });
});
