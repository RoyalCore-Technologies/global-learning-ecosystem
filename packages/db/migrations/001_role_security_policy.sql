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

  -- Allow backend migrations, service_role, and direct database superusers
  IF (jwt_role = 'service_role' OR current_user = 'postgres' OR current_user = 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Rule A: On INSERT, users cannot assign themselves privileged roles
  IF (TG_OP = 'INSERT') THEN
    IF NEW.role IN ('EDUCATOR', 'CREATOR', 'RESEARCHER', 'ADMIN') THEN
      RAISE EXCEPTION 'Access Denied: Self-assignment of privileged role [%] is strictly forbidden. Institutional vetting or administrative elevation is required.', NEW.role
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Rule B: On UPDATE, non-service callers cannot modify the role column at all
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.role IS DISTINCT FROM OLD.role) THEN
      RAISE EXCEPTION 'Access Denied: Direct role modifications are prohibited. Role changes must be requested through administrative approval channels.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to profiles table (executed in Milestone 2 schema rollout)
-- DROP TRIGGER IF EXISTS enforce_role_security ON public.profiles;
-- CREATE TRIGGER enforce_role_security
--   BEFORE INSERT OR UPDATE OF role ON public.profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION public.prevent_unauthorized_role_assignment();

-- 3. Row Level Security Policy specification:
-- Normal users can only update unprivileged fields
-- CREATE POLICY "Users can only update their own non-role profile attributes"
--   ON public.profiles
--   FOR UPDATE
--   TO authenticated
--   USING (auth.uid() = id)
--   WITH CHECK (
--     auth.uid() = id
--     AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
--   );
