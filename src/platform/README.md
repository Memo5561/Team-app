# src/platform

Plattform-Schicht (Spec Ebene A): auth, organizations, permissions, entitlements, modules (Registry-Runtime), notifications, audit, billing, files, onboarding. Darf `components`, `lib`, `i18n` und `types` importieren, aber **nie** `modules` oder `app` (per ESLint erzwungen). Erste Inhalte ab Phase 1.
