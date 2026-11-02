# Database Migrations

Version-controlled SQL migrations for Supabase PostgreSQL.

## Migration Structure (Planned for Milestone 2)
1. `001_initial_schema.sql` - Core tables: `profiles`, `posts`, `courses`, `communities`.
2. `002_rls_policies.sql` - Zero-trust Row Level Security policies.
3. `003_storage_buckets.sql` - Storage bucket definitions and access policies.
4. `004_role_security.sql` - Strict triggers preventing user self-assignment of privileged roles.
