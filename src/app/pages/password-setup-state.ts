/**
 * Navigation state that opens /reset-password as the optional "Passwort festlegen" step right
 * after an account's first confirmation (E-46). It only changes texts and offers "Überspringen";
 * who may set a password is still decided by the route middleware (requireEmailLinkSession).
 */
export const PASSWORD_SETUP_STATE = { passwordSetup: true } as const;

/** Reads the marker from untrusted history state (it survives reloads and can be anything). */
export function isPasswordSetupState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'passwordSetup' in state &&
    state.passwordSetup === true
  );
}
