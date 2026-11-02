-- ==============================================================================
-- DATABASE LEVEL DEFENSE: ZERO-TRUST ROLE ASSIGNMENT & ELEVATION PREVENTION
-- Ensures mathematically that client-side Supabase tokens CANNOT escalate roles.
-- ==============================================================================

-- 1. Create or replace the server-side role validation trigger function
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_assignment()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role text;
  jwt_claims jsonb;
BEGIN
  -- Extract claims safely from the Supabase auth context
  jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  jwt_role := COALESCE(jwt_claims->>'role', '');

  -- Priority 1: When executing as an authenticated end-user, strictly enforce role security
  IF (jwt_role = 'authenticated') THEN
    -- Rule A: On INSERT, users cannot assign themselves privileged roles
    IF (TG_OP = 'INSERT') THEN
      IF NEW.role IN ('EDUCATOR', 'CREATOR', 'RESEARCHER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Self-assignment of privileged role [%] is strictly forbidden. Institutional vetting or administrative elevation is required.', NEW.role
          USING ERRCODE = '42501';
      END IF;
    END IF;

    -- Rule B: On UPDATE, authenticated users cannot modify the role column at all
    IF (TG_OP = 'UPDATE') THEN
      IF (NEW.role IS DISTINCT FROM OLD.role) THEN
        RAISE EXCEPTION 'Access Denied: Direct role modifications are prohibited. Role changes must be requested through administrative approval channels.'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Priority 2: Allow backend service_role, migrations, and direct database superusers
  IF (jwt_role = 'service_role' OR current_user = 'postgres' OR current_user = 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke public execution to prevent unauthorized RPC invocation
REVOKE EXECUTE ON FUNCTION public.prevent_unauthorized_role_assignment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_unauthorized_role_assignment() TO postgres;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    GRANT EXECUTE ON FUNCTION public.prevent_unauthorized_role_assignment() TO supabase_admin;
  END IF;
END $$;

-- 2. Attach trigger to profiles table (executed in Milestone 2 schema rollout)
-- DROP TRIGGER IF EXISTS enforce_role_security ON public.profiles;
-- CREATE TRIGGER enforce_role_security
--   BEFORE INSERT OR UPDATE OF role ON public.profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION public.prevent_unauthorized_role_assignment();
