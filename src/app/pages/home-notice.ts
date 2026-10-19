/** One-time notices passed to the home page via navigation state. */
export type HomeNotice =
  'passwordSet' | 'passwordUpdated' | 'passwordUpdatedOthersPending' | 'weakPassword';

const HOME_NOTICES = new Set<string>([
  'passwordSet',
  'passwordUpdated',
  'passwordUpdatedOthersPending',
  'weakPassword',
] satisfies HomeNotice[]);

/** Reads a notice from untrusted history state (it survives reloads and can be anything). */
export function readHomeNotice(state: unknown): HomeNotice | null {
  if (typeof state !== 'object' || state === null || !('notice' in state)) return null;
  const { notice } = state;
  return typeof notice === 'string' && HOME_NOTICES.has(notice) ? (notice as HomeNotice) : null;
}
