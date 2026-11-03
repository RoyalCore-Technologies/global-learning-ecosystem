-- ==============================================================================
-- LEARNOVA PLATFORM — LEARNING FOUNDATION (005)
-- Engine: PostgreSQL 15+ / Supabase
-- Milestone: M3 — Learning Foundation
-- Description: Course, module, and lesson write RLS policies, Stitch JSONB
--              metadata, automated progress calculation trigger, and
--              enrollment counters.
-- ==============================================================================

-- 1. Schema Enhancements on Learning Tables

-- 1.1 Courses: Aggregated Enrollment and Rating Fields
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS enrolled_count integer NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0);

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS rating numeric(3,2) NOT NULL DEFAULT 0.00 CHECK (rating >= 0.00 AND rating <= 5.00);

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS reviews_count integer NOT NULL DEFAULT 0 CHECK (reviews_count >= 0);

-- 1.2 Lessons: Google Stitch Rich Learning Metadata (Transcripts, Code Lab, Resources)
ALTER TABLE public.lessons
ADD COLUMN IF NOT EXISTS transcript jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.lessons
ADD COLUMN IF NOT EXISTS code_lab jsonb DEFAULT null;

ALTER TABLE public.lessons
ADD COLUMN IF NOT EXISTS resources jsonb DEFAULT '[]'::jsonb;

-- 2. Performance & Discovery Indexes

CREATE INDEX IF NOT EXISTS idx_courses_published_filter
ON public.courses(is_published, level, tier, enrolled_count DESC)
WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_lessons_navigation
ON public.lessons(module_id, order_index ASC);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_lookup
ON public.lesson_progress(enrollment_id, is_completed);

-- 3. Row Level Security Policies for Modules & Lessons Authoring

-- 3.1 Course Modules Authoring Policies (Instructor of Parent Course or Platform Admin)
DO $$ BEGIN
  DROP POLICY IF EXISTS "course_modules_insert" ON public.course_modules;
  DROP POLICY IF EXISTS "course_modules_update" ON public.course_modules;
  DROP POLICY IF EXISTS "course_modules_delete" ON public.course_modules;
END $$;

CREATE POLICY "course_modules_insert"
  ON public.course_modules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (c.instructor_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  );

CREATE POLICY "course_modules_update"
  ON public.course_modules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (c.instructor_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (c.instructor_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  );

CREATE POLICY "course_modules_delete"
  ON public.course_modules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (c.instructor_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  );

-- 3.2 Lessons Authoring Policies (Instructor of Parent Course or Platform Admin)
DO $$ BEGIN
  DROP POLICY IF EXISTS "lessons_insert" ON public.lessons;
  DROP POLICY IF EXISTS "lessons_update" ON public.lessons;
  DROP POLICY IF EXISTS "lessons_delete" ON public.lessons;
END $$;

CREATE POLICY "lessons_insert"
  ON public.lessons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = module_id
        AND (c.instructor_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  );

CREATE POLICY "lessons_update"
  ON public.lessons FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = module_id
        AND (c.instructor_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = module_id
        AND (c.instructor_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  );

CREATE POLICY "lessons_delete"
  ON public.lessons FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = module_id
        AND (c.instructor_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  );

-- 4. Automated Enrollment Progress Synchronization Function & Trigger

CREATE OR REPLACE FUNCTION public.sync_course_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment_id uuid;
  v_course_id uuid;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_progress numeric(5,2);
  v_completed_at timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_enrollment_id := OLD.enrollment_id;
  ELSE
    v_enrollment_id := NEW.enrollment_id;
  END IF;

  -- 1. Identify parent course
  SELECT course_id INTO v_course_id
  FROM public.course_enrollments
  WHERE id = v_enrollment_id;

  IF v_course_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 2. Count total lessons belonging to this course
  SELECT count(l.id)::integer INTO v_total_lessons
  FROM public.lessons l
  JOIN public.course_modules m ON m.id = l.module_id
  WHERE m.course_id = v_course_id;

  -- 3. Calculate progress percentage and completed_at
  IF v_total_lessons = 0 THEN
    v_progress := 0.00;
    v_completed_at := NULL;
  ELSE
    SELECT count(lp.id)::integer INTO v_completed_lessons
    FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    JOIN public.course_modules m ON m.id = l.module_id
    WHERE lp.enrollment_id = v_enrollment_id
      AND m.course_id = v_course_id
      AND lp.is_completed = true;

    v_progress := round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100.0, 2);

    IF v_completed_lessons >= v_total_lessons THEN
      v_completed_at := timezone('utc'::text, now());
    ELSE
      v_completed_at := NULL;
    END IF;
  END IF;

  -- 4. Update the enrollment progress record
  UPDATE public.course_enrollments
  SET progress_percentage = v_progress,
      completed_at = v_completed_at
  WHERE id = v_enrollment_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_sync_course_progress ON public.lesson_progress;
CREATE TRIGGER trigger_sync_course_progress
  AFTER INSERT OR UPDATE OF is_completed OR DELETE
  ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_course_progress();

-- 5. Automated Course Enrollment Counter Function & Trigger

CREATE OR REPLACE FUNCTION public.sync_course_enrollment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.courses
    SET enrolled_count = enrolled_count + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.course_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.courses
    SET enrolled_count = GREATEST(0, enrolled_count - 1),
        updated_at = timezone('utc'::text, now())
    WHERE id = OLD.course_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_sync_course_enrollment_count ON public.course_enrollments;
CREATE TRIGGER trigger_sync_course_enrollment_count
  AFTER INSERT OR DELETE
  ON public.course_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_course_enrollment_count();
