import { describe, it, expect } from 'vitest';
import { sanitizeRedirectUrl } from './redirect';

describe('sanitizeRedirectUrl (Open Redirect Defense - CWE-601)', () => {
  describe('Valid Relative URLs', () => {
    it('allows valid root-relative paths', () => {
      expect(sanitizeRedirectUrl('/dashboard')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('/courses')).toBe('/courses');
      expect(sanitizeRedirectUrl('/creator/monographs/new')).toBe('/creator/monographs/new');
    });

    it('allows valid root-relative paths with search parameters and hashes', () => {
      expect(sanitizeRedirectUrl('/courses?track=systems&sort=karma#module-3')).toBe(
        '/courses?track=systems&sort=karma#module-3'
      );
      expect(sanitizeRedirectUrl('/auth/login?registered=true')).toBe('/auth/login?registered=true');
    });

    it('trims leading and trailing whitespace from legitimate paths', () => {
      expect(sanitizeRedirectUrl('  /dashboard  ')).toBe('/dashboard');
    });
  });

  describe('Invalid or Malicious URLs (Open Redirect Attacks)', () => {
    it('rejects external absolute HTTP/HTTPS URLs', () => {
      expect(sanitizeRedirectUrl('https://evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('http://phishing.site/login')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('https://evil.com/dashboard')).toBe('/dashboard');
    });

    it('rejects protocol-relative URLs (//evil.com)', () => {
      expect(sanitizeRedirectUrl('//evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('//evil.com/phish')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('///evil.com')).toBe('/dashboard');
    });

    it('rejects Windows backslash bypasses (/\\evil.com, \\evil.com)', () => {
      expect(sanitizeRedirectUrl('/\\evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('/\\\\evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('\\evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('/dashboard\\attacker.com')).toBe('/dashboard');
    });

    it('rejects dangerous pseudo-protocol schemes (javascript:, data:, vbscript:)', () => {
      expect(sanitizeRedirectUrl('javascript:alert(1)')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('vbscript:msgbox(1)')).toBe('/dashboard');
    });

    it('rejects CRLF and control characters', () => {
      expect(sanitizeRedirectUrl('/dashboard\r\nSet-Cookie:admin=1')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('/dashboard\nSet-Cookie:admin=1')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('/dashboard\t')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('/dashboard\0')).toBe('/dashboard');
    });

    it('handles empty, null, undefined or non-string inputs with default fallback', () => {
      expect(sanitizeRedirectUrl(null)).toBe('/dashboard');
      expect(sanitizeRedirectUrl(undefined)).toBe('/dashboard');
      expect(sanitizeRedirectUrl('')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('   ')).toBe('/dashboard');
    });

    it('respects a custom safe fallback destination when provided', () => {
      expect(sanitizeRedirectUrl('https://evil.com', '/explore')).toBe('/explore');
      expect(sanitizeRedirectUrl('//evil.com', '/courses')).toBe('/courses');
      expect(sanitizeRedirectUrl(null, '/auth/login')).toBe('/auth/login');
    });
  });
});
