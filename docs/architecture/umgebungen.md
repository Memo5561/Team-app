# TeamPanel – Umgebungen einrichten (local, staging, production)

> Gehört zu Phase 0. Spezifikation §56/§57: getrennte Datenbanken, Keys, Stripe-Konten und Domains pro Umgebung,
> keine Tests auf Produktionsdaten, keine manuellen Produktionsänderungen.

## 1. Lokale Entwicklung

Voraussetzungen: Node 22.22+ (`.nvmrc`), pnpm 10 (`corepack enable`), Docker.

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
| `pnpm exec supabase migration new <name>` | neue Migration anlegen |

**Ohne Docker** (z. B. Cloud-Sessions, in denen die Supabase-Images nicht geladen werden können):
`pnpm db:test:local` startet einen Wegwerf-PostgreSQL-Cluster, bildet die benötigten Supabase-Teile nach
(`scripts/local-db/supabase-shim.sql`: Rollen, `auth`-Schema, Default Privileges) und führt Migrationen und
pgTAP-Tests aus. Voraussetzung: lokales PostgreSQL mit pgTAP (`apt-get install postgresql-16-pgtap`).
Das ist ein Ersatz für schnelles Feedback. **Maßgeblich ist CI** mit dem echten Supabase-Image.

## 2. Einmalige Einrichtung durch den Product Owner

Diese Schritte brauchen Konten, Zahlungsdaten und Geheimnisse. Deshalb führt sie ein Mensch aus und nicht Claude.

### 2.1 Supabase (zwei Projekte)

1. Auf supabase.com eine Organisation anlegen. Die EU-Datenregion wählen, z. B. **Frankfurt (eu-central-1)**.
2. Projekt `teampanel-staging` anlegen (Free-Plan genügt bis zum Pilot, E-27).
3. Projekt `teampanel-production` anlegen, **Pro-Plan** (tägliche Backups), gleiche Region.
4. In beiden Projekten unter *Authentication → Providers → Email*:
   - „Confirm email“ aktivieren
   - Mindestpasswortlänge 10
   - „Leaked password protection“ aktivieren
   - unter *URL Configuration* Site-URL und Redirect-URLs der jeweiligen Domain eintragen
5. Unter *Settings → API* prüfen, dass nur `public` und `graphql_public` exponiert sind (Default). Das Schema
   `private` darf **nie** exponiert werden.
6. Notieren (nicht ins Repo!): Project Ref, Datenbank-Passwort, Publishable Key, Projekt-URL.
7. Den Auftragsverarbeitungsvertrag (DPA) von Supabase abschließen (E-17).

### 2.2 GitHub

1. *Settings → Environments*: `staging` und `production` anlegen.
2. Bei `production` unter *Deployment protection rules* „Required reviewers“ (du selbst) aktivieren.
3. In jedem Environment drei Secrets anlegen:
   - `SUPABASE_ACCESS_TOKEN`: persönlicher Token von supabase.com → *Account → Access Tokens*
   - `SUPABASE_DB_PASSWORD`: Datenbank-Passwort des jeweiligen Projekts
   - `SUPABASE_PROJECT_REF`: Project Ref des jeweiligen Projekts
4. Optional *Settings → Branches*: Branch-Schutz für `main` mit den CI-Jobs als Pflicht-Checks.

Migrationen werden **nur** über den manuellen Workflow *Actions → Deploy database* eingespielt. Er führt die
DB-Tests auf dem Commit erneut aus, zeigt die ausstehenden Migrationen (`--dry-run`) und wendet sie dann an.
Für Production braucht es zusätzlich deine Freigabe.

### 2.3 Cloudflare Pages (Frontend)

1. *Workers & Pages → Create → Pages → Connect to Git*, Repository verbinden.
2. Build-Einstellungen:
   - Framework preset: *None*
   - Build command: `pnpm build && pnpm check:bundle`
   - Build output directory: `dist`
   - Environment variable `NODE_VERSION` = `22`
3. Umgebungsvariablen:
   - *Production*: `VITE_APP_ENV=production`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` des Production-Projekts
   - *Preview*: dieselben Variablen mit `VITE_APP_ENV=staging` und den Werten des Staging-Projekts
4. Production-Branch auf `main` setzen; alle anderen Branches erzeugen Previews gegen Staging.
5. Eigene Domain verbinden (z. B. `app.<domain>` für Production, `staging.<domain>` für den Staging-Branch).

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
