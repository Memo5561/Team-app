# TeamPanel – Implementierungsplan V1

> Status: **Entwurf zur Freigabe** · Basis: §70/§71 der [Spezifikation](product/spezifikation.md), angepasst gemäß
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

## Phase 0 – Repository-Fundament (detailliert)

**Ziel:** Ein leeres, aber produktionsreifes Gerüst. Jede spätere Phase kann sofort Migrationen, Tests und UI
hinzufügen, ohne Infrastruktur nachzuziehen. **Keine Businesslogik.**

### 0.1 Toolchain
- Node 22 LTS (`.nvmrc`), **pnpm** (`packageManager`-Feld), Vite + React + TypeScript.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, Pfad-Alias `@/`.
- ESLint (Flat Config): `typescript-eslint` (strict-type-checked), `react-hooks`, `jsx-a11y`, `import`
  (Grenzen: `modules/*` ↛ `modules/*`, `components/ui` ↛ Domäne), `i18next/no-literal-string` für JSX, Verbot von
  `dangerouslySetInnerHTML`.
- Prettier inkl. `prettier-plugin-tailwindcss`. `.editorconfig`.
- Scripts: `dev`, `build`, `preview`, `lint`, `format`, `format:check`, `typecheck`, `test`, `test:watch`, `e2e`,
  `db:start`, `db:reset`, `db:test`, `db:types`, `check` (alles außer E2E).

### 0.2 Frontend-Gerüst
- Tailwind CSS + shadcn/ui (initialisiert, noch keine Komponenten außer `Button` als Referenz).
- `src/styles/tokens.css`: Design Tokens als CSS-Variablen (Farben, Radius, Abstände, Typografie), Light Theme;
  Dark-Mode-Variablen vorbereitet, nicht aktiv (§48).
- React Router mit Layout-Skelett (`/` → Platzhalterseite, `*` → 404). TanStack-Query-Provider. Error Boundary.
- i18next mit `src/i18n/de.json` und typisierten Keys (§66).
- `src/lib/env.ts`: Zod-Schema für `import.meta.env`, schlägt beim Start mit klarer Meldung fehl (§71
  „environment schema“).
- `src/lib/supabase.ts`: Client-Factory (nur Anon-Key).
- `src/lib/errors.ts`: Gerüst des Fehler-Mappings (Code → i18n-Key, Fallback „Etwas ist schiefgelaufen“).
- Ordnerstruktur gemäß [Architektur §14](architecture/architektur.md#14-frontend-architektur) mit `README.md` je
  Hauptordner (eine Zeile Zweck).

### 0.3 Supabase lokal
- `supabase init` → `supabase/config.toml` (Auth: E-Mail-Bestätigung an, Mindestpasswortlänge; Site-URL lokal).
- Migration `…_baseline.sql`:
  - Extensions `citext`, `btree_gist` (pgTAP nur in Tests).
  - Schema `private` (nicht exponiert), Funktion `private.set_updated_at()`.
  - Rechte-Härtung: Default Privileges so, dass `anon` auf künftige Tabellen und Funktionen in `public` nichts erhält.
    Funktionen standardmäßig nicht für `public` ausführbar.
- `supabase/tests/000_meta.test.sql` (pgTAP): RLS auf allen `public`-Tabellen; keine Policies für `anon`/`public`;
  `search_path` bei allen `SECURITY DEFINER`-Funktionen; `anon` ohne Tabellenrechte. Die Tests laufen schon jetzt
  (leer = grün) und schützen alle künftigen Migrationen.
- `supabase/seed.sql`: leer mit Kommentar (Demo GmbH ab Phase 2).
- Generierte Typen nach `src/types/database.ts`; CI prüft, dass sie aktuell sind.

### 0.4 Tests
- Vitest + React Testing Library + jsdom; ein Smoke-Test (App rendert, i18n-Text sichtbar).
- Playwright (Chromium) mit einem Smoke-Test gegen `vite preview`.
- Struktur: `src/**/*.test.ts(x)` (Unit), `tests/integration/` (gegen lokales Supabase, ab Phase 1), `tests/e2e/`,
  `supabase/tests/` (pgTAP).

### 0.5 CI (GitHub Actions)
`.github/workflows/ci.yml`, auf `pull_request` und Push nach `main`:

| Job | Schritte |
|---|---|
| `quality` | pnpm install (Cache) → `format:check` → `lint` → `typecheck` → `test` |
| `database` | Supabase CLI → `supabase start` (nur DB-Dienste) → `db reset` → `db test` → Typ-Drift-Check |
| `e2e` | `build` → Playwright Smoke |
| `security` | `gitleaks`, `pnpm audit --prod` (Warnung), Bundle-Scan auf `service_role`/`sk_` |

Dazu `dependabot.yml` (npm + GitHub Actions, wöchentlich) und eine PR-Vorlage mit der Definition-of-Done-Checkliste
(§75).

### 0.6 Hosting- und Umgebungsvorbereitung
- `public/_headers` (CSP und Security-Header, siehe [Sicherheitsmodell §8](security/rls-und-berechtigungen.md#8-auth-und-sessions)), `public/_redirects` (SPA-Fallback).
- `.env.example` (nur `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, `VITE_SENTRY_DSN` optional).
- `docs/architecture/umgebungen.md`: Anleitung für die **manuellen Schritte des Product Owners** (die Claude nicht
  ausführen kann/soll):
  1. Zwei Supabase-Projekte in der EU-Region anlegen (staging, production).
  2. Cloudflare-Pages-Projekt mit GitHub verbinden (Production = `main`, Preview = PRs).
  3. GitHub Environments `staging` und `production` mit Secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
     `SUPABASE_PROJECT_REF`).
  4. Deploy-Workflow für Migrationen (`supabase db push`) erst nach Freigabe aktivieren; production nur mit
     manueller Bestätigung (Environment Protection).
- Erweiterung des vorhandenen SessionStart-Hooks: `pnpm install`, damit Cloud-Sessions Lint und Tests ausführen
  können.

### 0.7 Projektregeln
- `CLAUDE.md` mit Befehlen, Arbeitsregeln (§89–§92) und Verweisen auf die Doku.
- `README.md` mit Setup in 5 Schritten.

### Abnahmekriterien Phase 0
- [ ] `pnpm check` lokal grün; `pnpm e2e` grün; `pnpm db:test` grün.
- [ ] CI auf GitHub grün (alle 4 Jobs).
- [ ] Ein absichtlich hartkodierter JSX-Text und ein Import `modules/a → modules/b` lassen den Lint fehlschlagen
      (geprüft und wieder entfernt).
- [ ] Eine Test-Migration mit einer Tabelle ohne RLS lässt `db:test` fehlschlagen (geprüft und wieder entfernt).
- [ ] Ein fehlendes `VITE_SUPABASE_URL` erzeugt eine verständliche Startfehlermeldung.
- [ ] Keine Secrets im Repo (`gitleaks` grün).

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
