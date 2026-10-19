# tests

- `e2e/`: Playwright, läuft auf Desktop und Mobile (Pixel 7) gegen den Produktions-Build (`pnpm e2e`).
- `integration/`: Vitest (Node) gegen das lokale Supabase: Auth, PostgREST und Datenbank zusammen (`pnpm test:integration`).
- `support/`: gemeinsame Helfer für beide, z. B. der Mailpit-Client.
- `lint/`: Tests der projekteigenen ESLint-Architekturregeln.

Unit-Tests liegen neben dem Code (`src/**/*.test.ts(x)`), DB-Tests in `supabase/tests/database/`.
`pnpm check` braucht weder Docker noch Supabase.

## Lokales Supabase

Integrations- und `@supabase`-E2E-Tests brauchen den lokalen Stack inkl. Mailpit:

```bash
pnpm db:start                      # Docker; wendet Migrationen und Seed an
pnpm supabase:env                  # prüft Auth und Mailpit, zeigt URLs (keine Schlüssel)
pnpm test:integration
pnpm supabase:env --write-e2e      # schreibt .env.e2e.local (gitignored) für den E2E-Build
pnpm e2e
```

- `scripts/supabase-env.mjs` liest URLs und Schlüssel aus `supabase status -o json`
  (`API_URL`, `PUBLISHABLE_KEY`, `SECRET_KEY`, `MAILPIT_URL`) und bricht mit klarer Meldung ab,
  wenn der Stack nicht läuft oder ein Wert fehlt.
- Der **Secret Key** wird nur von den Integrationstests (Admin-Client) im Speicher verwendet, nie in
  eine Datei oder eine `VITE_*`-Variable geschrieben. `.env.e2e.local` enthält nur den Publishable Key.
- Bestätigte Konten mit Passwort entstehen in den Integrationstests per `admin.createUser`
  (`email_confirm: true`), in den E2E-Tests (`registeredUser`) wie bei echten Nutzern: Registrierung per
  E-Mail-Link, Bestätigung, dann `updateUser({ password })` in dieser Sitzung. Ein Passwort, das vor der
  Bestätigung gesetzt wird (`signUp` mit Passwort), löscht die Datenbank bei der Bestätigung (E-46).
- Test-Adressen enden auf `.teampanel.internal` (reservierte TLD, nicht auf GoTrues Liste
  abgelehnter Test-Domains wie `.test` oder `example.com`). Mails landen nur im lokalen Mailpit
  (`http://127.0.0.1:54324`); jeder Test löscht dort nur seine eigenen Nachrichten.

## E2E-Tests

- `smoke.spec.ts` läuft immer, auch ohne Supabase: Weiterleitung auf die Anmeldung, 404-Seite,
  CSP-Verstöße, Fokus, Validierung im Browser, ungültige Links. Dazu lange E-Mail-Adressen und der Schritt
  „Passwort festlegen“ nach der ersten Bestätigung (mit „Überspringen“) bei 360 px (kein horizontales
  Scrollen, 44-px-Ziele); die dafür nötigen Auth-Antworten werden per `page.route` gemockt.
- Tests mit Tag `@supabase` (`auth-*.spec.ts`) laufen gegen den lokalen Stack: Registrierung per
  E-Mail-Link (Link auf einem zweiten Gerät geöffnet) mit „Passwort festlegen“ oder „Überspringen“,
  fremdes Passwort vor der Bestätigung (E-46), Magic Link, Passwort vergessen, verbrauchte/gefälschte
  Links, Weiterleitung mit `next`.
- `global-setup.ts` prüft Auth, Mailpit und ob der E2E-Build den echten Publishable Key nutzt.
  Lokal werden die `@supabase`-Tests sonst mit Begründung übersprungen; in CI (`CI=true`) schlägt
  der Lauf fehl.
- Mail-Links zeigen auf `site_url` (`:5173`); die Tests öffnen nur Pfad und Query auf dem
  Preview-Server (`:4173`).
- Nur die `@supabase`-Tests: `pnpm e2e --grep @supabase`; ohne sie: `pnpm e2e --grep-invert @supabase`.

## CI

- Job *Database*: Supabase ohne nicht benötigte Dienste (Mailpit bleibt an), pgTAP,
  Typ-Drift, `pnpm supabase:env`, `pnpm test:integration`. `password-guard.test.ts` (E-46) prüft dort
  gegen das echte GoTrue, was pgTAP nur nachspielt.
- Job *End-to-end*: Supabase startet im Hintergrund, während der Browser installiert wird;
  danach `pnpm supabase:env --write-e2e` und `pnpm e2e`. Die Ausgabe von `supabase start` erscheint
  nur bei Fehlern und dann mit maskierten Schlüsseln.
- Rate-Limit: Ein `@supabase`-Lauf löst rund 26 Link-Einlösungen (`/verify`) aus. Lokal erlaubt
  `token_verifications = 30` pro 5 Minuten und IP (`supabase/config.toml`); wer weitere Tests mit
  E-Mail-Links ergänzt, muss das im Blick behalten.
