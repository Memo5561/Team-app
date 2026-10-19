# src/platform

Plattform-Schicht (Spec Ebene A): auth, organizations, permissions, entitlements, modules (Registry-Runtime), notifications, audit, billing, files, onboarding. Darf `components`, `lib`, `i18n` und `types` importieren, aber **nie** `modules` oder `app` (per ESLint erzwungen). Erste Inhalte ab Phase 1.

## auth (Phase 1)
`src/platform/auth`: einziger Zugriff auf `supabase.auth` (`api.ts`, inkl. Profil-Query), `AuthProvider` (ein Abo auf `onAuthStateChange`, synchroner Callback), Hooks (`useAuth`, `useProfile`), Formular-Schemas (`schemas.ts`, Meldungen als i18n-Keys) und Formular-Komponenten. Öffentliche API nur über `@/platform/auth` (`index.ts`). Neutrale Antworten (`user_already_exists`, `email_exists`, `otp_disabled`, `over_email_send_rate_limit`) sehen aus wie Erfolg (kein Account-Enumeration). Registrierung nur mit Name und E-Mail, immer per E-Mail-Link (`signInWithOtp`, `shouldCreateUser: true`); ein Passwort wird erst nach der ersten Bestätigung gesetzt (E-46). Ob ein Link das Konto zum ersten Mal bestätigt hat, erkennt `first-confirmation.ts` an Server-Zeitstempeln der /verify-Antwort, nie an der Geräteuhr.
