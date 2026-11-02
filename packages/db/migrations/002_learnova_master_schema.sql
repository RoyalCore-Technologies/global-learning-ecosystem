-- ==============================================================================
-- LEARNOVA PLATFORM — MASTER DATABASE SCHEMA & MIGRATION (002)
-- Architecture: Unified Hybrid Architecture (UHA)
-- Database Engine: PostgreSQL 15+ (Supabase)
-- Security: Zero-Trust Row Level Security (RLS) & Server-Controlled Privileges
-- ==============================================================================

-- Enable extensions safely (gen_random_uuid is native in modern PostgreSQL 13+)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN null;
END $$;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN null;
END $$;

-- ==============================================================================
-- 1. ENUMERATED TYPES (DOMAIN CONTRACTS)
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'STUDENT',
    'BEGINNER',
    'EDUCATOR',
    'CREATOR',
    'RESEARCHER',
    'ADMIN'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM (
    'NONE',
    'PENDING',
    'VERIFIED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.post_type AS ENUM (
    'ARTICLE',
    'TUTORIAL',
    'QUESTION',
    'SNIPPET',
    'PROJECT_SHOWCASE'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.post_status AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED',
    'REMOVED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.interaction_type AS ENUM (
    'UPVOTE_INSIGHTFUL',
    'BOOKMARK',
    'ENDORSE_ACCURACY'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.community_role AS ENUM (
    'MEMBER',
    'MODERATOR',
    'LEAD'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.course_level AS ENUM (
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'ALL_LEVELS'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.content_tier AS ENUM (
    'FREE',
    'PREMIUM'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.conversation_type AS ENUM (
    'DIRECT',
    'GROUP'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'NEW_COMMENT',
    'POST_UPVOTE',
    'COURSE_MILESTONE',
    'SYSTEM_ALERT',
    'NEW_MESSAGE',
    'COMMUNITY_INVITE'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_target AS ENUM (
    'POST',
    'COMMENT',
    'USER',
    'COMMUNITY'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM (
    'PENDING',
    'INVESTIGATING',
    'RESOLVED',
    'DISMISSED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'ACTIVE',
    'PAST_DUE',
    'CANCELED',
    'INCOMPLETE'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_provider AS ENUM (
    'STRIPE',
    'LEMON_SQUEEZY',
    'RAZORPAY'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==============================================================================
-- 2. RECURSION-SAFE SECURITY DEFINER UTILITY FUNCTIONS (WITH FIXED search_path)
-- Avoids RLS query recursion loops by executing outside the active RLS context
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_community_member(p_community_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Timestamp update trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO postgres;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
  GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO supabase_admin;
END IF; END $$;

-- ==============================================================================
-- 3. IDENTITY AND ACCESS CONTROL (PROFILES)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name text NOT NULL CHECK (char_length(display_name) >= 1 AND char_length(display_name) <= 100),
  avatar_url text,
  headline text CHECK (char_length(headline) <= 160),
  bio text CHECK (char_length(bio) <= 2000),
  role public.user_role NOT NULL DEFAULT 'STUDENT',
  verification_status public.verification_status NOT NULL DEFAULT 'NONE',
  skills text[] DEFAULT '{}'::text[],
  github_url text,
  linkedin_url text,
  website_url text,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_verification ON public.profiles(verification_status);

-- Attach automated updated_at trigger
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attach role security trigger from 001_role_security_policy.sql
DROP TRIGGER IF EXISTS enforce_role_security ON public.profiles;
CREATE TRIGGER enforce_role_security
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_role_assignment();

-- Automatic profile creation upon user signup with strict unprivileged role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_assigned_role public.user_role;
  v_raw_role text;
  v_username text;
  v_display_name text;
BEGIN
  v_raw_role := NEW.raw_user_meta_data->>'role';
  
  -- Strict sanitization: only unprivileged onboarding roles can be chosen
  IF v_raw_role IN ('STUDENT', 'BEGINNER') THEN
    v_assigned_role := v_raw_role::public.user_role;
  ELSE
    v_assigned_role := 'STUDENT'::public.user_role;
  END IF;

  v_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    'user_' || substr(NEW.id::text, 1, 8)
  );

  v_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    'Learner'
  );

  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    role,
    avatar_url
  ) VALUES (
    NEW.id,
    v_username,
    v_display_name,
    v_assigned_role,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
  GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_admin;
END IF; END $$;

-- Attach signup trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 4. SOCIAL GRAPH (PEER FOLLOWS & MENTOR CONNECTIONS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id),
  CONSTRAINT uq_follows_follower_following UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- ==============================================================================
-- 5. CREATOR CHANNELS & PUBLICATIONS (WITH VERIFICATION SAFEGUARD)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.creator_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  description text CHECK (char_length(description) <= 1000),
  avatar_url text,
  banner_url text,
  is_verified boolean NOT NULL DEFAULT false,
  subscriber_count integer NOT NULL DEFAULT 0 CHECK (subscriber_count >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_creator_channels_owner ON public.creator_channels(owner_id);
CREATE INDEX IF NOT EXISTS idx_creator_channels_slug ON public.creator_channels(slug);

-- Safeguard against self-verification of creator channels
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_channel_verification()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF (TG_OP = 'INSERT' AND NEW.is_verified = true) OR (TG_OP = 'UPDATE' AND NEW.is_verified IS DISTINCT FROM OLD.is_verified) THEN
    IF (jwt_role <> 'service_role' AND NOT public.is_platform_admin(auth.uid())) THEN
      RAISE EXCEPTION 'Access Denied: Only platform administrators can verify creator channels.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.prevent_unauthorized_channel_verification() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_unauthorized_channel_verification() TO postgres;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
  GRANT EXECUTE ON FUNCTION public.prevent_unauthorized_channel_verification() TO supabase_admin;
END IF; END $$;

DROP TRIGGER IF EXISTS trg_channel_verification_security ON public.creator_channels;
CREATE TRIGGER trg_channel_verification_security
  BEFORE INSERT OR UPDATE OF is_verified ON public.creator_channels
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_channel_verification();

CREATE TABLE IF NOT EXISTS public.channel_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.creator_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscribed_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_channel_subscribers UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_subscribers_user ON public.channel_subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_subscribers_channel ON public.channel_subscribers(channel_id);

-- ==============================================================================
-- 6. COMMUNITIES (SUBJECT-ORIENTED CLUBS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 80),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  description text CHECK (char_length(description) <= 2000),
  avatar_url text,
  banner_url text,
  is_private boolean NOT NULL DEFAULT false,
  member_count integer NOT NULL DEFAULT 1 CHECK (member_count >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_communities_slug ON public.communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_creator ON public.communities(creator_id);

CREATE TABLE IF NOT EXISTS public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.community_role NOT NULL DEFAULT 'MEMBER',
  joined_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_community_members UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_user ON public.community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON public.community_members(community_id);

-- ==============================================================================
-- 7. CONTENT MANAGEMENT (POSTS, ARTICLES, TUTORIALS, TAGS, COMMENTS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES public.creator_channels(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 250),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  summary text CHECK (char_length(summary) <= 500),
  content text NOT NULL,
  type public.post_type NOT NULL DEFAULT 'ARTICLE',
  status public.post_status NOT NULL DEFAULT 'PUBLISHED',
  cover_image_url text,
  view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  upvote_count integer NOT NULL DEFAULT 0 CHECK (upvote_count >= 0),
  comment_count integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  published_at timestamptz DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_posts_author_created ON public.posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status_published ON public.posts(status, published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_posts_community ON public.posts(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_channel ON public.posts(channel_id);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts(slug);

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 50),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  description text CHECK (char_length(description) <= 300),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON public.tags(slug);

CREATE TABLE IF NOT EXISTS public.post_tags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON public.post_tags(tag_id);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 5000),
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_comment_id);

-- ==============================================================================
-- 8. FEED, BOOKMARKS & INSIGHTFUL INTERACTIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  type public.interaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_post_interaction UNIQUE (user_id, post_id, type)
);

CREATE INDEX IF NOT EXISTS idx_interactions_user ON public.interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_post ON public.interactions(post_id, type);

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  collection_name text NOT NULL DEFAULT 'Reading List',
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_post_bookmark UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_post ON public.bookmarks(post_id);

-- ==============================================================================
-- 9. COURSES, MODULES, LESSONS & PROGRESS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  summary text CHECK (char_length(summary) <= 500),
  description text NOT NULL,
  level public.course_level NOT NULL DEFAULT 'BEGINNER',
  tier public.content_tier NOT NULL DEFAULT 'FREE',
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  is_published boolean NOT NULL DEFAULT false,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_courses_instructor ON public.courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(is_published);

CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 150),
  order_index integer NOT NULL DEFAULT 1 CHECK (order_index >= 1),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_course_module_order UNIQUE (course_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_course_modules_course ON public.course_modules(course_id, order_index);

CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  order_index integer NOT NULL DEFAULT 1 CHECK (order_index >= 1),
  content text NOT NULL,
  video_url text,
  duration_minutes integer DEFAULT 0 CHECK (duration_minutes >= 0),
  is_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_lesson_module_order UNIQUE (module_id, order_index),
  CONSTRAINT uq_lesson_module_slug UNIQUE (module_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON public.lessons(module_id, order_index);

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamptz,
  progress_percentage numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  CONSTRAINT uq_user_course_enrollment UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON public.course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON public.course_enrollments(course_id);

CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  last_accessed_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_enrollment_lesson UNIQUE (enrollment_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_enrollment ON public.lesson_progress(enrollment_id);

-- ==============================================================================
-- 10. DIRECT & GROUP MESSAGING (MEMBERSHIP-ENFORCED)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.conversation_type NOT NULL DEFAULT 'DIRECT',
  title text CHECK (char_length(title) <= 100),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  last_read_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_conversation_participant UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON public.conversation_participants(conversation_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 10000),
  is_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- ==============================================================================
-- 11. NOTIFICATIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type public.notification_type NOT NULL,
  title text NOT NULL CHECK (char_length(title) <= 150),
  body text NOT NULL CHECK (char_length(body) <= 500),
  resource_path text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications(recipient_id, is_read, created_at DESC);

-- ==============================================================================
-- 12. TRUST, SAFETY & MODERATION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) >= 5 AND char_length(reason) <= 1000),
  status public.report_status NOT NULL DEFAULT 'PENDING',
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);

-- ==============================================================================
-- 13. MONETIZATION FOUNDATIONS (ZERO CARD DETAILS STORED)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider public.payment_provider NOT NULL DEFAULT 'STRIPE',
  provider_customer_id text NOT NULL,
  provider_subscription_id text UNIQUE NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'ACTIVE',
  tier text NOT NULL DEFAULT 'PRO_LEARNER',
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

CREATE TABLE IF NOT EXISTS public.creator_payout_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  provider_transfer_id text UNIQUE,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payout_records_creator ON public.creator_payout_records(creator_id, created_at DESC);

-- ==============================================================================
-- 14. PLATFORM AUDIT & OPERATIONS (TAMPER-PROOF IMMUTABLE LOGS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.role_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT or standalone UUID preserves forensic evidence even if user account is deleted
  target_user_id uuid NOT NULL,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_role public.user_role NOT NULL,
  new_role public.user_role NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_role_audit_target ON public.role_audit_logs(target_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_system_audit_action ON public.system_audit_logs(action, created_at DESC);

-- Immutability enforcement trigger: prevents unauthorized tampering, updates, or deletions of audit trails
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Access Denied: Audit log records are strictly immutable and cannot be updated or deleted.'
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_tampering() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_audit_log_tampering() TO postgres;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
  GRANT EXECUTE ON FUNCTION public.prevent_audit_log_tampering() TO supabase_admin;
END IF; END $$;

DROP TRIGGER IF EXISTS trg_immutable_role_audit ON public.role_audit_logs;
CREATE TRIGGER trg_immutable_role_audit
  BEFORE UPDATE OR DELETE ON public.role_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_tampering();

DROP TRIGGER IF EXISTS trg_immutable_system_audit ON public.system_audit_logs;
CREATE TRIGGER trg_immutable_system_audit
  BEFORE UPDATE OR DELETE ON public.system_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- ==============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES — RECURSION-SAFE ZERO-TRUST
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles Policies (Clean, Non-Recursive)
-- ------------------------------------------------------------------------------
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_owner_or_service"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

CREATE POLICY "profiles_update_owner"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Follows Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "follows_select"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "follows_insert"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete"
  ON public.follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- ------------------------------------------------------------------------------
-- Channels & Subscribers Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "channels_select"
  ON public.creator_channels FOR SELECT
  USING (true);

CREATE POLICY "channels_insert"
  ON public.creator_channels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "channels_update"
  ON public.creator_channels FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id OR public.is_platform_admin(auth.uid()))
  WITH CHECK (auth.uid() = owner_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "channels_delete"
  ON public.creator_channels FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "channel_subscribers_select"
  ON public.channel_subscribers FOR SELECT
  USING (true);

CREATE POLICY "channel_subscribers_manage"
  ON public.channel_subscribers FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Communities Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "communities_select"
  ON public.communities FOR SELECT
  USING (
    is_private = false
    OR auth.uid() = creator_id
    OR public.is_community_member(id, auth.uid())
  );

CREATE POLICY "communities_manage_creator"
  ON public.communities FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "communities_insert"
  ON public.communities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "community_members_select"
  ON public.community_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_community_member(community_id, auth.uid())
  );

CREATE POLICY "community_members_join"
  ON public.community_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_members_leave"
  ON public.community_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Content Management Policies (Posts, Comments, Tags)
-- ------------------------------------------------------------------------------
CREATE POLICY "posts_select"
  ON public.posts FOR SELECT
  USING (
    status = 'PUBLISHED'
    OR auth.uid() = author_id
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "posts_insert"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_update"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id OR public.is_platform_admin(auth.uid()))
  WITH CHECK (auth.uid() = author_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "posts_delete"
  ON public.posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "tags_select"
  ON public.tags FOR SELECT
  USING (true);

CREATE POLICY "post_tags_select"
  ON public.post_tags FOR SELECT
  USING (true);

CREATE POLICY "comments_select"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "comments_insert"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "comments_update"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id OR public.is_platform_admin(auth.uid()))
  WITH CHECK (auth.uid() = author_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "comments_delete"
  ON public.comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- Interactions & Bookmarks Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "interactions_select"
  ON public.interactions FOR SELECT
  USING (true);

CREATE POLICY "interactions_manage_own"
  ON public.interactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks_manage_own"
  ON public.bookmarks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Courses, Modules, Lessons & Progress Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "courses_select"
  ON public.courses FOR SELECT
  USING (
    is_published = true
    OR auth.uid() = instructor_id
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "courses_manage_instructor"
  ON public.courses FOR ALL
  TO authenticated
  USING (auth.uid() = instructor_id OR public.is_platform_admin(auth.uid()))
  WITH CHECK (auth.uid() = instructor_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "course_modules_select"
  ON public.course_modules FOR SELECT
  USING (true);

CREATE POLICY "lessons_select"
  ON public.lessons FOR SELECT
  USING (true);

CREATE POLICY "course_enrollments_select"
  ON public.course_enrollments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "course_enrollments_insert"
  ON public.course_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lesson_progress_manage"
  ON public.lesson_progress FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.id = enrollment_id AND e.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- Messaging Policies (Strict Conversation Membership Enforcement)
-- ------------------------------------------------------------------------------
CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "conversations_insert"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "conversation_participants_select"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "conversation_participants_insert"
  ON public.conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_conversation_member(conversation_id, auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
    )
  );

CREATE POLICY "messages_select"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "messages_insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

-- ------------------------------------------------------------------------------
-- Notifications Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "notifications_manage_recipient"
  ON public.notifications FOR ALL
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- ------------------------------------------------------------------------------
-- Reports Policies (Trust & Safety)
-- ------------------------------------------------------------------------------
CREATE POLICY "reports_insert"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reports_select_admin"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "reports_update_admin"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- Subscriptions & Payouts Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "payouts_select_creator"
  ON public.creator_payout_records FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id OR public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- Audit Logs Policies (Administrative & Service-Role Read-Only, Immutable)
-- ------------------------------------------------------------------------------
CREATE POLICY "role_audit_admin_select"
  ON public.role_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "system_audit_admin_select"
  ON public.system_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));
