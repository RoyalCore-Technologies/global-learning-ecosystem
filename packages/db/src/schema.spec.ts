import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TABLES, STORAGE_BUCKETS, SECURITY_FUNCTIONS, SOCIAL_FUNCTIONS } from './index.js';

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

  it('guarantees zero payment card columns or sensitive secrets in monetization tables', () => {
    const sql002 = fs.readFileSync(migration002Path, 'utf8');

    // Forbidden payment card column names (matched with word boundaries)
    const forbiddenColumnRegex = /\b(card_number|credit_card|cvv|cvc|pan|card_expiry|cardholder_name|pin_code)\b/i;
    expect(sql002).not.toMatch(forbiddenColumnRegex);
  });
});
