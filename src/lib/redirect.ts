/**
 * Post-sign-in redirect guard. Only same-origin absolute paths are allowed: "/app" passes, while
 * "//evil.example", "/\evil.example" and anything containing a backslash fall back (browsers treat "\" as "/").
 */
export function safeNext(v: string | null, fallback: string): string {
  if (!v || !v.startsWith('/') || v.includes('\\')) return fallback;
  if (v.startsWith('//')) return fallback;
  return v;
}
