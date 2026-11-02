# Learnova Database Migrations

Version-controlled SQL migrations for Supabase PostgreSQL.

## Migration History

1. **`001_role_security_policy.sql`**  
   Foundational role security trigger and function definition (`prevent_unauthorized_role_assignment()`). Guarantees zero-trust server-controlled role assignment.

2. **`002_learnova_master_schema.sql`**  
   Master database migration covering all 12 platform architectural modules:
   - Module 1: Identity & Access Control (`profiles`, `handle_new_user()` trigger)
   - Module 2: Social Graph (`follows`)
   - Module 3: Creator Channels & Publications (`creator_channels`, `channel_subscribers`)
   - Module 4: Communities (`communities`, `community_members`)
   - Module 5: Content Management (`posts`, `tags`, `post_tags`, `comments`)
   - Module 6: Feed & Bookmarks (`interactions`, `bookmarks`)
   - Module 7: Courses, Lessons & Learning Progress (`courses`, `course_modules`, `lessons`, `course_enrollments`, `lesson_progress`)
   - Module 8: Direct & Group Messaging (`conversations`, `conversation_participants`, `messages`)
   - Module 9: Notifications (`notifications`)
   - Module 10: Trust & Safety (`reports`)
   - Module 11: Monetization Foundations (`subscriptions`, `creator_payout_records`)
   - Module 12: Platform Operations & Audit Logs (`role_audit_logs`, `system_audit_logs`)
   - Recursion-safe RLS policies across all tables.

3. **`003_storage_buckets.sql`**  
   Supabase Storage bucket provisioning and RLS policies (`avatars`, `content-media`, `course-materials`, `project-artifacts`).

## Execution Protocol
Per platform guidelines:
- Migrations are tested locally and via unit/integration test suites before execution.
- Migrations are applied to Supabase Cloud only after formal review and approval by the founder and architecture partner.
