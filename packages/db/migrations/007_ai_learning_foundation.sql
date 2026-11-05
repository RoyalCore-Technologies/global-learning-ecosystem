-- ==============================================================================
-- LEARNOVA PLATFORM — AI LEARNING COMPANIONS & ASSESSMENT (007)
-- Engine: PostgreSQL 15+ / Supabase
-- Milestone: M5 — AI Learning Companions & Assessment
-- Description: AI interaction sessions, context-aware query history,
--              learning assessments, and learner mastery tracking.
-- ==============================================================================

-- 1. AI Interaction Sessions Table
CREATE TABLE IF NOT EXISTS public.ai_learning_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
    mode text NOT NULL DEFAULT 'EXPLANATION' CHECK (mode IN ('SOCRATIC', 'PROOF', 'CODE_ANALYSIS', 'MASTERY', 'EXPLANATION')),
    learner_level text NOT NULL DEFAULT 'BEGINNER' CHECK (learner_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    title text NOT NULL DEFAULT 'Learning Companion Session',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. AI Learning Messages Table
CREATE TABLE IF NOT EXISTS public.ai_learning_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.ai_learning_sessions(id) ON DELETE CASCADE,
    sender text NOT NULL CHECK (sender IN ('user', 'ai', 'system')),
    content text NOT NULL,
    code_snippet jsonb DEFAULT NULL,
    citations jsonb DEFAULT '[]'::jsonb,
    follow_up_questions jsonb DEFAULT '[]'::jsonb,
    educational_feedback jsonb DEFAULT NULL,
    provider text DEFAULT NULL,
    model text DEFAULT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. AI Learning Assessments Table (Knowledge Checks)
CREATE TABLE IF NOT EXISTS public.ai_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
    topic text NOT NULL,
    level text NOT NULL DEFAULT 'BEGINNER' CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    questions jsonb NOT NULL DEFAULT '[]'::jsonb,
    score integer DEFAULT NULL,
    total_questions integer NOT NULL DEFAULT 0,
    percentage numeric(5,2) DEFAULT NULL,
    passed boolean DEFAULT NULL,
    detailed_feedback jsonb DEFAULT NULL,
    completed_at timestamptz DEFAULT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable Row Level Security (RLS) on all M5 AI Tables
ALTER TABLE public.ai_learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assessments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Learners can only access their own AI sessions, messages, and assessments
DO $$ BEGIN
  DROP POLICY IF EXISTS "ai_sessions_select" ON public.ai_learning_sessions;
  DROP POLICY IF EXISTS "ai_sessions_insert" ON public.ai_learning_sessions;
  DROP POLICY IF EXISTS "ai_sessions_update" ON public.ai_learning_sessions;
  DROP POLICY IF EXISTS "ai_sessions_delete" ON public.ai_learning_sessions;

  DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_learning_messages;
  DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_learning_messages;

  DROP POLICY IF EXISTS "ai_assessments_select" ON public.ai_assessments;
  DROP POLICY IF EXISTS "ai_assessments_insert" ON public.ai_assessments;
  DROP POLICY IF EXISTS "ai_assessments_update" ON public.ai_assessments;
END $$;

-- 5.1 AI Sessions Policies
CREATE POLICY "ai_sessions_select" ON public.ai_learning_sessions
    FOR SELECT USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "ai_sessions_insert" ON public.ai_learning_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_sessions_update" ON public.ai_learning_sessions
    FOR UPDATE USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "ai_sessions_delete" ON public.ai_learning_sessions
    FOR DELETE USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- 5.2 AI Messages Policies
CREATE POLICY "ai_messages_select" ON public.ai_learning_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.ai_learning_sessions s
            WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.is_platform_admin(auth.uid()))
        )
    );

CREATE POLICY "ai_messages_insert" ON public.ai_learning_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_learning_sessions s
            WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.is_platform_admin(auth.uid()))
        )
    );

-- 5.3 AI Assessments Policies
CREATE POLICY "ai_assessments_select" ON public.ai_assessments
    FOR SELECT USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "ai_assessments_insert" ON public.ai_assessments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_assessments_update" ON public.ai_assessments
    FOR UPDATE USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- 6. Indexes for Performance & Scoped Lookups
CREATE INDEX IF NOT EXISTS idx_ai_learning_sessions_user ON public.ai_learning_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_learning_sessions_lesson ON public.ai_learning_sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_messages_session ON public.ai_learning_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_user ON public.ai_assessments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_lesson ON public.ai_assessments(lesson_id);
