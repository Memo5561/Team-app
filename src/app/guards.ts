import { redirect, type MiddlewareFunction } from 'react-router';
import { getSafeRedirect } from '@/lib/safe-redirect';
import { getCurrentSession, isEmailLinkSession } from '@/platform/auth';

/**
 * Route middleware (react-router data mode). These checks are UX only: every request to Supabase
 * is authorized by RLS with the user's JWT, no matter what the router lets through.
 */

/** react-router redirects are thrown Responses, not Errors. */
function redirectTo(url: string): never {
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- documented react-router API
  throw redirect(url);
}

/** Protected routes: without a session, go to /login and come back afterwards. */
export const requireSession: MiddlewareFunction = async ({ url }) => {
  if ((await getCurrentSession()) !== null) return;
  const params = new URLSearchParams({ next: `${url.pathname}${url.search}` });
  redirectTo(`/login?${params.toString()}`);
};

/** Guest-only routes (login, sign-up): signed-in users continue to `next` or "/". */
export const requireGuest: MiddlewareFunction = async ({ url }) => {
  if ((await getCurrentSession()) === null) return;
  redirectTo(getSafeRedirect(url.searchParams.get('next'), url.origin) ?? '/');
};

/**
 * /reset-password: only sessions established via e-mail link may set a password without knowing
 * the current one (the server enforces the same rule). Everyone else goes home.
 */
export const requireEmailLinkSession: MiddlewareFunction = async () => {
  if (!(await isEmailLinkSession())) redirectTo('/');
};
