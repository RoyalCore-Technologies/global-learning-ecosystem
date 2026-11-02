import { describe, it, expect } from 'vitest';
import { THEME_COLORS, ROLE_THEMES, MAIN_NAVIGATION } from '@platform/ui';
import { cn } from '../../lib/utils.js';

describe('Learnova Frontend Design System & Tokens', () => {
  it('defines comprehensive high-contrast dark theme colors', () => {
    expect(THEME_COLORS.background.base).toBe('#080c14');
    expect(THEME_COLORS.brand.indigo.main).toBe('#6366f1');
    expect(THEME_COLORS.brand.emerald.main).toBe('#10b981');
    expect(THEME_COLORS.brand.violet.main).toBe('#8b5cf6');
    expect(THEME_COLORS.text.primary).toBe('#f8fafc');
  });

  it('provides dedicated theme styling for all 6 platform roles', () => {
    const roles = ['STUDENT', 'BEGINNER', 'EDUCATOR', 'CREATOR', 'RESEARCHER', 'ADMIN'];
    for (const role of roles) {
      const theme = ROLE_THEMES[role];
      expect(theme).toBeDefined();
      expect(theme.label).toBeTruthy();
      expect(theme.badgeClass).toBeTruthy();
      expect(theme.textClass).toBeTruthy();
    }

    expect(ROLE_THEMES['STUDENT'].label).toBe('Student');
    expect(ROLE_THEMES['EDUCATOR'].badgeClass).toContain('text-emerald-300');
    expect(ROLE_THEMES['RESEARCHER'].badgeClass).toContain('text-cyan-300');
    expect(ROLE_THEMES['ADMIN'].badgeClass).toContain('text-rose-300');
  });

  it('structures primary navigation across all core learning & social ecosystems', () => {
    expect(MAIN_NAVIGATION.length).toBeGreaterThanOrEqual(6);
    const routes = MAIN_NAVIGATION.map((n) => n.href);
    expect(routes).toContain('/dashboard');
    expect(routes).toContain('/explore');
    expect(routes).toContain('/courses');
    expect(routes).toContain('/communities');
    expect(routes).toContain('/ai-assistant');
    expect(routes).toContain('/creator');

    // Ecosystem categorization
    const ecosystems = MAIN_NAVIGATION.map((n) => n.ecosystem);
    expect(ecosystems).toContain('LEARN');
    expect(ecosystems).toContain('SOCIAL');
    expect(ecosystems).toContain('AI');
    expect(ecosystems).toContain('COMMUNITY');
    expect(ecosystems).toContain('CREATOR');
  });

  it('utility cn function merges tailwind classes without conflict', () => {
    const result = cn('px-4 py-2 text-white', 'px-6', { 'bg-brand-indigo-600': true, 'bg-red-500': false });
    // tailwind-merge must resolve px-4 vs px-6 in favor of px-6
    expect(result).toContain('px-6');
    expect(result).not.toContain('px-4');
    expect(result).toContain('bg-brand-indigo-600');
    expect(result).not.toContain('bg-red-500');
  });

  it('computes deterministic avatar initials correctly', () => {
    const getInitials = (name: string) =>
      name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'L';

    expect(getInitials('Alex Rivera')).toBe('AR');
    expect(getInitials('Dr. Elena Rostova')).toBe('DE');
    expect(getInitials('Learner')).toBe('L');
    expect(getInitials('')).toBe('L');
  });
});
