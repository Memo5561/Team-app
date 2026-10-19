import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, buildHeadersFile } from './security-headers';

describe('security headers', () => {
  it('allows only the configured Supabase project for API and websocket traffic', () => {
    const csp = buildContentSecurityPolicy('https://abcd.supabase.co');
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('uses ws:// for a local http Supabase', () => {
    expect(buildContentSecurityPolicy('http://127.0.0.1:54321')).toContain(
      'http://127.0.0.1:54321 ws://127.0.0.1:54321',
    );
  });

  it('renders a Cloudflare Pages _headers file', () => {
    const file = buildHeadersFile('https://abcd.supabase.co');
    expect(file.startsWith('/*\n  Content-Security-Policy: ')).toBe(true);
    expect(file).toContain('  X-Content-Type-Options: nosniff');
    expect(file).toContain('/assets/*\n  Cache-Control: public, max-age=31536000, immutable');
  });
});
