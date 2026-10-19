import { describe, expect, it } from 'vitest';
import { getSafeRedirect } from '@/lib/safe-redirect';

const ORIGIN = 'https://app.teampanel.test';

describe('getSafeRedirect', () => {
  it.each([
    ['/', '/'],
    ['/reset-password', '/reset-password'],
    ['/o/demo/schedule?week=42#today', '/o/demo/schedule?week=42#today'],
    ['/a/./b/../c', '/a/c'],
    ['/login-help', '/login-help'],
    ['/authors', '/authors'],
  ])('accepts the same-origin path %j', (raw, expected) => {
    expect(getSafeRedirect(raw, ORIGIN)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [''],
    // Protocol-relative and backslash variants
    ['//evil.com'],
    ['///evil.com'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['/\\/evil.com'],
    ['/foo\\bar'],
    // Absolute URLs and scripts
    ['https://evil.com'],
    ['https://app.teampanel.test/'],
    ['http:evil.com'],
    ['javascript:alert(1)'],
    ['JaVaScRiPt:alert(1)'],
    ['data:text/html,x'],
    // Not starting with a slash
    ['evil.com'],
    ['%2F%2Fevil.com'],
    // Encoded tricks that turn into "//" or "\" once decoded
    ['/%2F%2Fevil.com'],
    ['/%2fevil.com'],
    ['/%5Cevil.com'],
    ['/%E0%A4%A'],
    // Tab, newline and other control characters (the URL parser would drop them)
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['/\r/evil.com'],
    ['\t//evil.com'],
    ['/%09/evil.com'],
    ['/foo\u0000'],
    // Auth pages: would loop or make no sense after signing in
    ['/login'],
    ['/login/'],
    ['/LOGIN'],
    ['/login?next=/'],
    ['/%6Cogin'],
    ['/signup'],
    ['/forgot-password'],
    ['/auth'],
    ['/auth/confirm'],
    ['/auth/confirm?token_hash=x&type=email'],
    ['/x/../login'],
  ])('rejects %j', (raw) => {
    expect(getSafeRedirect(raw, ORIGIN)).toBeNull();
  });

  it('uses the current origin by default', () => {
    expect(getSafeRedirect('/start')).toBe('/start');
    expect(getSafeRedirect(`${window.location.origin}/start`)).toBeNull();
  });
});
