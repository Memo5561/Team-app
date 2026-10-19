import { describe, expect, it } from 'vitest';
import {
  isFirstEmailConfirmation,
  SAME_REQUEST_TOLERANCE_MS,
  type ConfirmationTimestamps,
} from '@/platform/auth/first-confirmation';

// Shapes as returned by POST /verify (GoTrue serializes timestamps with microseconds).
const SIGNED_UP = '2026-10-19T10:00:00.123456Z';
const CONFIRMED = '2026-10-19T10:05:00.500123Z';
const SAME_REQUEST = '2026-10-19T10:05:00.512987Z';

const firstConfirmation: ConfirmationTimestamps = {
  confirmation_sent_at: SIGNED_UP,
  email_confirmed_at: CONFIRMED,
  last_sign_in_at: SAME_REQUEST,
};

function shiftedBy(timestamp: string, milliseconds: number): string {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}

describe('isFirstEmailConfirmation', () => {
  it('detects the first confirmation through the sign-up mail', () => {
    expect(isFirstEmailConfirmation(firstConfirmation)).toBe(true);
  });

  it('accepts links mailed before the confirmation, e.g. a reset requested earlier', () => {
    expect(
      isFirstEmailConfirmation({ ...firstConfirmation, recovery_sent_at: '2026-10-19T10:01:00Z' }),
    ).toBe(true);
  });

  it('accepts other offset notations and server delays within the tolerance', () => {
    expect(
      isFirstEmailConfirmation({
        ...firstConfirmation,
        email_confirmed_at: '2026-10-19T12:05:00.500123+02:00',
        last_sign_in_at: shiftedBy(CONFIRMED, SAME_REQUEST_TOLERANCE_MS - 1),
      }),
    ).toBe(true);
  });

  it('rejects a later magic-link sign-in, even seconds after the confirmation', () => {
    const fewSecondsLater = shiftedBy(CONFIRMED, 3_000);
    expect(
      isFirstEmailConfirmation({
        ...firstConfirmation,
        recovery_sent_at: shiftedBy(CONFIRMED, 1_000),
        last_sign_in_at: fewSecondsLater,
      }),
    ).toBe(false);
  });

  it('rejects a sign-in long after the confirmation', () => {
    expect(
      isFirstEmailConfirmation({
        ...firstConfirmation,
        last_sign_in_at: shiftedBy(CONFIRMED, SAME_REQUEST_TOLERANCE_MS + 1),
      }),
    ).toBe(false);
  });

  it('rejects a confirmation mail sent after the confirmation', () => {
    expect(
      isFirstEmailConfirmation({
        ...firstConfirmation,
        confirmation_sent_at: shiftedBy(CONFIRMED, 1),
      }),
    ).toBe(false);
  });

  it.each([
    ['no user', null],
    ['an unconfirmed user', { ...firstConfirmation, email_confirmed_at: undefined }],
    ['no sign-in time', { ...firstConfirmation, last_sign_in_at: undefined }],
    ['unparsable timestamps', { ...firstConfirmation, email_confirmed_at: 'gestern' }],
    ['empty timestamps', { ...firstConfirmation, last_sign_in_at: '' }],
  ])('is false for %s', (_, user) => {
    expect(isFirstEmailConfirmation(user)).toBe(false);
  });
});
