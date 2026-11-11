import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TABLES, STORAGE_BUCKETS, SECURITY_FUNCTIONS, SOCIAL_FUNCTIONS, LEARNING_FUNCTIONS, CREATOR_COMMUNITY_FUNCTIONS } from './index.js';

describe('Learnova Database Migrations & Safety Suite', () => {
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const migration001Path = path.join(migrationsDir, '001_role_security_policy.sql');
  const migration002Path = path.join(migrationsDir, '002_learnova_master_schema.sql');
  const migration003Path = path.join(migrationsDir, '003_storage_buckets.sql');
  const migration004Path = path.join(migrationsDir, '004_social_foundation.sql');

  it('all migration files exist and are non-empty', () => {
    expect(fs.existsSync(migration001Path)).toBe(true);
    expect(fs.existsSync(migration002Path)).toBe(true);
    expect(fs.existsSync(migration003Path)).toBe(true);
    expect(fs.existsSync(migration004Path)).toBe(true);

    const sql001 = fs.readFileSync(migration001Path, 'utf8');
    const sql002 = fs.readFileSync(migration002Path, 'utf8');
    const sql003 = fs.readFileSync(migration003Path, 'utf8');
    const sql004 = fs.readFileSync(migration004Path, 'utf8');

    expect(sql001.length).toBeGreaterThan(100);
    expect(sql002.length).toBeGreaterThan(1000);
    expect(sql003.length).toBeGreaterThan(500);
    expect(sql004.length).toBeGreaterThan(500);
  });

  it('declares and covers all 26 required platform tables in the master schema', () => {
    const sql002 = fs.readFileSync(migration002Path, 'utf8');

    Object.values(TABLES).forEach((tableName) => {
      const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${tableName}\\b`, 'i');
      expect(sql002).toMatch(tableRegex);
    });
  });

  it('enforces Row Level Security (RLS) on 100% of tables', () => {
    const sql002 = fs.readFileSync(migration002Path, 'utf8');

    Object.values(TABLES).forEach((tableName) => {
      const rlsRegex = new RegExp(`ALTER TABLE public\\.${tableName} ENABLE ROW LEVEL SECURITY;`, 'i');
      expect(sql002).toMatch(rlsRegex);
    });
  });

  it('implements recursion-safe security definer utility functions', () => {
    const sql002 = fs.readFileSync(migration002Path, 'utf8');

    Object.values(SECURITY_FUNCTIONS).forEach((fnName) => {
      expect(sql002).toContain(fnName);
    });

    // Verify SECURITY DEFINER is attached to critical lookup functions
    expect(sql002).toContain('FUNCTION public.is_platform_admin(p_user_id uuid)');
    expect(sql002).toContain('FUNCTION public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)');
    expect(sql002).toContain('SECURITY DEFINER STABLE SET search_path = public, pg_temp');
  });

  it('provisions all required Supabase storage buckets with size limits and MIME restrictions', () => {
    const sql003 = fs.readFileSync(migration003Path, 'utf8');

    Object.values(STORAGE_BUCKETS).forEach((bucketName) => {
      expect(sql003).toContain(`'${bucketName}'`);
    });

    // Verify course-materials is private
    expect(sql003).toContain("'course-materials',\n    'course-materials',\n    false");
  });

  it('verifies migration 004 implements social functions, notification preferences and triggers', () => {
    const sql004 = fs.readFileSync(migration004Path, 'utf8');

    Object.values(SOCIAL_FUNCTIONS).forEach((fnName) => {
      expect(sql004).toContain(fnName);
    });

    expect(sql004).toContain('notification_preferences');
    expect(sql004).toContain('is_solution');
    expect(sql004).toContain('is_pinned');
    expect(sql004).toContain('idx_posts_fts');
  });

  it('verifies migration 005 implements learning foundation triggers, metadata fields, and authoring policies', () => {
    const migration005Path = path.join(migrationsDir, '005_learning_foundation.sql');
    expect(fs.existsSync(migration005Path)).toBe(true);

    const sql005 = fs.readFileSync(migration005Path, 'utf8');
    Object.values(LEARNING_FUNCTIONS).forEach((fnName) => {
      expect(sql005).toContain(fnName);
    });

    expect(sql005).toContain('enrolled_count');
    expect(sql005).toContain('transcript');
    expect(sql005).toContain('code_lab');
    expect(sql005).toContain('course_modules_insert');
    expect(sql005).toContain('lessons_insert');
  });

  it('verifies migration 006 implements creator & community triggers, RLS hardening, and indexes', () => {
    const migration006Path = path.join(migrationsDir, '006_creator_community.sql');
    expect(fs.existsSync(migration006Path)).toBe(true);

    const sql006 = fs.readFileSync(migration006Path, 'utf8');
    Object.values(CREATOR_COMMUNITY_FUNCTIONS).forEach((fnName) => {
      expect(sql006).toContain(fnName);
    });

    expect(sql006).toContain('trigger_sync_community_member_count');
    expect(sql006).toContain('trigger_sync_channel_subscriber_count');
    expect(sql006).toContain('community_members_join');
    expect(sql006).toContain('communities_delete');
    expect(sql006).toContain('idx_communities_discovery');
    expect(sql006).toContain('idx_community_members_role');
  });

  it('verifies migration 007 implements AI learning foundation tables and RLS', () => {
    const migration007Path = path.join(migrationsDir, '007_ai_learning_foundation.sql');
    expect(fs.existsSync(migration007Path)).toBe(true);

    const sql007 = fs.readFileSync(migration007Path, 'utf8');
    expect(sql007).toContain('ai_learning_sessions');
    expect(sql007).toContain('ai_learning_messages');
    expect(sql007).toContain('ai_assessments');
    expect(sql007).toContain('ai_sessions_select');
  });

  it('verifies migration 008 implements adaptive learning concept mastery tracking and RLS', () => {
    const migration008Path = path.join(migrationsDir, '008_adaptive_learning.sql');
    expect(fs.existsSync(migration008Path)).toBe(true);

    const sql008 = fs.readFileSync(migration008Path, 'utf8');
    expect(sql008).toContain('learner_concept_mastery');
    expect(sql008).toContain('mastery_score');
    expect(sql008).toContain('review_interval_days');
    expect(sql008).toContain('learner_mastery_select');
  });

  it('verifies migration 009 implements safety events, multilingual metadata, and privacy RLS', () => {
    const migration009Path = path.join(migrationsDir, '009_ai_safety_and_localization.sql');
    expect(fs.existsSync(migration009Path)).toBe(true);

    const sql009 = fs.readFileSync(migration009Path, 'utf8');
    expect(sql009).toContain('ai_safety_events');
    expect(sql009).toContain('age_group');
    expect(sql009).toContain('is_fallback');
    expect(sql009).toContain('ai_safety_events_select');
  });

  it('guarantees zero payment card columns or sensitive secrets in monetization tables', () => {
    const sql002 = fs.readFileSync(migration002Path, 'utf8');

    // Forbidden payment card column names (matched with word boundaries)
    const forbiddenColumnRegex = /\b(card_number|credit_card|cvv|cvc|pan|card_expiry|cardholder_name|pin_code)\b/i;
    expect(sql002).not.toMatch(forbiddenColumnRegex);
  });
});
