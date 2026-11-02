-- ==============================================================================
-- LEARNOVA PLATFORM — SOCIAL FOUNDATION (004)
-- Engine: PostgreSQL 15+ / Supabase
-- Milestone: M2 — Social Foundation
-- Description: Enums, notification preferences, counter triggers,
--              automated social notifications, and full-text search indexes.
-- ==============================================================================

-- 1. Extend Notification Types with Social Foundation Events
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'NEW_FOLLOWER';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ACCURACY_ENDORSEMENT';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Schema Enhancements on Core Social Tables

-- 2.1 Profiles: Notification Preferences
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL
DEFAULT '{
  "in_app": {
    "comments": true,
    "upvotes": true,
    "endorsements": true,
    "follows": true,
    "system": true
  },
  "email": {
    "weekly_digest": true,
    "major_announcements": true
  }
}'::jsonb;

-- 2.2 Comments: Accepted Solution Marker (for Educational Q&A Posts)
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS is_solution boolean NOT NULL DEFAULT false;

-- 2.3 Posts: Pinned Post Flag
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- 3. Full-Text Search & Performance Indexes

-- 3.1 GIN Full-Text Search on Posts (Title, Summary, Content)
CREATE INDEX IF NOT EXISTS idx_posts_fts ON public.posts
USING gin(to_tsvector('english', title || ' ' || coalesce(summary, '') || ' ' || content));

-- 3.2 Composite Indexes for Feed Discovery & Sorting
CREATE INDEX IF NOT EXISTS idx_posts_feed_recent
ON public.posts(status, published_at DESC)
WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_posts_feed_accuracy
ON public.posts(status, upvote_count DESC, published_at DESC)
WHERE status = 'PUBLISHED';

-- 3.3 Threaded Comments Index for Hierarchical Fetching
CREATE INDEX IF NOT EXISTS idx_comments_hierarchy
ON public.comments(post_id, parent_comment_id, created_at ASC);

-- 4. Automated Post Stats Synchronization (Comments & Upvotes)

CREATE OR REPLACE FUNCTION public.sync_post_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.posts
      SET comment_count = comment_count + 1,
          updated_at = timezone('utc'::text, now())
      WHERE id = NEW.post_id;
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.posts
      SET comment_count = GREATEST(0, comment_count - 1),
          updated_at = timezone('utc'::text, now())
      WHERE id = OLD.post_id;
      RETURN OLD;
    END IF;
  ELSIF TG_TABLE_NAME = 'interactions' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.type IN ('UPVOTE_INSIGHTFUL', 'ENDORSE_ACCURACY') THEN
        UPDATE public.posts
        SET upvote_count = upvote_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.post_id;
      END IF;
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.type IN ('UPVOTE_INSIGHTFUL', 'ENDORSE_ACCURACY') THEN
        UPDATE public.posts
        SET upvote_count = GREATEST(0, upvote_count - 1),
            updated_at = timezone('utc'::text, now())
        WHERE id = OLD.post_id;
      END IF;
      RETURN OLD;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.sync_post_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_post_stats() TO postgres;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.sync_post_stats() TO service_role;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.sync_post_stats() TO authenticated;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_comments_sync_stats ON public.comments;
CREATE TRIGGER trg_comments_sync_stats
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_stats();

DROP TRIGGER IF EXISTS trg_interactions_sync_stats ON public.interactions;
CREATE TRIGGER trg_interactions_sync_stats
  AFTER INSERT OR DELETE ON public.interactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_stats();

-- 5. Automated Social Notification Generator

CREATE OR REPLACE FUNCTION public.create_social_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_id uuid;
  v_actor_name text;
  v_post_title text;
  v_notif_type public.notification_type;
  v_title text;
  v_body text;
  v_resource_path text;
  v_prefs jsonb;
  v_allow_notif boolean := true;
BEGIN
  -- 5.1 New Comment Notification
  IF TG_TABLE_NAME = 'comments' AND TG_OP = 'INSERT' THEN
    -- Get actor display name
    SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.author_id;
    -- Get post title and author
    SELECT author_id, title INTO v_recipient_id, v_post_title FROM public.posts WHERE id = NEW.post_id;

    -- Avoid notifying self
    IF v_recipient_id IS NOT NULL AND v_recipient_id <> NEW.author_id THEN
      -- Check author preferences
      SELECT notification_preferences INTO v_prefs FROM public.profiles WHERE id = v_recipient_id;
      IF v_prefs IS NOT NULL AND (v_prefs->'in_app'->>'comments')::boolean IS FALSE THEN
        v_allow_notif := false;
      END IF;

      IF v_allow_notif THEN
        INSERT INTO public.notifications (
          recipient_id,
          actor_id,
          type,
          title,
          body,
          resource_path
        ) VALUES (
          v_recipient_id,
          NEW.author_id,
          'NEW_COMMENT',
          'New response to your knowledge post',
          COALESCE(v_actor_name, 'A scholar') || ' commented on "' || SUBSTRING(COALESCE(v_post_title, 'your post') FROM 1 FOR 60) || '"',
          '/posts/' || NEW.post_id
        );
      END IF;
    END IF;

    -- Also notify parent comment author if this is a nested reply
    IF NEW.parent_comment_id IS NOT NULL THEN
      SELECT author_id INTO v_recipient_id FROM public.comments WHERE id = NEW.parent_comment_id;
      IF v_recipient_id IS NOT NULL AND v_recipient_id <> NEW.author_id THEN
        v_allow_notif := true;
        SELECT notification_preferences INTO v_prefs FROM public.profiles WHERE id = v_recipient_id;
        IF v_prefs IS NOT NULL AND (v_prefs->'in_app'->>'comments')::boolean IS FALSE THEN
          v_allow_notif := false;
        END IF;

        IF v_allow_notif THEN
          INSERT INTO public.notifications (
            recipient_id,
            actor_id,
            type,
            title,
            body,
            resource_path
          ) VALUES (
            v_recipient_id,
            NEW.author_id,
            'NEW_COMMENT',
            'New reply to your comment',
            COALESCE(v_actor_name, 'A scholar') || ' replied to your comment on "' || SUBSTRING(COALESCE(v_post_title, 'a post') FROM 1 FOR 60) || '"',
            '/posts/' || NEW.post_id
          );
        END IF;
      END IF;
    END IF;

    RETURN NEW;

  -- 5.2 Social Interaction Notification (Upvote or Endorsement)
  ELSIF TG_TABLE_NAME = 'interactions' AND TG_OP = 'INSERT' THEN
    SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
    SELECT author_id, title INTO v_recipient_id, v_post_title FROM public.posts WHERE id = NEW.post_id;

    IF v_recipient_id IS NOT NULL AND v_recipient_id <> NEW.user_id THEN
      SELECT notification_preferences INTO v_prefs FROM public.profiles WHERE id = v_recipient_id;

      IF NEW.type = 'ENDORSE_ACCURACY' THEN
        v_notif_type := 'ACCURACY_ENDORSEMENT';
        v_title := 'Academic accuracy endorsement';
        v_body := COALESCE(v_actor_name, 'A verified peer') || ' endorsed the academic accuracy of "' || SUBSTRING(COALESCE(v_post_title, 'your post') FROM 1 FOR 60) || '"';
        IF v_prefs IS NOT NULL AND (v_prefs->'in_app'->>'endorsements')::boolean IS FALSE THEN
          v_allow_notif := false;
        END IF;
      ELSIF NEW.type = 'UPVOTE_INSIGHTFUL' THEN
        v_notif_type := 'POST_UPVOTE';
        v_title := 'Post marked insightful';
        v_body := COALESCE(v_actor_name, 'A scholar') || ' found your post insightful';
        IF v_prefs IS NOT NULL AND (v_prefs->'in_app'->>'upvotes')::boolean IS FALSE THEN
          v_allow_notif := false;
        END IF;
      ELSE
        -- Bookmarks do not send author notifications (privacy preserving)
        v_allow_notif := false;
      END IF;

      IF v_allow_notif THEN
        INSERT INTO public.notifications (
          recipient_id,
          actor_id,
          type,
          title,
          body,
          resource_path
        ) VALUES (
          v_recipient_id,
          NEW.user_id,
          v_notif_type,
          v_title,
          v_body,
          '/posts/' || NEW.post_id
        );
      END IF;
    END IF;

    RETURN NEW;

  -- 5.3 Follow Notification
  ELSIF TG_TABLE_NAME = 'follows' AND TG_OP = 'INSERT' THEN
    SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.follower_id;
    v_recipient_id := NEW.following_id;

    IF v_recipient_id IS NOT NULL AND v_recipient_id <> NEW.follower_id THEN
      SELECT notification_preferences INTO v_prefs FROM public.profiles WHERE id = v_recipient_id;
      IF v_prefs IS NOT NULL AND (v_prefs->'in_app'->>'follows')::boolean IS FALSE THEN
        v_allow_notif := false;
      END IF;

      IF v_allow_notif THEN
        INSERT INTO public.notifications (
          recipient_id,
          actor_id,
          type,
          title,
          body,
          resource_path
        ) VALUES (
          v_recipient_id,
          NEW.follower_id,
          'NEW_FOLLOWER',
          'New academic follower',
          COALESCE(v_actor_name, 'A scholar') || ' started following your academic publications and insights',
          '/profile/' || NEW.follower_id
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.create_social_notification() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_social_notification() TO postgres;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.create_social_notification() TO service_role;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.create_social_notification() TO authenticated;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_comments_notification ON public.comments;
CREATE TRIGGER trg_comments_notification
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.create_social_notification();

DROP TRIGGER IF EXISTS trg_interactions_notification ON public.interactions;
CREATE TRIGGER trg_interactions_notification
  AFTER INSERT ON public.interactions
  FOR EACH ROW EXECUTE FUNCTION public.create_social_notification();

DROP TRIGGER IF EXISTS trg_follows_notification ON public.follows;
CREATE TRIGGER trg_follows_notification
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.create_social_notification();
