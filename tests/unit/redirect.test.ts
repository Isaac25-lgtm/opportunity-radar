import { describe, expect, it } from 'vitest';
import { safeNext } from '../../src/lib/redirect';

describe('post-sign-in redirect guard (open-redirect defence)', () => {
  it('allows same-origin paths', () => {
    expect(safeNext('/app/cvs', '/app')).toBe('/app/cvs');
    expect(safeNext('/app/opportunities/opp_1?x=1', '/app')).toBe('/app/opportunities/opp_1?x=1');
  });
  it.each([
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    '',
    null,
    '/app\\..\\x',
  ])('falls back for %s', (v) => expect(safeNext(v as string | null, '/app')).toBe('/app'));
});
