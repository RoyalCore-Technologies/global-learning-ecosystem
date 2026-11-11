-- ==============================================================================
-- LEARNOVA PLATFORM — AI SAFETY, STREAMING & MULTILINGUAL SUPPORT (009)
-- Engine: PostgreSQL 15+ / Supabase
-- Milestone: M5.5 — Safety Guardrails, Trust Auditing & Multilingual AI
-- Description: Extends AI sessions, messages, and assessments with language
--              and safety metadata, plus privacy-preserving safety audit logs.
-- ==============================================================================

-- 1. Extend AI Learning Sessions with language and age-appropriate calibration
ALTER TABLE public.ai_learning_sessions
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS age_group text NOT NULL DEFAULT 'ADULT';

DO $$ BEGIN
  ALTER TABLE public.ai_learning_sessions
    ADD CONSTRAINT ai_sessions_age_group_check CHECK (age_group IN ('CHILD', 'TEEN', 'ADULT'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Extend AI Learning Messages with honest fallback & safety flags
ALTER TABLE public.ai_learning_messages
  ADD COLUMN IF NOT EXISTS is_fallback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS safety_status text NOT NULL DEFAULT 'SAFE',
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- 3. Extend AI Assessments with language tracking
ALTER TABLE public.ai_assessments
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- 4. Privacy-Preserving AI Safety Events Table
-- Records policy enforcement categories without storing sensitive PII or raw unsafe inputs.
CREATE TABLE IF NOT EXISTS public.ai_safety_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id uuid REFERENCES public.ai_learning_sessions(id) ON DELETE SET NULL,
    course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    category text NOT NULL CHECK (category IN ('PROMPT_INJECTION', 'UNSAFE_CONTENT', 'PII_REDACTED', 'ACADEMIC_DISHONESTY', 'AGE_RESTRICTED')),
    severity text NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    action_taken text NOT NULL CHECK (action_taken IN ('BLOCKED', 'REDACTED', 'GUIDED_REDIRECT')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.ai_safety_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "ai_safety_events_select" ON public.ai_safety_events;
  DROP POLICY IF EXISTS "ai_safety_events_insert" ON public.ai_safety_events;
END $$;

CREATE POLICY "ai_safety_events_select" ON public.ai_safety_events
    FOR SELECT USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "ai_safety_events_insert" ON public.ai_safety_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_course_lesson
    ON public.ai_learning_sessions(user_id, course_id, lesson_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_safety_events_user
    ON public.ai_safety_events(user_id, created_at DESC);
