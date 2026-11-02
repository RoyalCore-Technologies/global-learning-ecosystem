# Learnova Architectural Specification: Application Role Authority & Synchronization Boundaries

**Milestone:** M1 Authentication & Security Architecture  
**Document Classification:** Architectural Security Record  
**Status:** Canonical Reference

---

## 1. Executive Summary

This document formalizes the role authority model and synchronization boundary in Learnova. It clarifies the relationship between the authoritative PostgreSQL database schema (`public.profiles.role`), the Supabase GoTrue authentication engine (`auth.users.raw_app_meta_data`), and the NestJS API application layer (`jwt.strategy.ts`).

---

## 2. Authoritative Role Source

### Database Ground Truth: `public.profiles.role`
The authoritative source of a user's Learnova application role is the `role` column in `public.profiles` (`packages/db/migrations/002_learnova_master_schema.sql`).
- Supported roles: `STUDENT`, `EDUCATOR`, `CREATOR`, `RESEARCHER`, `ADMIN`, `MODERATOR`, `INSTITUTION_MEMBER`, `BEGINNER`.
- Governed by database trigger `prevent_unauthorized_role_assignment()` (`001_role_security_policy.sql`), which rejects self-assignment or modification of privileged roles by authenticated users.
- Protected by Row Level Security (RLS) policies requiring administrative privilege or service-role context for privilege modification.

### Supabase Auth Metadata: `auth.users.raw_app_meta_data`
Supabase Auth manages user identities in the private `auth.users` table.
- When GoTrue mints a JSON Web Token (JWT) during login or token refresh, it reads `auth.users.raw_app_meta_data` and places its key-value pairs into the token payload's `app_metadata` claim.
- End-users cannot modify `raw_app_meta_data`; updates require administrative API calls using the `service_role` secret or direct database superuser operations.

---

## 3. Current Synchronization Boundary & API Role Resolution

### Current API Behavior
In `apps/api/src/auth/jwt.strategy.ts`, the application role is resolved statelessly from the incoming JWT:
```typescript
const appRole = (payload.app_metadata?.role as UserRole) || UserRole.STUDENT;
```

### Reality of Current Implementation: No Automatic Synchronization
> [!IMPORTANT]
> **No database trigger currently synchronizes `public.profiles.role` to `auth.users.raw_app_meta_data`.**
> 
> When an administrative procedure (such as `bootstrap_administrator` in migration `002`) updates `public.profiles.role`:
> 1. The database record is successfully promoted to `ADMIN`.
> 2. `auth.users.raw_app_meta_data` is **NOT** automatically updated by the database.
> 3. Consequently, subsequent JWTs issued by GoTrue will not contain `app_metadata.role = 'ADMIN'`, causing `jwt.strategy.ts` to default the role to `STUDENT`.

---

## 4. Security Implications of Stale or Stateless JWT Role Claims

Because JWTs are cryptographically signed and stateless:
1. **Token Lifetime Window:** Once issued, a JWT remains valid until its `exp` timestamp (typically 1 hour). If an administrator revokes a user's permissions or demotes a role in `public.profiles.role`, an active JWT bearing the old `app_metadata.role` would still present elevated credentials unless checked against the database.
2. **Promotion Lag:** Promoting a user in the database without updating `auth.users.raw_app_meta_data` prevents the user from receiving elevated application privileges through the stateless JWT guard.
3. **Session Desynchronization:** If administrative tools update `auth.users.raw_app_meta_data`, the user's active client JWT will only reflect the new role after the client refreshes its session token with the Supabase Auth server.

---

## 5. Architectural Recommendations for Milestone 2 & Milestone 3

To guarantee real-time authorization integrity, sensitive operations must not rely exclusively on client-held JWT claims without fresh server-side verification:

### Recommendation A: Database Trigger Synchronization (Asynchronous Push)
In Milestone 2, implement a `SECURITY DEFINER` database trigger on `public.profiles`:
```sql
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS trigger AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) THEN
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(NEW.role::text)
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;
```
*Note: This trigger operates within PostgreSQL to keep `raw_app_meta_data` in lockstep with `profiles.role`.*

### Recommendation B: Dynamic Database Validation on Critical Endpoints (Zero-Trust Pull)
For critical administrative, financial, or content-moderation operations:
1. The NestJS API must not rely purely on the cached JWT claim `user.role`.
2. A dedicated `ProfileService` or `UserContextService` must execute a targeted database query verifying `public.profiles.role` and `verification_status` directly against the database or a high-speed Redis cache with a short TTL (e.g. 60 seconds).
3. Any discrepancy between the JWT claim and current database profile state must immediately reject the request and force token invalidation.
