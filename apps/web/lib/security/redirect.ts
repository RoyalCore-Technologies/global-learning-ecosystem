/**
 * Sanitizes redirect target URLs to prevent Open Redirect attacks (CWE-601).
 *
 * Enforces strict defense against external phishing redirects, protocol-relative URLs,
 * backslash tricks, control character injections, and malicious schemes.
 *
 * @param url The untrusted redirect target from search parameters or input
 * @param fallback The safe default destination (defaults to '/dashboard')
 * @returns A safe relative path on the current origin
 */
export function sanitizeRedirectUrl(
  url: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  const trimmed = url.trim();

  // Reject empty inputs
  if (!trimmed) {
    return fallback;
  }

  // Reject control characters, newlines, tabs, and null bytes (CWE-93 / CRLF / bypasses)
  if (/[\r\n\t\0]/.test(trimmed)) {
    return fallback;
  }

  // Must begin with a leading forward slash
  if (!trimmed.startsWith('/')) {
    return fallback;
  }

  // Reject protocol-relative URLs (e.g. //evil.com, ///evil.com)
  if (trimmed.startsWith('//')) {
    return fallback;
  }

  // Reject Windows backslash bypasses (e.g. /\evil.com, /\\evil.com, \evil.com)
  if (trimmed.startsWith('/\\') || trimmed.startsWith('/\\\\')) {
    return fallback;
  }

  // Verify against URL parser with internal dummy origin
  try {
    const parsed = new URL(trimmed, 'https://learnova.internal');
    // Ensure origin was not overridden
    if (parsed.origin !== 'https://learnova.internal') {
      return fallback;
    }
  } catch {
    return fallback;
  }

  // Reject embedded backslashes within the pathname
  const pathPart = trimmed.split('?')[0].split('#')[0];
  if (pathPart.includes('\\')) {
    return fallback;
  }

  return trimmed;
}
