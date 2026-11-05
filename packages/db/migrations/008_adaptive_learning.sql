-- ==============================================================================
-- LEARNOVA PLATFORM — ADAPTIVE LEARNING & CONCEPT MASTERY (008)
-- Engine: PostgreSQL 15+ / Supabase
-- Milestone: M5.4 — Contextual Learning Companion & Adaptive Learning
-- Description: Learner concept mastery tracking, spaced-repetition schedules,
--              knowledge gaps, and evidence-based revision recommendations.
-- ==============================================================================

-- 1. Learner Concept Mastery Table (SM-2 Spaced-Repetition & Invariant Tracking)
CREATE TABLE IF NOT EXISTS public.learner_concept_mastery (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    concept_tag text NOT NULL,
    mastery_score numeric(4,2) NOT NULL DEFAULT 0.0 CHECK (mastery_score >= 0.0 AND mastery_score <= 1.0),
    attempts_count integer NOT NULL DEFAULT 0 CHECK (attempts_count >= 0),
    correct_count integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    last_evaluated_at timestamptz NOT NULL DEFAULT now(),
    next_review_due_at timestamptz NOT NULL DEFAULT now(),
    review_interval_days integer NOT NULL DEFAULT 1 CHECK (review_interval_days >= 1),
    ease_factor numeric(3,2) NOT NULL DEFAULT 2.50 CHECK (ease_factor >= 1.30),
    repetition_count integer NOT NULL DEFAULT 0 CHECK (repetition_count >= 0),
    status text NOT NULL DEFAULT 'LEARNING' CHECK (status IN ('LEARNING', 'REVIEWING', 'MASTERED', 'NEEDS_REVISION')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_concept UNIQUE(user_id, concept_tag)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.learner_concept_mastery ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (Zero-Trust Privacy: Learners only see their own mastery data)
DO $$ BEGIN
  DROP POLICY IF EXISTS "learner_mastery_select" ON public.learner_concept_mastery;
  DROP POLICY IF EXISTS "learner_mastery_insert" ON public.learner_concept_mastery;
  DROP POLICY IF EXISTS "learner_mastery_update" ON public.learner_concept_mastery;
  DROP POLICY IF EXISTS "learner_mastery_delete" ON public.learner_concept_mastery;
END $$;

CREATE POLICY "learner_mastery_select" ON public.learner_concept_mastery
    FOR SELECT USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "learner_mastery_insert" ON public.learner_concept_mastery
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "learner_mastery_update" ON public.learner_concept_mastery
    FOR UPDATE USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "learner_mastery_delete" ON public.learner_concept_mastery
    FOR DELETE USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- 4. High-Performance Discovery & Scheduler Indexes
CREATE INDEX IF NOT EXISTS idx_concept_mastery_user_status
    ON public.learner_concept_mastery(user_id, status);

CREATE INDEX IF NOT EXISTS idx_concept_mastery_due_reviews
    ON public.learner_concept_mastery(user_id, next_review_due_at ASC);

CREATE INDEX IF NOT EXISTS idx_concept_mastery_course
    ON public.learner_concept_mastery(course_id, concept_tag);
