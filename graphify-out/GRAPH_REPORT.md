# Graph Report - Team-app  (2026-10-19)

## Corpus Check
- 139 files · ~69,656 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .example 1, .css 1)

## Summary
- 1081 nodes · 2205 edges · 67 communities (48 shown, 19 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 185 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e1dc50a5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supabase-mock.ts
- Plattform-Infrastruktur und Betrieb
- Phase 4 - Mitarbeiter, Teams, Standorte
- Phase 8 - Dienstplan
- database.ts
- Querschnitt: UX, i18n, Fehler, Seed
- TeamPanel Implementierungsplan V1 (Roadmap)
- Platform Layer (Spec Level A)
- Dev-Abhängigkeiten (Lint/Test)
- Zeiterfassung und Billing-Zustand
- TS-Config Node
- TS-Config App
- package.json Metadaten
- TS-Config E2E
- pnpm-Skripte
- shadcn/ui-Konfiguration
- ESLint-Regelblöcke (i18n, Security, Tokens)
- Schichten-Architektur (teampanel/layers)
- Security-Header und CSP
- Laufzeit-Abhängigkeiten
- Architekturprinzipien und RPCs
- eslint
- Modulsystem und Registry
- Identität, Mitgliedschaft, Einladung
- auth/index.ts
- private.member_ids_in_scope(perm_base)
- api.ts
- Prettier-Konfiguration
- supabase-env.mjs
- Lokaler Supabase-Shim (auth)
- schemas.ts
- Phase 2 - Organisationen und Mandanten-Fundament
- Lokaler DB-Testlauf
- RLS-Grundregeln für jede Migration
- support/supabase.ts
- Favicon und Markenfarbe
- TS-Projektreferenzen
- Session-Start-Hook
- Team-News (Phase 11)
- V1-Erfolgskriterien
- DB-Typgenerierung
- Codequalität
- CSV-Mitarbeiterimport
- Observability
- Zukünftige Webhooks
- Entitlement-System
- Phase 7 - Zeiterfassung
- Phase 9 - Urlaub und Abwesenheit
- Supabase
- Phase 3 - Rollen und Berechtigungen
- Staging Environment (teampanel-8i0.pages.dev / Supabase teampanel-staging)
- Security Lives in the Database
- No Hardcoded UI Texts or Colors
- E-24 Auth-Token in localStorage statt HttpOnly-Cookies
- 20261019185317_profiles.sql
- smoke.spec.ts
- Phase 16 - Pilot
- Tabelle notifications
- TeamPanel
- global-setup.ts
- on_auth_user_first_confirmation
- pnpm check (pre-commit quality gate)

## God Nodes (most connected - your core abstractions)
1. `cn()` - 34 edges
2. `react` - 31 edges
3. `vitest` - 28 edges
4. `compilerOptions` - 24 edges
5. `compilerOptions` - 23 edges
6. `scripts` - 22 edges
7. `@supabase/supabase-js` - 22 edges
8. `react-i18next` - 22 edges
9. `Tabelle memberships (Mitgliedschaft und Mitarbeiterdatensatz)` - 22 edges
10. `AuthCard()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `CI Job: database (migrations, pgTAP, generated types)` --references--> `Seed Data (seed.sql)`  [INFERRED]
  .github/workflows/ci.yml → supabase/README.md
- `CI Job: quality (format, lint, typecheck, unit tests)` --semantically_similar_to--> `pnpm check (pre-commit quality gate)`  [INFERRED] [semantically similar]
  .github/workflows/ci.yml → CLAUDE.md
- `No Hardcoded UI Texts or Colors` --references--> `de.json (German i18n strings)`  [EXTRACTED]
  CLAUDE.md → src/i18n/de.json
- `Feature Modules (Spec Level B)` --references--> `ESLint Rule teampanel/layers`  [INFERRED]
  src/modules/README.md → CLAUDE.md
- `Platform Layer (Spec Level A)` --references--> `ESLint Rule teampanel/layers`  [INFERRED]
  src/platform/README.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI quality gates (quality, database, e2e, security jobs)** — github_workflows_ci, github_workflows_ci_quality, github_workflows_ci_database, github_workflows_ci_e2e, github_workflows_ci_security [EXTRACTED 1.00]
- **Frontend layer stack (app -> modules -> platform -> components -> lib)** — claude_layered_architecture, src_app_readme_app_shell, src_modules_readme_feature_modules, src_platform_readme_platform_layer, src_components_readme_ui_components, src_lib_readme_lib_layer [EXTRACTED 1.00]
- **Stripe-Billing-Synchronisation** — docs_architecture_architektur_stripe_webhook, docs_architecture_datenmodell_stripe_events, docs_architecture_datenmodell_subscriptions, docs_architecture_architektur_access_state, docs_architecture_architektur_stripe [EXTRACTED 1.00]
- **TeamPanel V1 Phasenplan (Phase 0-16, sequentiell abgenommen)** — docs_roadmap_phase_0, docs_roadmap_phase_1, docs_roadmap_phase_2, docs_roadmap_phase_3, docs_roadmap_phase_4, docs_roadmap_phase_5, docs_roadmap_phase_6, docs_roadmap_phase_7, docs_roadmap_phase_8, docs_roadmap_phase_9, docs_roadmap_phase_10, docs_roadmap_phase_11, docs_roadmap_phase_12, docs_roadmap_phase_13, docs_roadmap_phase_14, docs_roadmap_phase_15, docs_roadmap_phase_16 [EXTRACTED 1.00]
- **Zeiterfassung als append-only Event-Log mit abgeleiteten Sitzungen** — docs_architecture_architektur_clock_funktion, docs_architecture_datenmodell_time_clock_state, docs_architecture_datenmodell_clock_events, docs_architecture_datenmodell_time_entries, docs_architecture_datenmodell_recompute_time_entry, docs_architecture_datenmodell_time_adjustment_requests [EXTRACTED 1.00]
- **No hardcoded UI texts/colors enforcement** — claude_no_hardcoded_ui_texts_colors, src_i18n_readme_translations, src_styles_readme_design_tokens, src_components_readme_ui_components, index_theme_color_meta, github_pull_request_template_definition_of_done [INFERRED 0.85]
- **Tarif-, Entitlement- und Billing-Fluss** — docs_product_spezifikation_tarife, docs_product_spezifikation_entitlement_system, docs_roadmap_private_entitlement, docs_product_spezifikation_stripe_billing, docs_product_spezifikation_stripe_webhooks, docs_roadmap_stripe_webhook_function, docs_product_spezifikation_grace_period, docs_roadmap_access_state [INFERRED 0.85]
- **Mandantentrennung durchgesetzt auf Datenbankebene** — docs_product_spezifikation_multi_tenant_architektur, docs_product_spezifikation_row_level_security, docs_product_spezifikation_memberships, docs_roadmap_my_org_ids, docs_roadmap_db_guardrails, docs_roadmap_isolationsmatrix, docs_product_spezifikation_security_tests [INFERRED 0.85]
- **Vier Autorisierungsschranken (Tarif, Modul, Permission, Scope)** — docs_architecture_architektur_vier_schranken, docs_architecture_architektur_entitlement_funktion, docs_security_rls_und_berechtigungen_orgs_with_module, docs_security_rls_und_berechtigungen_orgs_with_permission, docs_security_rls_und_berechtigungen_member_ids_in_scope [INFERRED 0.85]

## Communities (67 total, 19 thin omitted)

### Community 0 - "supabase-mock.ts"
Cohesion: 0.05
Nodes (55): @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, zod, firstConfirmation, magicLinkSignIn, otpSession, verifiedAs() (+47 more)

### Community 1 - "Plattform-Infrastruktur und Betrieb"
Cohesion: 0.11
Nodes (17): Audit Log via private.write_audit, Cloudflare Pages (statisches Frontend), Workflow Deploy database, Supabase Edge Functions (Deno), pg_cron Jobs, Resend (E-Mail-Versand), Supabase (EU-Region), Tabelle audit_logs (+9 more)

### Community 2 - "Phase 4 - Mitarbeiter, Teams, Standorte"
Cohesion: 0.18
Nodes (11): Mobile-First, Module Registry, Navigation (Desktop-Sidebar und Mobile Bottom-Navigation), Onboarding Setup-Assistent (7 Schritte), Resend (Transaktions-E-Mail), Standorte (Locations), Teams, private.email_outbox + Edge Function send-emails (+3 more)

### Community 3 - "Phase 8 - Dienstplan"
Cohesion: 0.21
Nodes (12): Benachrichtigungen (Notification Center), Dashboard Builder (vorbereitete Widgets), Dienstplan, Pagination, Schichttausch, Schicht (Shift), Verfuegbarkeit, Zeitzonen (UTC intern, Schichten ueber Mitternacht) (+4 more)

### Community 4 - "database.ts"
Cohesion: 0.16
Nodes (14): pnpm db:types (DB type generation), CI Job: database (migrations, pgTAP, generated types), TeamPanelClient, CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema (+6 more)

### Community 5 - "Querschnitt: UX, i18n, Fehler, Seed"
Cohesion: 0.13
Nodes (22): Cloudflare Pages, Definition of Done, Design Tokens, Fehlerbehandlung (keine technischen Fehlermeldungen), Internationalisierung (Translation Keys), Modul-interne Struktur, Repository-Struktur, Empfohlener Tech-Stack (+14 more)

### Community 6 - "TeamPanel Implementierungsplan V1 (Roadmap)"
Cohesion: 0.27
Nodes (15): CLAUDE.md - TeamPanel Project Rules, Phase 0: Repository Foundation, TeamPanel – Technische Architektur (V1), TeamPanel – Datenmodell V1, TeamPanel – Widersprüche, Lücken, Risiken und Architekturentscheidungen, TeamPanel – Umgebungen einrichten (local, staging, production), TeamPanel Masterplan (Spezifikation, Source of Truth), Claude - Arbeitsweise pro Phase (Paragraf 90) (+7 more)

### Community 7 - "Platform Layer (Spec Level A)"
Cohesion: 0.29
Nodes (7): CI Job: security (secrets and dependencies), App Shell (src/app), Domain-free UI Components (shadcn/ui), i18n Translations (de.json, typed keys), lib Layer (lowest layer), Feature Modules (Spec Level B), Platform Layer (Spec Level A)

### Community 8 - "Dev-Abhängigkeiten (Lint/Test)"
Cohesion: 0.07
Nodes (29): devDependencies, eslint, @eslint/js, eslint-plugin-i18next, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+21 more)

### Community 9 - "Zeiterfassung und Billing-Zustand"
Cohesion: 0.11
Nodes (19): Zugriffsstatus access_state (active/grace_period/restricted), Stripe, Tabelle clock_events (append-only), Tabellen feature_flags / organization_feature_flags, Tabelle plan_entitlements, Tabelle plans (free/pro/business), private.recompute_time_entry(entry_id), Tabelle private.stripe_events (+11 more)

### Community 10 - "TS-Config Node"
Cohesion: 0.07
Nodes (26): compilerOptions, allowImportingTsExtensions, allowJs, checkJs, erasableSyntaxOnly, isolatedModules, lib, module (+18 more)

### Community 11 - "TS-Config App"
Cohesion: 0.08
Nodes (24): compilerOptions, erasableSyntaxOnly, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+16 more)

### Community 12 - "package.json Metadaten"
Cohesion: 0.09
Nodes (22): engines, node, name, packageManager, private, type, version, clsx (+14 more)

### Community 13 - "TS-Config E2E"
Cohesion: 0.09
Nodes (21): compilerOptions, erasableSyntaxOnly, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+13 more)

### Community 14 - "pnpm-Skripte"
Cohesion: 0.09
Nodes (22): scripts, build, check, check:bundle, db:reset, db:start, db:stop, db:test (+14 more)

### Community 15 - "shadcn/ui-Konfiguration"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 16 - "ESLint-Regelblöcke (i18n, Security, Tokens)"
Cohesion: 0.11
Nodes (16): architectureConfig(), DESIGN_TOKEN_SELECTORS, i18nConfig(), NON_TEXT_ATTRIBUTES, restrictedSyntaxConfigs, SECURITY_SELECTORS, TEXT_SELECTORS, @eslint/js (+8 more)

### Community 17 - "Schichten-Architektur (teampanel/layers)"
Cohesion: 0.18
Nodes (8): ESLint Rule teampanel/layers, LAYER_LABEL, LAYERS, layersRule, plugin, PROJECT_ROOT, SRC_ROOT, ESLint Architecture Rule Tests

### Community 18 - "Security-Header und CSP"
Cohesion: 0.30
Nodes (7): buildContentSecurityPolicy(), buildHeadersFile(), buildSecurityHeaders(), supabaseOrigins(), @tailwindcss/vite, @vitejs/plugin-react, securityHeaders()

### Community 19 - "Laufzeit-Abhängigkeiten"
Cohesion: 0.13
Nodes (15): dependencies, class-variance-authority, clsx, @hookform/resolvers, i18next, @radix-ui/react-slot, react, react-dom (+7 more)

### Community 20 - "Architekturprinzipien und RPCs"
Cohesion: 0.14
Nodes (8): ESLint-Regel teampanel/layers (config/eslint-plugin-teampanel.js), Fehler-Mapping lib/errors.ts (TP403/TP409/TP422), Tabelle locations, Tabelle organizations, Tabelle private.outbox (Domänen-Events), Tabelle schedule_publications, Tabelle shifts, private.my_membership_ids()

### Community 22 - "Modulsystem und Registry"
Cohesion: 0.17
Nodes (11): Contract-Test Registry ↔ DB-Katalog, Frontend-Registry src/modules/registry.ts (defineModule), Tabelle dashboard_layouts, Tabelle modules (globaler Katalog), Tabelle organization_modules, Tabelle permissions (globaler Katalog), CSV Export, Performance (Query Caching, Lazy Loading, Code Splitting) (+3 more)

### Community 23 - "Identität, Mitgliedschaft, Einladung"
Cohesion: 0.16
Nodes (12): Sentry (EU, PII-Scrubbing), RPC accept_invitation(token), Tabelle availability, Tabelle employee_profiles (HR-/Kontaktdaten), Tabelle invitations, Tabelle memberships (Mitgliedschaft und Mitarbeiterdatensatz), Tabelle notification_preferences, Tabelle profiles (+4 more)

### Community 24 - "auth/index.ts"
Cohesion: 0.06
Nodes (88): class-variance-authority, @hookform/resolvers, @radix-ui/react-slot, react, react-hook-form, react-i18next, react-router, AuthLayout() (+80 more)

### Community 25 - "private.member_ids_in_scope(perm_base)"
Cohesion: 0.13
Nodes (14): entitlement(org, key) Lookup, Standortbeschränkung location_scope (all|assigned), Tabellen announcements / announcement_audiences / announcement_reads, Tabelle membership_locations, Tabelle organization_entitlement_overrides, Tabelle role_permissions, Tabelle roles, Tabelle team_members (+6 more)

### Community 26 - "api.ts"
Cohesion: 0.07
Nodes (47): RFC-3339, @tanstack/react-query, redirectTo(), requireEmailLinkSession(), requireGuest(), requireSession(), Middleware, BLOCKED_PATHS (+39 more)

### Community 27 - "Prettier-Konfiguration"
Cohesion: 0.25
Nodes (7): plugins, printWidth, semi, singleQuote, tailwindFunctions, tailwindStylesheet, trailingComma

### Community 28 - "supabase-env.mjs"
Cohesion: 0.15
Nodes (12): findings, FORBIDDEN, listFiles(), assertReachable(), assertStackHealthy(), E2E_ENV_FILE, e2eEnvFile(), main() (+4 more)

### Community 29 - "Lokaler Supabase-Shim (auth)"
Cohesion: 0.38
Nodes (3): auth.identities, auth.users, users_email_partial_key

### Community 30 - "schemas.ts"
Cohesion: 0.07
Nodes (33): i18next, de.json (German i18n strings), CustomTypeOptions, i18next, defaultNS, resources, checkNewPassword(), codePointLength() (+25 more)

### Community 31 - "Phase 2 - Organisationen und Mandanten-Fundament"
Cohesion: 0.14
Nodes (18): Database Constraints, Datenmodell - Kerntabellen, Demo GmbH (Development Seed), Account-/Mitgliedschaftsmodell (users, organizations, memberships), organization (Tenant), Owner-Rolle, Row Level Security (RLS), Security Tests (Cross-Tenant-Negativtests) (+10 more)

### Community 32 - "Lokaler DB-Testlauf"
Cohesion: 0.70
Nodes (4): as_server_user(), cleanup(), psql_as(), db-test-local.sh script

### Community 33 - "RLS-Grundregeln für jede Migration"
Cohesion: 0.15
Nodes (12): CI-Pipeline (GitHub Actions: quality, database, e2e, security), Dateien: private Buckets und signierte URLs, Schema private (nicht exponiert), Seed Demo GmbH / Fremd AG (supabase/seed.sql), pnpm db:test:local mit supabase-shim.sql (ohne Docker), Lokale Entwicklung (pnpm db:start, pnpm dev), Ruleset 'main schützen', Guardrail-Tests 000_guardrails.test.sql (+4 more)

### Community 34 - "support/supabase.ts"
Cohesion: 0.06
Nodes (56): @playwright/test, @supabase/supabase-js, vitest, signUp(), expectCheckInbox(), expectHome(), expectPasswordSetup(), Fixtures (+48 more)

### Community 35 - "Favicon und Markenfarbe"
Cohesion: 1.00
Nodes (3): Brand Primary Color #006390, App Favicon (T monogram on blue rounded square), T Letter Monogram Logo

### Community 48 - "Entitlement-System"
Cohesion: 0.19
Nodes (10): ai_module (zukuenftige KI), Aufgaben (Tasks), Checklisten, Claude - verbindliche Entwicklungsregeln, Formulare, Langfristige Produktvision (Team Management -> Intelligence), Zukuenftiger No-Code Builder, Phase 10 - Aufgaben und Checklisten (+2 more)

### Community 49 - "Phase 7 - Zeiterfassung"
Cohesion: 0.23
Nodes (10): Arbeitszeit-Status (OFFLINE, WORKING, ON_BREAK, FINISHED), Audit Log, E2E kritische Flows 1-4, Korrekturanfrage (manuelle Zeitkorrektur), Pausen und Nettoarbeitszeit, Teststrategie (Unit, Database, Integration, E2E), Zeiterfassung, RPC clock() (time_clock_state, clock_events) (+2 more)

### Community 50 - "Phase 9 - Urlaub und Abwesenheit"
Cohesion: 0.25
Nodes (7): RPC absences_in_scope(from, to), Tabelle leave_requests, Tabelle leave_types, Urlaub und Abwesenheit, Urlaubs-Workflow (pending/approved/rejected/cancelled), RPC absences_in_scope, Phase 9 - Urlaub und Abwesenheit

### Community 51 - "Supabase"
Cohesion: 0.24
Nodes (9): CI Job: e2e (Playwright), pgTAP, Playwright, Supabase, TeamPanel Tech Stack, Supabase Edge Functions (from Phase 4), Supabase Migrations (single source of schema changes), E2E Tests (Playwright, desktop + mobile) (+1 more)

### Community 52 - "Phase 3 - Rollen und Berechtigungen"
Cohesion: 0.27
Nodes (8): Custom Roles, Free / Pro / Business Tarife, Zukuenftige API, Helper member_ids_in_scope(), Permission-Katalog und TS-Registry (Contract-Test), Phase 3 - Rollen und Berechtigungen, Scope-Matrix (self/team/all x Standort), Frontend-Guards usePermission() und <Can>

### Community 53 - "Staging Environment (teampanel-8i0.pages.dev / Supabase teampanel-staging)"
Cohesion: 0.22
Nodes (8): Staging Environment (teampanel-8i0.pages.dev / Supabase teampanel-staging), Dependabot Configuration, CI Workflow, Deploy Database Workflow, Deploy Job: apply migrations, Deploy Job: plan (migration dry-run), Deploy Job: verify (green CI + re-run DB tests), Seed Data (seed.sql)

### Community 55 - "No Hardcoded UI Texts or Colors"
Cohesion: 0.32
Nodes (5): index.html (SPA entry document), theme-color Meta Tag (#006390 = --primary), index.css (Tailwind entry), Design Tokens (tokens.css), tokens.css (design tokens)

### Community 56 - "E-24 Auth-Token in localStorage statt HttpOnly-Cookies"
Cohesion: 0.25
Nodes (6): Security-Header dist/_headers (CSP), Dokumente, Sicherheitsanforderungen, Phase 1 - Auth, Phase 15 - Security Hardening, Auth und Sessions (JWT-Laufzeit, CSP, Rate-Limits)

### Community 57 - "20261019185317_profiles.sql"
Cohesion: 0.43
Nodes (4): on_auth_user_created, private.handle_new_user(), profiles_set_updated_at, public.profiles

### Community 58 - "smoke.spec.ts"
Cohesion: 0.38
Nodes (3): confirmEmailLink(), mockSupabase(), verifyResponse()

### Community 59 - "Phase 16 - Pilot"
Cohesion: 0.47
Nodes (4): Feature Flags, Kennzahlen nach Launch, Pilotkriterien (branchenuebergreifende Testunternehmen), Phase 16 - Pilot

### Community 61 - "TeamPanel"
Cohesion: 0.40
Nodes (3): Zukuenftiger Marketplace, Produktstruktur (Ebene A Plattform / B Kernmodule / C Erweiterungen), TeamPanel

### Community 62 - "global-setup.ts"
Cohesion: 0.60
Nodes (4): vite, answers(), findProblem(), globalSetup()

## Ambiguous Edges - Review These
- `Abgeleiteter access_state (Grace Period, Restricted Mode)` → `E-15 Billing-Status: Stripe-Status vs. access_state`  [AMBIGUOUS]
  docs/roadmap.md · relation: conceptually_related_to

## Knowledge Gaps
- **55 isolated node(s):** `@testing-library/dom`, `@types/estree`, `@types/node`, `@types/react`, `@types/react-dom` (+50 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 382 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TeamPanel Masterplan (Spezifikation, Source of Truth)` connect `TeamPanel Implementierungsplan V1 (Roadmap)` to `Platform Layer (Spec Level A)`, `TeamPanel`, `No Hardcoded UI Texts or Colors`?**
  _High betweenness centrality (0.290) - this node is a cross-community bridge._
- **What connects `@testing-library/dom`, `@types/estree`, `@types/node` to the rest of the system?**
  _55 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supabase-mock.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05030864197530864 - nodes in this community are weakly interconnected._
- **Why does `lib Layer (lowest layer)` connect `Platform Layer (Spec Level A)` to `supabase-mock.ts`, `auth/index.ts`, `Supabase`, `TeamPanel Implementierungsplan V1 (Roadmap)`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Should `Plattform-Infrastruktur und Betrieb` be split into smaller, more focused modules?**
  _Cohesion score 0.10507246376811594 - nodes in this community are weakly interconnected._
- **Why does `Eskalations- und Aussperrschutz` connect `Identität, Mitgliedschaft, Einladung` to `E-24 Auth-Token in localStorage statt HttpOnly-Cookies`, `private.member_ids_in_scope(perm_base)`, `Phase 3 - Rollen und Berechtigungen`, `TeamPanel Implementierungsplan V1 (Roadmap)`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Abgeleiteter access_state (Grace Period, Restricted Mode)` and `E-15 Billing-Status: Stripe-Status vs. access_state`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._