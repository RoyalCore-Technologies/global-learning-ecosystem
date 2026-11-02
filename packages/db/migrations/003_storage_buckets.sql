-- ==============================================================================
-- LEARNOVA PLATFORM — STORAGE BUCKETS & POLICIES (003)
-- Engine: Supabase Storage (PostgreSQL storage.buckets and storage.objects)
-- ==============================================================================

-- 1. Create standard storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'content-media',
    'content-media',
    true,
    10485760, -- 10 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  ),
  (
    'course-materials',
    'course-materials',
    false, -- Private bucket: access requires signed URLs or active enrollment check
    52428800, -- 50 MB limit
    ARRAY['application/pdf', 'application/zip', 'text/plain', 'image/png', 'image/jpeg']
  ),
  (
    'project-artifacts',
    'project-artifacts',
    true,
    20971520, -- 20 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/zip']
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage Objects RLS Policies

-- ------------------------------------------------------------------------------
-- Avatars Bucket Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "avatars_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_user_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_user_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_user_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------------------------
-- Content Media Bucket Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "content_media_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-media');

CREATE POLICY "content_media_user_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'content-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "content_media_user_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'content-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------------------------
-- Course Materials Bucket Policies (Restricted)
-- ------------------------------------------------------------------------------
CREATE POLICY "course_materials_select_authorized"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND (
      -- Course instructor or platform admin
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_platform_admin(auth.uid())
      -- Or enrolled in the corresponding course
      OR EXISTS (
        SELECT 1 FROM public.courses c
        JOIN public.course_enrollments e ON e.course_id = c.id
        WHERE c.id::text = (storage.foldername(name))[2]
          AND e.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "course_materials_instructor_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-materials'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_platform_admin(auth.uid())
    )
  );
