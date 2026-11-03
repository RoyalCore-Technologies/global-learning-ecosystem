-- ==============================================================================
-- LEARNOVA PLATFORM — CREATOR & COMMUNITY FOUNDATION (006)
-- Engine: PostgreSQL 15+ / Supabase
-- Milestone: M4.2 — Database Foundation & Shared Types
-- Description: Automated member and subscriber count synchronization triggers,
--              private-community membership RLS hardening, community deletion policy,
--              and discovery performance indexes.
-- ==============================================================================

-- 1. Automated Community Member Count Synchronization Function & Trigger

CREATE OR REPLACE FUNCTION public.sync_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities
    SET member_count = member_count + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.community_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities
    SET member_count = GREATEST(0, member_count - 1),
        updated_at = timezone('utc'::text, now())
    WHERE id = OLD.community_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.sync_community_member_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_community_member_count() TO postgres;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.sync_community_member_count() TO authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.sync_community_member_count() TO service_role;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    GRANT EXECUTE ON FUNCTION public.sync_community_member_count() TO supabase_admin;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_sync_community_member_count ON public.community_members;
CREATE TRIGGER trigger_sync_community_member_count
  AFTER INSERT OR DELETE
  ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_community_member_count();

-- 2. Automated Creator Channel Subscriber Count Synchronization Function & Trigger

CREATE OR REPLACE FUNCTION public.sync_channel_subscriber_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.creator_channels
    SET subscriber_count = subscriber_count + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.channel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.creator_channels
    SET subscriber_count = GREATEST(0, subscriber_count - 1),
        updated_at = timezone('utc'::text, now())
    WHERE id = OLD.channel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.sync_channel_subscriber_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_channel_subscriber_count() TO postgres;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.sync_channel_subscriber_count() TO authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.sync_channel_subscriber_count() TO service_role;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    GRANT EXECUTE ON FUNCTION public.sync_channel_subscriber_count() TO supabase_admin;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_sync_channel_subscriber_count ON public.channel_subscribers;
CREATE TRIGGER trigger_sync_channel_subscriber_count
  AFTER INSERT OR DELETE
  ON public.channel_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_channel_subscriber_count();

-- 3. Row Level Security Hardening for Communities & Memberships

-- 3.1 Drop existing overly permissive join policy on community_members
DO $$ BEGIN
  DROP POLICY IF EXISTS "community_members_join" ON public.community_members;
  DROP POLICY IF EXISTS "communities_delete" ON public.communities;
  DROP POLICY IF EXISTS "community_members_manage_roles" ON public.community_members;
  DROP POLICY IF EXISTS "community_members_remove_by_lead" ON public.community_members;
END $$;

-- 3.2 Secure join policy: users may only directly join public communities,
-- or must be the creator of the community, or platform admin
CREATE POLICY "community_members_join"
  ON public.community_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.communities c
        WHERE c.id = community_id
          AND (c.is_private = false OR c.creator_id = auth.uid() OR public.is_platform_admin(auth.uid()))
      )
    )
  );

-- 3.3 Allow community creator or platform admin to delete the community
CREATE POLICY "communities_delete"
  ON public.communities FOR DELETE
  TO authenticated
  USING (
    auth.uid() = creator_id
    OR public.is_platform_admin(auth.uid())
  );

-- 3.4 Community leaders (LEAD, creator, admin) can update member roles
CREATE POLICY "community_members_manage_roles"
  ON public.community_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_id
        AND (c.creator_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = public.community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'LEAD'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_id
        AND (c.creator_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = public.community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'LEAD'
    )
  );

-- 3.5 Community leaders (LEAD, creator, admin) can remove members
CREATE POLICY "community_members_remove_by_lead"
  ON public.community_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_id
        AND (c.creator_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = public.community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'LEAD'
    )
  );

-- 4. Discovery & Association Performance Indexes

-- 4.1 Community posts feed index
CREATE INDEX IF NOT EXISTS idx_posts_community_created
  ON public.posts(community_id, created_at DESC)
  WHERE community_id IS NOT NULL;

-- 4.2 Channel posts feed index
CREATE INDEX IF NOT EXISTS idx_posts_channel_created
  ON public.posts(channel_id, created_at DESC)
  WHERE channel_id IS NOT NULL;

-- 4.3 Community discovery / explore index (filter by privacy, order by member count & recency)
CREATE INDEX IF NOT EXISTS idx_communities_discovery
  ON public.communities(is_private, member_count DESC, created_at DESC);

-- 4.4 Community member lookup by role
CREATE INDEX IF NOT EXISTS idx_community_members_role
  ON public.community_members(community_id, role);
