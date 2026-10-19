import type { User } from '@supabase/supabase-js';

/**
 * Detects whether a successful e-mail link verification (POST /verify) confirmed the account for
 * the first time, so the app can offer the optional "Passwort festlegen" step (E-46).
 *
 * Only server timestamps from the user object that /verify returns are compared, never the
 * device clock. Checked against Supabase Auth (GoTrue v2.197) source:
 * - `email_confirmed_at`: set by `User.Confirm()` when the link confirms the address (sign-up
 *   confirmation, or a magic link / recovery link of a still unconfirmed account). It never changes
 *   on later sign-ins.
 * - `last_sign_in_at`: set to "now" by `IssueRefreshToken()` in the same /verify request, after
 *   the user row was reloaded.
 * - `confirmation_sent_at` / `recovery_sent_at`: stamped when a confirmation mail resp. a magic link
 *   or recovery mail is sent (magic links reuse the recovery fields).
 *
 * A first confirmation therefore has both stamps of this request close together, and no e-mail link
 * was sent after it. A later magic-link sign-in fails the second check even within seconds of the
 * confirmation, because its link was necessarily sent after the account was confirmed.
 */

/** Both stamps come from the same request; the tolerance only absorbs server-side delays. */
export const SAME_REQUEST_TOLERANCE_MS = 60_000;

export type ConfirmationTimestamps = Pick<
  User,
  'email_confirmed_at' | 'last_sign_in_at' | 'confirmation_sent_at' | 'recovery_sent_at'
>;

/**
 * Milliseconds of a GoTrue timestamp (RFC 3339, often with microseconds). Fractions are cut to
 * milliseconds first: not every JavaScript engine parses more than three digits.
 */
function parseTimestamp(value: string | null | undefined): number | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  const parsed = Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function isFirstEmailConfirmation(user: ConfirmationTimestamps | null | undefined): boolean {
  if (user === null || user === undefined) return false;
  const confirmedAt = parseTimestamp(user.email_confirmed_at);
  const signedInAt = parseTimestamp(user.last_sign_in_at);
  if (confirmedAt === undefined || signedInAt === undefined) return false;
  if (Math.abs(signedInAt - confirmedAt) > SAME_REQUEST_TOLERANCE_MS) return false;
  return [user.confirmation_sent_at, user.recovery_sent_at].every((sentAt) => {
    const sent = parseTimestamp(sentAt);
    return sent === undefined || sent <= confirmedAt;
  });
}
