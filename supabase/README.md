# supabase

- `migrations/`: einzige Quelle für Schemaänderungen (`pnpm exec supabase migration new <name>`). Nie manuell in Staging oder Production ändern.
- `tests/database/`: pgTAP-Tests. `000_guardrails.test.sql` prüft automatisch jede künftige Tabelle, Policy und Funktion (RLS an, keine anon-Rechte, keine `FOR ALL`-Policies, `security_invoker`-Views, gepinnter `search_path`, `unique (organization_id, id)`). `010_profiles.test.sql` prüft `public.profiles` und den Sign-up-Trigger (Struktur, Rechte, Normalisierung der Metadaten, RLS, Cascade). `020_auth_users_password_guard.test.sql` prüft den Trigger `on_auth_user_first_confirmation` (E-46): Ein Passwort von vor der ersten Bestätigung per Bestätigungs-E-Mail wird gelöscht; `admin.createUser` und Passwörter nach der Bestätigung bleiben.
- `tests/helpers/`: psql-Includes für Tests, keine Tests (siehe unten).
- `templates/`: deutsche Auth-E-Mails (siehe unten).
- `seed.sql`: Demo-Daten, nur lokal und in Staging.
- `functions/`: Edge Functions (ab Phase 4).

## Datenbanktests

- `pnpm db:test` = `supabase test db` (braucht Docker und `pnpm db:start`). Läuft auch in der CI und ist maßgeblich.
- `pnpm db:test:local`: ohne Docker gegen ein Wegwerf-PostgreSQL mit `scripts/local-db/supabase-shim.sql` (Rollen, `auth`-Schema, Default Privileges wie im Supabase-Image).
- Beide Runner finden Tests wie `pg_prove -r --ext .sql --ext .pg` unter `tests/`, in fester Reihenfolge (Dateiname). Jede Datei läuft in einer eigenen Transaktion (`begin;` … `rollback;`) mit exaktem `plan()`.

### Helfer `tests/helpers/auth.psql`

Einbinden direkt nach `begin;` (alles wird mit dem `rollback` der Testdatei verworfen):

```sql
begin;
create extension if not exists pgtap with schema extensions;
\ir ../helpers/auth.psql
select plan(n);
```

- `tests.create_user(email, meta, password_hash, confirmed)`: legt einen Nutzer in `auth.users` an wie GoTrue (E-Mail normalisiert, `meta` landet in `raw_user_meta_data`, auch `null` oder kein Objekt) und löst damit den Sign-up-Trigger aus. Läuft in der aktuellen Rolle, gibt die ID zurück. Optional: `password_hash` (Standard `''` = kein Passwort) und `confirmed` (Standard `true`). Unbestätigt sieht die Zeile aus wie bei `admin.createUser` vor der Bestätigung: Es ging keine Mail hinaus.
- `tests.create_user_as(rolle, email, meta)`: dasselbe als andere Rolle, z. B. `supabase_auth_admin` (so schreibt GoTrue). Gibt `null` zurück, wenn die Datenbank den Rollenwechsel nicht erlaubt; der Test überspringt den Fall dann mit `skip()`.
- `tests.sign_up(email, hash, meta)`: Selbstregistrierung wie GoTrue mit E-Mail-Bestätigung (`/signup`, bzw. `/otp` für eine neue Adresse): unbestätigter Nutzer mit diesem Passwort-Hash, danach setzt der Helfer `confirmation_token` und `confirmation_sent_at` wie GoTrues `sendConfirmation`.
- `tests.confirm_email(email)`: bestätigt die Adresse wie GoTrues `User.Confirm`, mit einem `UPDATE` von `confirmation_token` und `email_confirmed_at`.
- `tests.run_as(rolle, anweisung)`: führt eine SQL-Anweisung als andere Rolle aus und gibt `true` zurück, oder `null`, wenn die Datenbank den Rollenwechsel nicht erlaubt.
- `tests.user_id(email)`: ID eines Nutzers, aus jeder Rolle aufrufbar.
- `tests.as_user(email)`: handelt als dieser Nutzer (Rolle `authenticated` plus JWT-Claims `sub`, `role`, `aud`, `email`).
- `tests.as_anon()`: handelt als nicht angemeldeter Client (Rolle `anon`).
- `tests.reset_auth()`: zurück zu `postgres`, ohne Claims.

Die Endung `.psql` hält die Datei aus der Testsuche beider Runner heraus. `\ir` löst relativ zur Testdatei auf. `supabase test db` ohne Pfad bindet den ganzen Ordner `tests/` in den pg_prove-Container ein; mit einer einzelnen Datei als Argument nur deren Ordner, dann fehlt `tests/helpers/`. Einzelne Dateien deshalb über die ganze Suite (`pnpm db:test`) oder `pnpm db:test:local` prüfen.

## Auth-E-Mails (`templates/`)

Alle Links zeigen auf `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<typ>`:

- `confirmation.html` (Typ `email`): „Bestätige deine E-Mail-Adresse für TeamPanel“
- `magic_link.html` (Typ `email`): „Dein Anmeldelink für TeamPanel“
- `recovery.html` (Typ `recovery`): „Neues Passwort für TeamPanel festlegen“
- `email_change.html` (Typ `email_change`, Flow erst in einer späteren Phase): „Bestätige deine neue E-Mail-Adresse für TeamPanel“
- `reauthentication.html`: „Dein Bestätigungscode für TeamPanel“, zeigt den Code `{{ .Token }}` statt eines Links

- Verdrahtet in `config.toml` (`[auth.email.template.<name>]`, `content_path` relativ zum Projektordner). Lokal landen die Mails in Mailpit (`http://127.0.0.1:54324`).
- Kein `{{ .ConfirmationURL }}` und keine Redirect-URLs: `/auth/confirm` löst den Token erst nach einem Klick ein (Schutz vor Link-Scannern in Postfächern). Neue Konten entstehen immer per `signInWithOtp` (E-43/E-46) und bekommen `confirmation.html`; der Text erwähnt kein Passwort.
- Einfaches, barrierearmes HTML: `lang="de"`, ein Button plus der Link als Text, nur Inline-Styles, keine externen Bilder, Fonts oder Tracking. Farben sind Hex-Näherungen der Design Tokens (`src/styles/tokens.css`, z. B. `--primary` ≈ `#006390`), weil E-Mail-Clients weder CSS-Variablen noch `oklch` können.
- „1 Stunde gültig“ entspricht `otp_expiry = 3600`. Wer die Gültigkeit ändert, passt die Texte an.
- Formatieren: `pnpm exec prettier --write supabase/templates`.
- Gehostete Projekte (Staging, Production) lesen `config.toml` nicht: Betreff und HTML im Dashboard unter *Authentication → Emails* übernehmen. Dort bleibt der Mindestabstand zwischen zwei Mails bei 60 s (lokal 1 s, damit Tests mehrere Mails schnell hintereinander auslösen können).
