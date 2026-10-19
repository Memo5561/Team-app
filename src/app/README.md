# src/app

App-Shell: Einstiegspunkt, Router, Provider, Layouts (Desktop-Sidebar / Mobile-Bottom-Nav ab Phase 5), Fehlerseiten. Verdrahtet Plattform und Module, enthält aber selbst keine Fachlogik.

Routen-Guards (`guards.ts`) sind react-router-Middleware: `requireGuest` (/login, /signup; /forgot-password und /auth/confirm sind neutral), `requireSession` (alles Geschützte, Redirect `/login?next=…`), `requireEmailLinkSession` (/reset-password). /reset-password hat zwei Modi: „Neues Passwort festlegen“ nach einem Recovery-Link und, direkt nach der ersten Bestätigung eines Kontos, den optionalen Schritt „Passwort festlegen“ mit „Überspringen“ (Navigation-State aus /auth/confirm, `password-setup-state.ts`; ändert nur Texte, der Guard bleibt derselbe, E-46). `ProtectedLayout` reagiert auf eine Abmeldung, während eine Seite offen ist. `next` nur über `getSafeRedirect()` (`src/lib/safe-redirect.ts`).
