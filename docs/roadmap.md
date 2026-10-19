# TeamPanel – Implementierungsplan V1

> Status: **Freigegeben am 2026-10-19**, Phase 0 abgeschlossen · Basis: §70/§71 der [Spezifikation](product/spezifikation.md), angepasst gemäß
> [E-26](architecture/entscheidungen-und-risiken.md#e-26--phasenreihenfolge-der-spec-hat-lücken).
>
> Jede Phase folgt dem Ablauf aus §90 (Analyse → Plan → Datenmodell/Permissions → Tests definieren → Implementieren →
> Tests → Security → UI/UX → Doku) und endet mit einem Checkpoint im Format aus §91.
> **Eine Phase beginnt erst, wenn die vorige abgenommen ist und die für sie markierten 🟥-Entscheidungen getroffen sind.**

## Phasenübersicht

| Phase | Inhalt | Abweichung zur Spec | Relevante 🟥-Entscheidungen (alle getroffen am 2026-10-19) |
|---|---|---|---|
| 0 | Repository-Fundament | + i18n, Design Tokens, Fehler-Mapping, DB-Baseline, Meta-Tests | – |
| 1 | Auth | | – |
| 2 | Organisationen + Mandanten-Fundament | + Audit-Infrastruktur, Entitlement-Lesen (Free-Plan), Onboarding Schritte 2–3 | E-37 |
| 3 | Rollen und Berechtigungen | Scopes, Eskalationsschutz | E-02, E-11 |
| 4 | Mitarbeiter, Teams, Standorte, Einladungen | + E-Mail-Outbox/Resend, Onboarding Schritte 5–6 | E-04, E-05 |
| 5 | Module und Navigation | + Onboarding Schritt 4, mobile Navigation | – |
| 6 | Notifications + Dashboard-Framework | Notifications vorgezogen; Widgets kommen je Modul | – |
| 7 | Zeiterfassung | | – |
| 8 | Dienstplan | | E-28 |
| 9 | Urlaub | | E-23 |
| 10 | Aufgaben und Checklisten | | – |
| 11 | Ankündigungen | | – |
| 12 | Billing (Stripe) | | E-14, E-15, E-16, E-31 |
| 13 | Reporting und CSV-Export | | – |
| 14 | PWA und Responsive-Audit | | – |
| 15 | Security Hardening | | – |
| 16 | Pilot | | E-17, E-29 (rechtliche Prüfung noch offen) |

---

## Phase 0 – Repository-Fundament

**Status: abgeschlossen (2026-10-19).** Alle Abnahmekriterien erfüllt, Staging läuft. Ziel: ein leeres, aber produktionsreifes Gerüst, damit jede spätere Phase sofort Migrationen, Tests
und UI hinzufügen kann. **Keine Businesslogik.**

### 0.1 Toolchain
- Node ≥ 22.22.2 (`.nvmrc`: 22, `engines`), pnpm 10 (`packageManager`), Vite 8, React 19, TypeScript 6.0. Alle
  npm-Abhängigkeiten sind exakt gepinnt; GitHub Actions laufen über Major-Tags und werden von Dependabot gepflegt.
  TypeScript 7 und ESLint 10 sind bewusst noch nicht im Einsatz: `typescript-eslint` unterstützt TypeScript nur bis
  6.0, `eslint-plugin-jsx-a11y` ESLint nur bis 9.
- `tsconfig.app.json` (Browser), `tsconfig.node.json` (Configs, Skripte, Unit-/Lint-Tests), `tsconfig.e2e.json`
  (Playwright, mit DOM-Typen): `strict`, `noUncheckedIndexedAccess`, `noUnused*`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`, Alias `@/`.
- ESLint 9 (Flat Config): `typescript-eslint` strict- + stylistic-type-checked, `react-hooks`, `react-refresh`,
  `jsx-a11y` (strict), Security-Regeln (`dangerouslySetInnerHTML`, `srcDoc`, `innerHTML`/`outerHTML`/`srcdoc`,
  `setAttribute('srcdoc'|'on…')`, `insertAdjacentHTML` u. a., `document.write`, `eval`) und eine
  Design-Token-Regel gegen Palette-Klassen (`bg-red-500`, `text-white` …) und Arbitrary-Farben (`bg-[#…]`).
- **Architekturregel `teampanel/layers`** (`config/eslint-plugin-teampanel.js`):
  - löst jeden Importpfad auf, auch `./../`, `@/x/../y`, `export … from`, dynamisches `import()` und
    `import.meta.glob` inkl. `base`-Option
  - prüft die Schichten app → modules → platform → components → lib; Feature-Module importieren sich nie gegenseitig
  - `src/test`-Helfer nur aus `*.test.*`-Dateien
  - unbekannte `src`-Ordner sind gesperrt (fail-closed)
  - `..` in Pfaden ist verboten (immer `@/`), dynamische Importe brauchen literale Pfade
  - funktioniert unabhängig vom Arbeitsverzeichnis
- **i18n-Regeln**: JSX-Text, Template-Literale und alle Props eigener Komponenten außer einer Liste technischer
  Props (Handler, Werte, IDs); neue Text-Props sind damit automatisch abgedeckt. Auf nativen HTML/SVG-Elementen
  werden die sichtbaren Attribute geprüft (`title`, `alt`, `placeholder`, `label`, `aria-label/-description/
  -roledescription/-valuetext/-placeholder`, Button-`value`).
- Die eigenen Regeln sind getestet (`tests/lint/`): isoliert und über die echte `eslint.config.js`.
- Prettier (+ Tailwind-Klassensortierung). Markdown ist ausgenommen, die Doku ist von Hand formatiert.

### 0.2 Frontend-Gerüst
- Tailwind CSS 4 + shadcn/ui (`components.json`, `Button` als Referenz; Standardhöhe 44 px für Touch, §45; sichtbarer
  Fokusring auch im Forced-Colors-Modus).
- **Design Tokens** in `src/styles/tokens.css` (inkl. `--overlay` für Dialog-Hintergründe). Die
  Tailwind-Standardpalette ist entfernt (`--color-*: initial`), und die Design-Token-Lint-Regel meldet Palette- und
  Arbitrary-Farben. Systemschrift ohne externes Font-CDN. Dark-Mode-Werte vorbereitet, aber
  nicht aktiv.
- React Router 8 (`/` Platzhalter, `*` 404, Error-Element); Seitentitel pro Seite, Fokus wandert nach Navigation auf
  die neue Überschrift. TanStack Query (staleTime 30 s + Refetch bei Fensterfokus; Polling pro Query über
  `POLL_INTERVAL_MS`, E-35). i18next mit typisierten Keys (`de.json`).
- **Env-Schema** (`src/lib/env-schema.ts`, Zod): `VITE_APP_ENV`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Supabase hat die „anon keys“ durch „publishable keys“ ersetzt. Das Schema ist eine
  **Allowlist**: Es nimmt nur `sb_publishable_…` oder ein JWT mit der Rolle `anon` an und meldet Secret- und
  service_role-Keys ausdrücklich. In Staging und Production ist `https` Pflicht. Geprüft wird beim Build (der Build
  bricht ab) und beim App-Start (Konfigurationsfehlerseite). Die App liest nur diese drei Variablen.
- `src/lib/supabase.ts` (nur Publishable Key, PKCE) und `src/lib/errors.ts`: SQLSTATE-, PostgREST- und `TP…`-Codes
  werden zu i18n-Keys. Netzwerkfehler werden erkannt in postgrest-, auth-, functions- und storage-js sowie in den
  Browser-Varianten (Chrome, Firefox, Safari) und offline.
- Code-Splitting: `vendor-react` und `vendor` (entries-aware) als langlebige Chunks.
- Dev-Server und Preview binden fest an `127.0.0.1`.
- Sentry ist auf „vor Pilot“ verschoben, um in Phase 0 keine ungenutzte Abhängigkeit einzubauen.

### 0.3 Supabase
- `supabase/config.toml`: E-Mail-Bestätigung an, Mindestpasswortlänge 10, `secure_password_change`,
  `auto_expose_new_tables = false`, lokale Redirect-URLs.
- Migration `20261019150258_baseline.sql`: `btree_gist` im Schema `extensions` (bewusst **kein `citext`**, E-38);
  Schema `private` (nicht exponiert). **Default Privileges**: Neue Tabellen, Sequenzen und Funktionen in `public`
  gewähren `anon`/`authenticated` nichts; `service_role` bekommt explizit Tabellen-, Sequenz- und
  Ausführungsrechte; Funktionen sind für `PUBLIC` nicht ausführbar. Dazu `private.set_updated_at()`.
- `supabase/tests/database/000_guardrails.test.sql` (22 pgTAP-Assertions, Rechte ACL-basiert inkl. PG17
  `MAINTAIN`), die automatisch für **jede künftige** Migration gelten:
  - RLS auf allen Tabellen; keine Policies für `anon`/`public`; keine `FOR ALL`-Policies
  - Views nur mit `security_invoker`
  - `anon` ohne Tabellen-, Spalten-, Sequenz- und Funktionsrechte; `authenticated` ohne
    `TRUNCATE`/`REFERENCES`/`TRIGGER`
  - `SECURITY DEFINER` nur mit `search_path = ''`
  - Mandantentabellen mit `unique (organization_id, id)` und Select-Policy
  - pgTAP auch als `authenticated` aufrufbar
  - Probe-Objekte prüfen die Default Privileges
- `src/types/database.ts` mit der gepinnten CLI 2.121 generiert (`pnpm db:types`, ohne Docker
  `pnpm db:types:local`). Die Ausgabe ist identisch mit der CI-Generierung. Ein CLI-Update erfordert neues
  Generieren.
- `pnpm db:test:local`: Ersatz-Testlauf ohne Docker. Der Wegwerf-PostgreSQL-Cluster bildet das Image nach:
  - `supabase_admin` als Superuser, `postgres` ohne Superuser-Rechte, aber mit vollen Rechten auf `auth.users`
  - realistisches `auth.users`/`auth.identities`, pgcrypto
  - CLI-Overlay für `auto_expose_new_tables = false`
  Dazu Plan-Prüfung, transaktionale Migrationen und Unix-Socket statt TCP. Maßgeblich bleibt CI.

### 0.4 Tests
- Vitest + React Testing Library (94 Tests):
  - Routing inkl. Fokus nach Navigation (auch unter StrictMode), Konfigurationsfehlerseite
  - Env-Schema (Allowlist, Secret-Keys), Fehler-Mapping (reale supabase-js-Fehlerformen)
  - Security-Header
  - Lint-Regeln: Architektur-Umgehungen, i18n (inkl. ausbleibender False Positives), Design Tokens, Security,
    echte Konfiguration (auch aus anderem Arbeitsverzeichnis)
- Playwright: Smoke-Tests auf **Desktop und Mobile** (Pixel 7). `vite preview` liefert dieselben Security-Header wie
  das Deployment, und die Tests schlagen bei **CSP-Verstößen**, Konsolenfehlern und Touch-Zielen unter 44 px fehl.
- pgTAP: Guardrails (siehe 0.3).

### 0.5 CI und Automatisierung
`.github/workflows/ci.yml` läuft bei jedem Push:

| Job | Schritte |
|---|---|
| `quality` | `format:check` → `lint` → `typecheck` → `test` |
| `database` | `supabase start` (nur benötigte Dienste) → `supabase test db` → Typ-Drift-Check |
| `e2e` | Playwright (Desktop + Mobile), Report als Artefakt bei Fehlern |
| `security` | gitleaks-CLI über die **gesamte** Git-Historie (`go install`, per Go-Checksum-DB verifiziert), `pnpm audit --prod --audit-level high` (blockierend), Build + Bundle-Scan auf Secrets |

`deploy-database.yml` läuft nur manuell, nur vom Default-Branch und nur für Commits mit grüner CI:
CI-Prüfung + DB-Tests → Dry-Run (Job-Summary, scheitert sichtbar) → Apply.
Production wird erst nach Freigabe angewendet, und der Freigebende sieht vorher den Dry-Run. Secrets stehen nur in den
Schritten, die sie brauchen. Dazu kommen `dependabot.yml` (npm gruppiert, `@types/node` nur mit Node-Major,
Actions gruppiert) und eine PR-Vorlage mit Definition-of-Done-Checkliste (§75).

### 0.6 Hosting
- Security-Header werden beim Build als `dist/_headers` erzeugt (`config/security-headers.ts`), mit der CSP-Quelle der
  jeweiligen Supabase-URL. Eine `_redirects`-Datei ist nicht nötig (Cloudflare Pages SPA-Modus).
- Schritt-für-Schritt-Anleitung für die manuellen Schritte: [Umgebungen](architecture/umgebungen.md).
- Der SessionStart-Hook (`.claude/hooks/session-start.sh`) installiert in Cloud-Sessions die Abhängigkeiten und
  pgTAP (vom Product Owner eingetragen).

### 0.7 Review
Zwei Review-Runden mit adversarialer Gegenprüfung über DB/Security, CI/CD, Frontend und Doku:
- **Runde 1:** 48 bestätigte Befunde, darunter 2 CI-Blocker (Host-Bindung `localhost` vs. `127.0.0.1`, Formatierung
  der generierten Typen).
- **Runde 2** (über die Fixes): 19 weitere Punkte, vor allem Lücken der neuen Lint-Regeln, Shim-Abweichungen und die
  Pipe-Exit-Codes im Deploy.

Alle Befunde mit Code-Bezug sind behoben. Bewusst verschoben ist nur das SHA-Pinning der Actions (Phase 15). Was
Konten des Product Owners braucht, ist unten als offen markiert.

### Abnahmekriterien Phase 0
- [x] `pnpm check` lokal grün; `pnpm e2e` grün; DB-Guardrails grün (`pnpm db:test:local`).
- [x] CI auf GitHub grün (alle 4 Jobs, Run #8), inklusive `supabase test db` gegen das echte Supabase-Image.
- [x] Hartkodierter JSX-Text und Import `modules/alpha → modules/beta` lassen den Lint fehlschlagen (dauerhaft
      abgesichert durch `tests/lint/`, inklusive Umgehungsversuchen).
- [x] Verstöße gegen die DB-Regeln lassen die Guardrails fehlschlagen: Tabelle ohne RLS, `FOR ALL`-Policy,
      Definer-View, `search_path`, Spalten-Grant an `anon`, Sequenz-Grant, `TRUNCATE` für `authenticated` und eine
      Baseline ohne Härtung. Regelkonforme Objekte bestehen.
- [x] Fehlendes `VITE_SUPABASE_URL` → Build bricht mit `VITE_SUPABASE_URL is missing (see .env.example)` ab;
      zur Laufzeit erscheint die Konfigurationsfehlerseite.
- [x] Keine Secrets im Repo (gitleaks über Arbeitsbaum und Historie, lokal und in CI).
- [x] **Staging eingerichtet** (§71): Supabase-Projekt `teampanel-staging`, Cloudflare Pages
      (`https://teampanel-8i0.pages.dev`, securityheaders.com A+), GitHub-Environment `staging`, Default-Branch
      `main` mit Schutz. *Deploy database → staging* erfolgreich (Run #2), Baseline in der Staging-DB verifiziert
      ([Umgebungen §3](architecture/umgebungen.md#3-aktueller-stand-2026-10-19)).

---

## Phase 1 – Auth

**Umfang:** Registrierung (Name, E-Mail, Passwort), Magic Link, E-Mail-Bestätigung, Login, Logout (lokal und
„überall“), Passwort vergessen/zurücksetzen, Session-Handling (Refresh, abgelaufene Session), Protected Routes,
Tabelle `profiles` (Trigger bei Sign-up).
**DB/Security:** `profiles` mit RLS (nur eigene Zeile). Auth-Rate-Limits konfiguriert. Keine Organisationen.
**Tests:** Unit (Formular-Schemas), Integration (Sign-up → Profil existiert; fremdes Profil nicht lesbar), E2E
(Registrieren über Mailpit-Link → Login → Logout).
**Abnahme:** Alle Auth-Flows mobil und auf dem Desktop bedienbar, mit Lade-, Fehler- und Leerzuständen; Fehlertexte
auf Deutsch, keine Rohfehler.

## Phase 2 – Organisationen und Mandanten-Fundament

**Umfang:** RPC `create_organization()` (legt Organisation, Systemrollen, Owner-Membership, Standard-Module und
Free-Abo-Spiegel atomar an). Organisationsauswahl und -wechsel (`/o/:orgSlug`). Onboarding-Schritte 2–3.
**Infrastruktur:** `audit_logs` + `private.write_audit()`. `plans`, `plan_entitlements`, `entitlement_definitions`,
`organization_entitlement_overrides`, `private.entitlement()`. Free-Plan-Seed. `feature_flags`. Helper
`my_org_ids()`, `my_membership_ids()`. Seed „Demo GmbH“ und „Fremd AG“.
**Security:** Isolationsmatrix für `organizations`, `memberships`, `roles`, `audit_logs`. Owner-Mindestanzahl per
Trigger.
**Abnahme (Spec):** *„User A kann niemals Daten von Organisation B lesen oder verändern“* ist für alle Tabellen
dieser Phase per pgTAP bewiesen (Lesen, Insert mit fremder `organization_id`, Update, Delete, Cross-Tenant-FK).

## Phase 3 – Rollen und Berechtigungen

**Umfang:** Permission-Katalog (Migration) und TS-Registry plus Contract-Test. `role_permissions`. Helper
`orgs_with_permission()`, `member_ids_in_scope()`. RPCs `set_role_permissions()`, `assign_role()`,
`transfer_ownership()`. Custom Roles (hinter Entitlement). UI: Rollenliste und Rechte-Editor (gruppiert nach Modul,
verständliche Texte statt Keys). Frontend-Guards `usePermission()` und `<Can>`.
**Security:** Alle Eskalationsregeln aus dem [Sicherheitsmodell §6](security/rls-und-berechtigungen.md#6-eskalations--und-aussperrschutz) als Negativtests.
**Abnahme:** Kein Feature-Modul beginnt, bevor die Scope-Matrix (self/team/all × Standort) in pgTAP grün ist (§71:
„Keine weitere große Funktion bauen, bevor RBAC funktioniert“).

## Phase 4 – Mitarbeiter, Teams, Standorte

**Umfang:** `locations`, `teams`, `team_members`, `membership_locations`, `employee_profiles`, `invitations`.
Mitarbeiterliste (Suche, Filter nach Status/Team/Standort, Pagination), Profil, Archivieren und Reaktivieren, Mitarbeiter
ohne Account (E-04). Einladung per E-Mail und Link, Annahme-Flow (neuer und bestehender Account). Onboarding-Schritte
5–6.
**Infrastruktur:** `private.email_outbox`, Edge Function `send-emails` (Resend) über pg_cron, E-Mail-Templates (DE).
**Limits:** `max_members` und `max_locations` per Trigger mit verständlicher Meldung.
**Tests:** Einladungs-Token (abgelaufen, widerrufen, falsche E-Mail, doppelt), Limit erreicht, Standort-Scope.
E2E-Flow 1 (Teil: Firma erstellen → Mitarbeiter einladen → Einladung annehmen).

## Phase 5 – Module und Navigation

**Umfang:** `modules`, `organization_modules`, Abhängigkeiten, `orgs_with_module()`. Frontend-Modul-Registry.
Dynamische Desktop-Sidebar (Abschnitte laut §46) und mobile Bottom-Navigation (§47). Einstellungsseite „Module“.
Onboarding-Schritt 4.
**Tests:** Deaktiviertes Modul → Route nicht erreichbar, RLS liefert nichts; reaktivieren → Daten wieder da (§12).

## Phase 6 – Notifications und Dashboard-Framework

**Umfang:** `notifications`, `notification_preferences`, Notification Center (Alle/Ungelesen, Pagination),
Badge-Zähler, Einstellungsseite. Dashboard-Framework: Widget-Registry, `dashboard_layouts`, Widgets aktivieren,
deaktivieren und sortieren (§11). Erste Widgets: „Schnellaktionen“, „Team-Übersicht“ (Anzahl Mitarbeiter).
Onboarding-Schritt 7 erzeugt das Standard-Layout aus den aktivierten Modulen.

## Phase 7 – Zeiterfassung

**Umfang:** `time_clock_state`, `clock_events`, `time_entries`, `time_adjustment_requests`. RPCs `clock()`,
`request_time_adjustment()`, `decide_time_adjustment()`. Mobile Stempelseite (großer Button, Live-Timer,
Pause, Ausstempeln). Tages- und Wochenansicht (eigene Zeiten, Team-Zeiten im Scope). Korrekturanfragen und
Genehmigung. `needs_review`-Job (E-22). Widgets „Anwesenheit heute“ und „Mitarbeiterstatus“.
**Tests (sehr ausführlich, §71):** Zustandsmaschine (jeder ungültige Übergang), parallele Requests (zwei
Verbindungen gleichzeitig), Idempotenz, Mitternacht, Sommerzeitwechsel, mehrere Pausen, Korrektur ersetzt Event und
rechnet neu, Selbstgenehmigung verboten, Append-only (UPDATE/DELETE schlägt fehl), gemeinsame Testfälle SQL/TS (E-21).
E2E-Flow 2.

## Phase 8 – Dienstplan

**Umfang:** `shifts`, `schedule_publications`, `availability`. Wochenansicht (Desktop-Raster, mobile Listenansicht),
Schicht anlegen, bearbeiten, kopieren und stornieren. Entwurf und „Veröffentlichen“ (Zeitraum + Standort) mit
Benachrichtigung und optionaler E-Mail. Mitarbeiteransicht „Meine Schichten“. Standortfilter. Verfügbarkeit
eintragen und dem Planer anzeigen. Widgets „Meine nächste Schicht“ und „Dienstplan heute“.
**Tests:** Über-Mitternacht, Sommerzeit, Doppelbelegung, Entwurf unsichtbar für Mitarbeiter, Teamleiter plant nur
eigenes Team. E2E-Flow 1 (Rest).

## Phase 9 – Urlaub und Abwesenheit

**Umfang:** `leave_types` (Seed), `leave_requests`, RPC `absences_in_scope` (Abwesenheiten ohne Typ für Kollegen). Antrag (mobil), Stornieren, Genehmigen und
Ablehnen mit Kommentar, Krankmeldung (E-23). Abwesenheiten im Dienstplan mit Konfliktmarkierung. Widget
„Urlaubsanträge“.
**Tests:** Überschneidung, halber Tag, sensible Typen für Kollegen nicht erkennbar, Genehmigung im Scope.
E2E-Flow 3.

## Phase 10 – Aufgaben und Checklisten

**Umfang:** `tasks`, `task_assignments`, `task_checklist_items`, `task_templates`, `task_template_items`;
`task_recurrences` + pg_cron (hinter Entitlement `recurring_tasks`). Listen „Meine“ und „Alle“, Filter, Fälligkeit,
Prioritäten, Status. Checklisten-Vorlagen. Widgets „offene Aufgaben“ und „Team-Aufgaben“.
**Tests:** Recurrence erzeugt genau eine nächste Instanz (auch bei Job-Wiederholung), Zuweisung nur an Mitglieder
derselben Organisation.

## Phase 11 – Ankündigungen

**Umfang:** `announcements`, `announcement_audiences`, `announcement_reads`. Erstellen mit Zielgruppe,
Lesebestätigung, „Gelesen x/y“, Benachrichtigung. Widget „Ankündigungen“.

## Phase 12 – Billing

**Umfang:** `plan_prices`, `subscriptions`, `private.stripe_events`. Edge Functions `create-checkout-session`,
`create-portal-session`, `stripe-webhook`. Abgeleiteter `access_state`, Grace Period und Restricted Mode,
Limit-Banner, Abo-Seite (nur Owner).
**Tests (§74):** Free-Limit, Upgrade, Downgrade über Limit, Zahlung fehlgeschlagen → Grace → Restricted, Kündigung,
Reaktivierung, doppelter Webhook, verspäteter Webhook (alte Events überschreiben nichts), falsche Signatur. E2E-Flow 4
mit Stripe-Testmodus.

## Phase 13 – Reporting und Export

**Umfang:** Arbeitszeit (Tag/Woche/Monat; pro Mitarbeiter/Team/Standort), Anwesenheit, Aufgaben, Urlaub. Aggregation
per SQL-Funktionen unter RLS (kein `SELECT *` in den Browser). CSV-Export als Edge Function bzw. RPC mit
Streaming, hinter `reports.export` + `export_enabled`. Owner-Export für deaktivierte Module (E-13).

## Phase 14 – PWA

**Umfang:** Web App Manifest, Icons, Service Worker (nur App-Shell-Caching, keine API-Daten), Installierbarkeit,
„Neue Version verfügbar“-Hinweis. Responsive-Audit aller Flows (360 px bis Desktop), Lighthouse, Accessibility-Audit
(axe in Playwright). Stempeln erfordert Online-Verbindung, mit klarer Offline-Meldung.

## Phase 15 – Security Hardening

**Umfang:** RLS-Audit (jede Policy gegen die Matrix), Permission-Audit, Rate-Limits, File-Security, Auth-Härtung
(Neubewertung von E-24), `pnpm audit`, GitHub Actions auf Commit-SHAs pinnen (Dependabot pflegt sie), Secret-Audit, Privacy Review (Datenflüsse, Löschkonzept, Aufbewahrung),
Restore-Test des Backups, Load-Test der RLS-Helper mit 100 Mitgliedern × 1 Jahr Daten.

## Phase 16 – Pilot

**Umfang:** 3–5 Pilotunternehmen aus unterschiedlichen Branchen (§87), Feature Flags, Feedback-Kanal, Kennzahlen
(aggregiert, E-33). Voraussetzungen: AVV/Datenschutzerklärung/AGB (E-17), arbeitsrechtliche Prüfung (E-29),
Production mit Backups und getestetem Restore.

---

## Querschnitt: Definition of Done (für jede Phase, §75)

UI · Mobile · Loading/Empty/Error-State · Berechtigungen (UI) · RLS (DB) · Validation (Zod + DB-Constraints) · Tests
(Unit/DB/E2E je nach Bereich) · Accessibility · Audit-Log falls administrativ · Doku aktualisiert · keine bekannten
kritischen Bugs · Checkpoint-Bericht (§91).
