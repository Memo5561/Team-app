/**
 * HTTP security headers for the static frontend (Cloudflare Pages `_headers` file).
 *
 * The CSP is built per environment because `connect-src` must name the Supabase project
 * of that environment (see docs/security/rls-und-berechtigungen.md §8).
 */

function supabaseOrigins(supabaseUrl: string): { http: string; ws: string } {
  const url = new URL(supabaseUrl);
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return { http: url.origin, ws: `${wsProtocol}//${url.host}` };
}

export function buildContentSecurityPolicy(supabaseUrl: string): string {
  const supabase = supabaseOrigins(supabaseUrl);
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    // Radix UI positions popovers with inline style attributes.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', supabase.http],
    'font-src': ["'self'"],
    'connect-src': ["'self'", supabase.http, supabase.ws],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export function buildSecurityHeaders(supabaseUrl: string): Record<string, string> {
  return {
    'Content-Security-Policy': buildContentSecurityPolicy(supabaseUrl),
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

/** Renders a Cloudflare Pages `_headers` file. */
export function buildHeadersFile(supabaseUrl: string): string {
  const securityHeaders = Object.entries(buildSecurityHeaders(supabaseUrl))
    .map(([name, value]) => `  ${name}: ${value}`)
    .join('\n');
  return [
    '/*',
    securityHeaders,
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n');
}
