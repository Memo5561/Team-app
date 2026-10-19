# TeamPanel – Umgebungen einrichten (local, staging, production)

> Gehört zu Phase 0. Spezifikation §56/§57: getrennte Datenbanken, Keys, Stripe-Konten und Domains pro Umgebung,
> keine Tests auf Produktionsdaten, keine manuellen Produktionsänderungen.

## 1. Lokale Entwicklung

Voraussetzungen: Node ≥ 22.22.2 (`.nvmrc`), pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install
cp .env.example .env.local
pnpm db:start            # startet Supabase lokal (Docker), wendet Migrationen + seed.sql an
                         # → URL und Publishable Key in .env.local eintragen
pnpm dev                 # http://127.0.0.1:5173
```

| Befehl | Zweck |
|---|---|
| `pnpm check` | Format, Lint, Typecheck, Unit-Tests (vor jedem Commit) |
| `pnpm e2e` | Playwright auf Desktop und Mobile (baut die App selbst) |
| `pnpm db:test` | pgTAP-Tests gegen lokales Supabase (Docker) |
| `pnpm db:test:local` | dieselben pgTAP-Tests ohne Docker (siehe unten) |
| `pnpm db:reset` | lokale DB neu aufsetzen (Migrationen + Seed) |
| `pnpm db:types` | `src/types/database.ts` aus dem lokalen Schema neu generieren |
| `pnpm db:types:local` | dasselbe ohne Docker (Wegwerf-PostgreSQL, gleiche CLI-Version) |
| `pnpm exec supabase migration new <name>` | neue Migration anlegen |

**Ohne Docker** (z. B. Cloud-Sessions, in denen die Supabase-Images nicht geladen werden können):
`pnpm db:test:local` startet einen Wegwerf-PostgreSQL-Cluster, bildet die benötigten Supabase-Teile nach
(`scripts/local-db/supabase-shim.sql`: Rollen, `auth`-Schema, Default Privileges) und führt Migrationen und
pgTAP-Tests aus. Voraussetzung: lokales PostgreSQL mit pgTAP (`apt-get install postgresql-<major>-pgtap`; in
Cloud-Sessions ist es Version 16).
Das ist ein Ersatz für schnelles Feedback. **Maßgeblich ist CI** mit dem echten Supabase-Image.

## 2. Einmalige Einrichtung durch den Product Owner

Diese Schritte brauchen Konten, Zahlungsdaten und Geheimnisse. Deshalb führt sie ein Mensch aus und nicht Claude.

### 2.0 Default-Branch `main`

Bisher existiert nur der Arbeitsbranch dieser Session. Lege `main` aus dem abgenommenen Stand an (z. B. per Pull
Request) und setze ihn unter *Settings → General → Default branch* als Default-Branch. Deploy-Workflow, Cloudflare
Production und Branch-Schutz beziehen sich auf diesen Branch.

### 2.1 Supabase (zwei Projekte)

1. Auf supabase.com eine Organisation anlegen. Die EU-Datenregion wählen, z. B. **Frankfurt (eu-central-1)**.
2. Projekt `teampanel-staging` anlegen (Free-Plan genügt bis zum Pilot, E-27).
3. Projekt `teampanel-production` anlegen, **Pro-Plan** (tägliche Backups), gleiche Region.
4. In beiden Projekten unter *Authentication → Providers → Email*:
   - „Confirm email“ aktivieren
   - Mindestpasswortlänge 10
   - „Secure password change“ aktivieren
   - „Leaked password protection“ aktivieren (nur Production; im Free-Plan von Staging nicht verfügbar, E-40)
   - unter *URL Configuration* Site-URL und Redirect-URLs der jeweiligen Domain eintragen
5. Unter *Settings → API* prüfen, dass nur `public` und `graphql_public` exponiert sind (Default). Das Schema
   `private` darf **nie** exponiert werden. Die Einstellung „Default privileges for new entities“ (automatisches
   Freigeben neuer Tabellen) **ausschalten**, passend zu `auto_expose_new_tables = false` in `supabase/config.toml`.
   Die Baseline-Migration erzwingt dasselbe ohnehin, die Einstellung verhindert nur Abweichungen.
6. Notieren (nicht ins Repo!): Project Ref, Datenbank-Passwort, Publishable Key, Projekt-URL.
7. Den Auftragsverarbeitungsvertrag (DPA) von Supabase abschließen (E-17).

### 2.2 GitHub

1. *Settings → Environments*: drei Environments anlegen:
   - `staging`: Dry-Run und Apply gegen Staging
   - `production-plan`: nur Dry-Run gegen Production, **ohne** Reviewer
   - `production`: Apply gegen Production, mit „Required reviewers“ (du selbst)
2. Bei allen drei unter *Deployment branches* nur den Default-Branch (`main`) zulassen.
3. In jedem Environment drei Secrets anlegen (`production-plan` und `production` mit denselben Werten):
   - `SUPABASE_ACCESS_TOKEN`: persönlicher Token von supabase.com → *Account → Access Tokens*
   - `SUPABASE_DB_PASSWORD`: Datenbank-Passwort des jeweiligen Projekts
   - `SUPABASE_PROJECT_REF`: Project Ref des jeweiligen Projekts
4. Optional *Settings → Branches*: Branch-Schutz für `main` mit den CI-Jobs als Pflicht-Checks.

Migrationen werden **nur** über den manuellen Workflow *Actions → Deploy database* eingespielt, und nur vom
Default-Branch. Er führt die DB-Tests auf dem Commit erneut aus und zeigt die ausstehenden Migrationen
(`--dry-run`, in der Job-Zusammenfassung). Erst danach wendet er sie an; für Production wartet der Apply-Job auf deine
Freigabe, du siehst den Dry-Run also vorher. Ein pausiertes Free-Projekt (Staging) muss vorher im Dashboard
aufgeweckt werden.

### 2.3 Cloudflare Pages (Frontend)

1. *Workers & Pages → Create → Pages → Connect to Git*, Repository verbinden.
2. Build-Einstellungen:
   - Framework preset: *None*
   - Build command: `pnpm build && pnpm check:bundle`
   - Build output directory: `dist`
   - Environment variable `NODE_VERSION` = `22.22.2` oder neuer (Mindestversion laut `engines`)
3. Umgebungsvariablen:
   - *Production*: `VITE_APP_ENV=production`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` des Production-Projekts
   - *Preview*: dieselben Variablen mit `VITE_APP_ENV=staging` und den Werten des Staging-Projekts
4. Production-Branch auf `main` setzen; alle anderen Branches erzeugen Previews gegen Staging.
5. Eigene Domain für Production verbinden (z. B. `app.<domain>`). Previews laufen unter den `*.pages.dev`-Adressen
   von Cloudflare; diese Adressen in Staging-Supabase als Redirect-URLs eintragen.

Der Build schlägt absichtlich fehl, wenn eine Variable fehlt, die URL in Staging oder Production nicht `https` ist
oder versehentlich ein Secret- bzw. service_role-Key eingetragen wurde (`src/lib/env-schema.ts`). Die
Security-Header (CSP mit der Supabase-URL der jeweiligen Umgebung) erzeugt der Build als `dist/_headers`.
Eine `_redirects`-Datei ist nicht nötig: Ohne `404.html` behandelt Cloudflare Pages das Projekt als Single-Page-App.

### 2.4 Später (eigene Phasen)

| Dienst | Phase | Hinweis |
|---|---|---|
| Resend (E-Mail) | 4 | EU-Region, Domain verifizieren (SPF/DKIM), DPA |
| Sentry (Error Tracking) | vor Pilot | EU-Datenregion, PII-Scrubbing |
| Stripe | 12 | getrennte Test-/Live-Keys; Stripe Tax; Webhook-Secret nur in Supabase Edge Function Secrets |

## 3. Was wohin gehört

| Wert | Ort | Niemals |
|---|---|---|
| Publishable Key, Projekt-URL | Cloudflare-Env, `.env.local` | – (öffentlich by design) |
| Secret-/service_role-Key | nur Supabase Edge Function Secrets | Frontend, Repo, `VITE_*`-Variablen |
| DB-Passwort, Access Token | GitHub Environment Secrets | Repo, Logs |
| Stripe Secret / Webhook Secret | Supabase Edge Function Secrets | Frontend, Repo |
