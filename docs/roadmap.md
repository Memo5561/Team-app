# TeamPanel – Implementierungsplan V1

> Status: **Freigegeben am 2026-10-19**, Phase 0 umgesetzt · Basis: §70/§71 der [Spezifikation](product/spezifikation.md), angepasst gemäß
> [E-26](architecture/entscheidungen-und-risiken.md#e-26--phasenreihenfolge-der-spec-hat-lücken).
>
> Jede Phase folgt dem Ablauf aus §90 (Analyse → Plan → Datenmodell/Permissions → Tests definieren → Implementieren →
> Tests → Security → UI/UX → Doku) und endet mit einem Checkpoint im Format aus §91.
> **Eine Phase beginnt erst, wenn die vorige abgenommen ist und die für sie markierten 🟥-Entscheidungen getroffen sind.**

## Phasenübersicht

| Phase | Inhalt | Abweichung zur Spec | Offene 🟥-Entscheidungen |
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
| 16 | Pilot | | E-17, E-29 (rechtlich) |

---

## Phase 0 – Repository-Fundament

**Status: umgesetzt, Abnahme ausstehend (CI-Lauf auf GitHub).** Ziel: ein leeres, aber produktionsreifes Gerüst,
damit jede spätere Phase sofort Migrationen, Tests und UI hinzufügen kann. **Keine Businesslogik.**

### 0.1 Toolchain
- Node ≥ 22.22 (`.nvmrc`), pnpm 10 (`packageManager`), Vite 8, React 19, TypeScript 6.0, alle Versionen exakt gepinnt.
  TypeScript 7 und ESLint 10 sind bewusst noch nicht im Einsatz: `typescript-eslint` unterstützt TypeScript nur bis
  6.0, `eslint-plugin-jsx-a11y` ESLint nur bis 9. Dependabot meldet, sobald das Upgrade möglich ist.
- `tsconfig.app.json` (Browser) / `tsconfig.node.json` (Configs, Skripte, Tests): `strict`, `noUncheckedIndexedAccess`,
  `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, Alias `@/`.
- ESLint 9 (Flat Config): `typescript-eslint` strict- + stylistic-type-checked, `react-hooks`, `react-refresh`,
  `jsx-a11y` (strict), `i18next/no-literal-string` (JSX-Text und sichtbare Attribute), Verbot von
  `dangerouslySetInnerHTML`/`innerHTML`/`eval`. Architekturgrenzen in `config/eslint-rules.js`:
  `modules/x` ↛ `modules/y`, `platform` ↛ `modules`/`app`, `components`/`lib` ↛ Domäne, keine `../`-Importe
  (immer `@/`). Die Regeln sind selbst getestet (`tests/lint/`).
- Prettier (+ Tailwind-Klassensortierung). Markdown ist ausgenommen, die Doku ist von Hand formatiert.

### 0.2 Frontend-Gerüst
- Tailwind CSS 4 + shadcn/ui (`components.json`, `Button` als Referenz; Standardhöhe 44 px für Touch, §45).
- Design Tokens in `src/styles/tokens.css` (semantische Farben, Radius, Systemschrift ohne externes Font-CDN).
  Dark-Mode-Werte vorbereitet, aber nicht aktiv.
- React Router 8 (`/` Platzhalter, `*` 404, Error-Element), TanStack Query (Polling-Defaults gemäß E-35), i18next mit
  typisierten Keys (`de.json`).
- **Env-Schema** (`src/lib/env-schema.ts`, Zod): `VITE_APP_ENV`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Supabase hat die „anon keys“ durch „publishable keys“ ersetzt, alte anon-JWTs
  werden weiter akzeptiert. Das Schema **lehnt Secret- und service_role-Keys ab** und verlangt `https` in Staging und
  Production. Es läuft beim Build (der Build schlägt fehl) und beim App-Start (Konfigurationsfehlerseite).
- `src/lib/supabase.ts` (nur Publishable Key, PKCE) und `src/lib/errors.ts` (SQLSTATE-/PostgREST-/`TP…`-Codes →
  i18n-Keys).
- Code-Splitting: `vendor-react` und `vendor` als langlebige Chunks.
- Sentry ist auf „vor Pilot“ verschoben, um in Phase 0 keine ungenutzte Abhängigkeit einzubauen.

### 0.3 Supabase
- `supabase/config.toml`: E-Mail-Bestätigung an, Mindestpasswortlänge 10, `secure_password_change`, lokale
  Redirect-URLs.
- Migration `20261019150258_baseline.sql`: `citext` und `btree_gist` im Schema `extensions`; Schema `private`
  (nicht exponiert); **Default Privileges**: neue Tabellen, Sequenzen und Funktionen in `public` gewähren
  `anon`/`authenticated` nichts, Funktionen sind für `PUBLIC` nicht ausführbar; `private.set_updated_at()`.
- `supabase/tests/database/000_guardrails.test.sql` (17 pgTAP-Assertions), die automatisch für **jede künftige**
  Migration gelten: RLS auf allen Tabellen, keine Policies für `anon`/`public`, keine `FOR ALL`-Policies, Views nur
  mit `security_invoker`, `anon` ohne Tabellen- und Funktionsrechte, `SECURITY DEFINER` nur mit `search_path`,
  Mandantentabellen mit `unique (organization_id, id)` und Select-Policy, Probe-Objekte prüfen die Default Privileges.
- `src/types/database.ts` mit postgres-meta v0.100.0 erzeugt (derselbe Generator, den die CLI 2.121 verwendet).
  CI prüft die Aktualität.
- `pnpm db:test:local`: Ersatz-Testlauf ohne Docker (Wegwerf-PostgreSQL + Supabase-Shim) für Umgebungen, in denen
  die Supabase-Images nicht geladen werden können. Maßgeblich bleibt CI.

### 0.4 Tests
- Vitest + React Testing Library: Routing (Home, 404, Navigation), Konfigurationsfehlerseite, Env-Schema
  (u. a. Ablehnung von Secret-Keys), Fehler-Mapping, Security-Header, ESLint-Architekturregeln: 36 Tests.
- Playwright: Smoke-Tests auf **Desktop und Mobile** (Pixel 7), inkl. Prüfung der Touch-Zielgröße ≥ 44 px.
- pgTAP: Guardrails (siehe 0.3).

### 0.5 CI und Automatisierung
`.github/workflows/ci.yml` läuft bei jedem Push:

| Job | Schritte |
|---|---|
| `quality` | `format:check` → `lint` → `typecheck` → `test` |
| `database` | `supabase start` (ohne nicht benötigte Dienste) → `supabase test db` → Typ-Drift-Check |
| `e2e` | Playwright (Desktop + Mobile), Report als Artefakt bei Fehlern |
| `security` | gitleaks (gesamte Git-Historie), `pnpm audit --prod --audit-level high` (**blockierend**), Bundle-Scan auf Secret-/service_role-Keys |

`deploy-database.yml` läuft nur manuell: DB-Tests erneut ausführen → `db push --dry-run` → `db push`, Production nur
mit Freigabe. Dazu kommen `dependabot.yml` (npm gruppiert, GitHub Actions) und eine PR-Vorlage mit
Definition-of-Done-Checkliste (§75).

### 0.6 Hosting
- Security-Header werden beim Build als `dist/_headers` erzeugt (`config/security-headers.ts`), mit der CSP-Quelle der
  jeweiligen Supabase-URL. Eine `_redirects`-Datei ist nicht nötig (Cloudflare Pages SPA-Modus).
- Schritt-für-Schritt-Anleitung für die manuellen Schritte: [Umgebungen](architecture/umgebungen.md).
- **Offen:** Die Erweiterung des SessionStart-Hooks (`.claude/hooks/session-start.sh`) um `pnpm install` und die
  pgTAP-Installation wurde aus Sicherheitsgründen nicht automatisch vorgenommen. Der Product Owner übernimmt sie
  selbst (Vorschlag im Phase-0-Bericht).

### Abnahmekriterien Phase 0
- [x] `pnpm check` lokal grün; `pnpm e2e` grün; DB-Guardrails grün (`pnpm db:test:local`).
- [ ] CI auf GitHub grün (alle 4 Jobs), inklusive `supabase test db` gegen das echte Supabase-Image.
- [x] Hartkodierter JSX-Text und Import `modules/alpha → modules/beta` lassen den Lint fehlschlagen (geprüft und
      entfernt; dauerhaft abgesichert durch `tests/lint/`).
- [x] Eine Migration mit Tabelle ohne RLS, `FOR ALL`-Policy, Definer-View und Definer-Funktion ohne `search_path`
      lässt die Guardrails fehlschlagen (7 von 17 rot), ebenso eine Baseline ohne Default-Privilege-Härtung
      (5 rot); eine regelkonforme Mandantentabelle besteht (geprüft und entfernt).
- [x] Fehlendes `VITE_SUPABASE_URL` → Build bricht mit `VITE_SUPABASE_URL is missing (see .env.example)` ab;
      zur Laufzeit erscheint die Konfigurationsfehlerseite.
- [x] Keine Secrets im Repo (gitleaks lokal über Arbeitsbaum und Historie grün).

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

**Umfang:** `leave_types` (Seed), `leave_requests`, View `absences_public`. Antrag (mobil), Stornieren, Genehmigen und
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
(Neubewertung von E-24), `pnpm audit`, Secret-Audit, Privacy Review (Datenflüsse, Löschkonzept, Aufbewahrung),
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
