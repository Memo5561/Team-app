/**
 * Validation of `?next=` redirect targets (open-redirect protection).
 *
 * Only same-origin relative paths are accepted. Everything a browser or the router might resolve to
 * another origin (`//evil.com`, `/\evil.com`, schemes, tab/newline tricks) is rejected, and so are
 * the guest-only auth pages and `/auth/*` to avoid redirect loops.
 */

// Paths that must never be a redirect target (compared case-insensitively, like the router matches).
const BLOCKED_PATHS = new Set(['/login', '/signup', '/forgot-password', '/auth']);
const BLOCKED_PREFIXES = ['/auth/'];

// C0 control characters and DEL. The URL parser silently drops tab/CR/LF ("/\t/evil.com" becomes
// "//evil.com"), so any of them disqualifies the value outright.
// eslint-disable-next-line no-control-regex -- matching control characters is the point here.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function decodePath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function isRejectedPath(pathname: string): boolean {
  const decoded = decodePath(pathname);
  if (decoded === null) return true;
  // Encoded variants of the tricks above ("/%2F%2Fevil.com", "/%5Cevil.com") are rejected as well,
  // in case anything along the way decodes the path once more.
  if (decoded.startsWith('//') || decoded.includes('\\') || CONTROL_CHARACTERS.test(decoded)) {
    return true;
  }
  const normalized = decoded.toLowerCase().replace(/\/+$/, '') || '/';
  if (BLOCKED_PATHS.has(normalized)) return true;
  return BLOCKED_PREFIXES.some((prefix) => `${normalized}/`.startsWith(prefix));
}

/**
 * Returns a safe in-app path (pathname + search + hash) for a raw `next` value, or null when the
 * value is missing or not acceptable.
 */
export function getSafeRedirect(
  raw: string | null | undefined,
  origin: string = window.location.origin,
): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (CONTROL_CHARACTERS.test(raw)) return null;
  // Exactly one leading slash: "//host" and "/\host" are protocol-relative URLs in browsers.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  // Backslashes are treated like slashes for http(s) URLs; there is no legitimate use in our paths.
  if (raw.includes('\\')) return null;

  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;
  if (isRejectedPath(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
