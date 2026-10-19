# Graph Report - Team-app  (2026-10-19)

## Corpus Check
- Corpus is ~31,492 words - fits in a single context window. You may not need a graph.

## Summary
- 733 nodes · 1119 edges · 48 communities (33 shown, 15 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 174 edges (avg confidence: 0.88)
- Token cost: 453,269 input · 0 output

## Community Hubs (Navigation)
- Frontend-App und UI-Bausteine
- Plattform-Infrastruktur und Betrieb
- Produktumfang und Module (Spez.)
- Abwesenheiten, Schichten und Arbeitsrecht
- CI, Deploy und Staging
- Querschnitt: UX, i18n, Fehler, Seed
- Projektregeln (CLAUDE.md)
- Sicherheits- und Code-Regeln
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
- ESLint-Konfiguration
- Modulsystem und Registry
- Identität, Mitgliedschaft, Einladung
- Entitlements und Reporting
- Autorisierung und Scopes
- Organisation, Standorte, Schichten
- Prettier-Konfiguration
- Bundle-Secret-Scan
- Lokaler Supabase-Shim (auth)
- Rollen, Teams, Ankündigungen
- Permission-Katalog und Standardrollen
- Lokaler DB-Testlauf
- Storage und Dateien
- E2E-Smoke-Tests
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 24 edges
2. `compilerOptions` - 23 edges
3. `Tabelle memberships (Mitgliedschaft und Mitarbeiterdatensatz)` - 22 edges
4. `scripts` - 20 edges
5. `compilerOptions` - 20 edges
6. `Phase 0 - Repository-Fundament` - 17 edges
7. `TeamPanel Masterplan (Spezifikation, Source of Truth)` - 14 edges
8. `TeamPanel Implementierungsplan V1 (Roadmap)` - 13 edges
9. `Phase 2 - Organisationen und Mandanten-Fundament` - 12 edges
10. `RLS-Policy-Muster` - 11 edges

## Surprising Connections (you probably didn't know these)
- `CI Job: quality (format, lint, typecheck, unit tests)` --semantically_similar_to--> `pnpm check (pre-commit quality gate)`  [INFERRED] [semantically similar]
  .github/workflows/ci.yml → CLAUDE.md
- `Append-only clock_events (derived time_entries)` --conceptually_related_to--> `TeamPanel – Datenmodell V1`  [INFERRED]
  CLAUDE.md → docs/architecture/datenmodell.md
- `UTC timestamptz Storage` --conceptually_related_to--> `TeamPanel – Datenmodell V1`  [INFERRED]
  CLAUDE.md → docs/architecture/datenmodell.md
- `Definition of Done (Spec §75)` --conceptually_related_to--> `No Hardcoded UI Texts or Colors`  [INFERRED]
  .github/pull_request_template.md → CLAUDE.md
- `PR Security Review Section` --conceptually_related_to--> `Security Lives in the Database`  [INFERRED]
  .github/pull_request_template.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **TeamPanel V1 Phasenplan (Phase 0-16, sequentiell abgenommen)** — docs_roadmap_phase_0, docs_roadmap_phase_1, docs_roadmap_phase_2, docs_roadmap_phase_3, docs_roadmap_phase_4, docs_roadmap_phase_5, docs_roadmap_phase_6, docs_roadmap_phase_7, docs_roadmap_phase_8, docs_roadmap_phase_9, docs_roadmap_phase_10, docs_roadmap_phase_11, docs_roadmap_phase_12, docs_roadmap_phase_13, docs_roadmap_phase_14, docs_roadmap_phase_15, docs_roadmap_phase_16 [EXTRACTED 1.00]
- **Mandantentrennung durchgesetzt auf Datenbankebene** — docs_product_spezifikation_multi_tenant_architektur, docs_product_spezifikation_row_level_security, docs_product_spezifikation_memberships, docs_roadmap_my_org_ids, docs_roadmap_db_guardrails, docs_roadmap_isolationsmatrix, docs_product_spezifikation_security_tests [INFERRED 0.85]
- **Tarif-, Entitlement- und Billing-Fluss** — docs_product_spezifikation_tarife, docs_product_spezifikation_entitlement_system, docs_roadmap_private_entitlement, docs_product_spezifikation_stripe_billing, docs_product_spezifikation_stripe_webhooks, docs_roadmap_stripe_webhook_function, docs_product_spezifikation_grace_period, docs_roadmap_access_state [INFERRED 0.85]
- **Vier Autorisierungsschranken (Tarif, Modul, Permission, Scope)** — docs_architecture_architektur_vier_schranken, docs_architecture_architektur_entitlement_funktion, docs_security_rls_und_berechtigungen_orgs_with_module, docs_security_rls_und_berechtigungen_orgs_with_permission, docs_security_rls_und_berechtigungen_member_ids_in_scope [INFERRED 0.85]
- **Zeiterfassung als append-only Event-Log mit abgeleiteten Sitzungen** — docs_architecture_architektur_clock_funktion, docs_architecture_datenmodell_time_clock_state, docs_architecture_datenmodell_clock_events, docs_architecture_datenmodell_time_entries, docs_architecture_datenmodell_recompute_time_entry, docs_architecture_datenmodell_time_adjustment_requests [EXTRACTED 1.00]
- **Stripe-Billing-Synchronisation** — docs_architecture_architektur_stripe_webhook, docs_architecture_datenmodell_stripe_events, docs_architecture_datenmodell_subscriptions, docs_architecture_architektur_access_state, docs_architecture_architektur_stripe [EXTRACTED 1.00]
- **Frontend layer stack (app -> modules -> platform -> components -> lib)** — claude_layered_architecture, src_app_readme_app_shell, src_modules_readme_feature_modules, src_platform_readme_platform_layer, src_components_readme_ui_components, src_lib_readme_lib_layer [EXTRACTED 1.00]
- **CI quality gates (quality, database, e2e, security jobs)** — github_workflows_ci, github_workflows_ci_quality, github_workflows_ci_database, github_workflows_ci_e2e, github_workflows_ci_security [EXTRACTED 1.00]
- **No hardcoded UI texts/colors enforcement** — claude_no_hardcoded_ui_texts_colors, src_i18n_readme_translations, src_styles_readme_design_tokens, src_components_readme_ui_components, index_theme_color_meta, github_pull_request_template_definition_of_done [INFERRED 0.85]

## Communities (48 total, 15 thin omitted)

### Community 0 - "Frontend-App und UI-Bausteine"
Cohesion: 0.08
Nodes (40): class-variance-authority, clsx, @radix-ui/react-slot, react, react-i18next, react-router, tailwind-merge, @tanstack/react-query (+32 more)

### Community 1 - "Plattform-Infrastruktur und Betrieb"
Cohesion: 0.06
Nodes (31): Audit Log via private.write_audit, CI-Pipeline (GitHub Actions: quality, database, e2e, security), Cloudflare Pages (statisches Frontend), Workflow Deploy database, Supabase Edge Functions (Deno), pg_cron Jobs, Resend (E-Mail-Versand), Schema private (nicht exponiert) (+23 more)

### Community 2 - "Produktumfang und Module (Spez.)"
Cohesion: 0.06
Nodes (33): ai_module (zukuenftige KI), Aufgaben (Tasks), Checklisten, Claude - verbindliche Entwicklungsregeln, Custom Roles, Formulare, Langfristige Produktvision (Team Management -> Intelligence), Zukuenftiger Marketplace (+25 more)

### Community 3 - "Abwesenheiten, Schichten und Arbeitsrecht"
Cohesion: 0.07
Nodes (34): Tabelle leave_requests, Tabelle leave_types, Arbeitszeit-Status (OFFLINE, WORKING, ON_BREAK, FINISHED), Audit Log, Benachrichtigungen (Notification Center), Dashboard Builder (vorbereitete Widgets), Database Constraints, Datenmodell - Kerntabellen (+26 more)

### Community 4 - "CI, Deploy und Staging"
Cohesion: 0.06
Nodes (35): pnpm db:types (DB type generation), Staging Environment (teampanel-8i0.pages.dev / Supabase teampanel-staging), Dependabot Configuration, CI Workflow, CI Job: database (migrations, pgTAP, generated types), CI Job: e2e (Playwright), Deploy Database Workflow, Deploy Job: apply migrations (+27 more)

### Community 5 - "Querschnitt: UX, i18n, Fehler, Seed"
Cohesion: 0.07
Nodes (38): Cloudflare Pages, Definition of Done, Demo GmbH (Development Seed), Design Tokens, Fehlerbehandlung (keine technischen Fehlermeldungen), Internationalisierung (Translation Keys), Account-/Mitgliedschaftsmodell (users, organizations, memberships), Modul-interne Struktur (+30 more)

### Community 6 - "Projektregeln (CLAUDE.md)"
Cohesion: 0.09
Nodes (24): CLAUDE.md - TeamPanel Project Rules, Phase 0: Repository Foundation, pnpm check (pre-commit quality gate), TeamPanel – Technische Architektur (V1), TeamPanel – Datenmodell V1, TeamPanel – Widersprüche, Lücken, Risiken und Architekturentscheidungen, TeamPanel – Umgebungen einrichten (local, staging, production), TeamPanel Masterplan (Spezifikation, Source of Truth) (+16 more)

### Community 7 - "Sicherheits- und Code-Regeln"
Cohesion: 0.08
Nodes (25): CI Job: security (secrets and dependencies), index.html (SPA entry document), theme-color Meta Tag (#006390 = --primary), i18next, @testing-library/jest-dom, vitest, App Shell (src/app), Domain-free UI Components (shadcn/ui) (+17 more)

### Community 8 - "Dev-Abhängigkeiten (Lint/Test)"
Cohesion: 0.07
Nodes (29): devDependencies, eslint, @eslint/js, eslint-plugin-i18next, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+21 more)

### Community 9 - "Zeiterfassung und Billing-Zustand"
Cohesion: 0.12
Nodes (18): Zugriffsstatus access_state (active/grace_period/restricted), Stripe, Tabelle clock_events (append-only), Tabellen feature_flags / organization_feature_flags, Tabelle plan_entitlements, Tabelle plans (free/pro/business), private.recompute_time_entry(entry_id), Tabelle subscriptions (Stripe-Spiegel) (+10 more)

### Community 10 - "TS-Config Node"
Cohesion: 0.07
Nodes (26): compilerOptions, allowImportingTsExtensions, allowJs, checkJs, erasableSyntaxOnly, isolatedModules, lib, module (+18 more)

### Community 11 - "TS-Config App"
Cohesion: 0.08
Nodes (24): compilerOptions, erasableSyntaxOnly, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+16 more)

### Community 12 - "package.json Metadaten"
Cohesion: 0.09
Nodes (21): engines, node, name, packageManager, private, type, version, jsdom (+13 more)

### Community 13 - "TS-Config E2E"
Cohesion: 0.09
Nodes (21): compilerOptions, erasableSyntaxOnly, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+13 more)

### Community 14 - "pnpm-Skripte"
Cohesion: 0.10
Nodes (20): scripts, build, check, check:bundle, db:reset, db:start, db:stop, db:test (+12 more)

### Community 15 - "shadcn/ui-Konfiguration"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 16 - "ESLint-Regelblöcke (i18n, Security, Tokens)"
Cohesion: 0.13
Nodes (10): architectureConfig(), DESIGN_TOKEN_SELECTORS, i18nConfig(), NON_TEXT_ATTRIBUTES, restrictedSyntaxConfigs, SECURITY_SELECTORS, TEXT_SELECTORS, typescript-eslint (+2 more)

### Community 17 - "Schichten-Architektur (teampanel/layers)"
Cohesion: 0.18
Nodes (8): ESLint Rule teampanel/layers, LAYER_LABEL, LAYERS, layersRule, plugin, PROJECT_ROOT, SRC_ROOT, ESLint Architecture Rule Tests

### Community 18 - "Security-Header und CSP"
Cohesion: 0.27
Nodes (8): buildContentSecurityPolicy(), buildHeadersFile(), buildSecurityHeaders(), supabaseOrigins(), @tailwindcss/vite, vite, @vitejs/plugin-react, securityHeaders()

### Community 19 - "Laufzeit-Abhängigkeiten"
Cohesion: 0.15
Nodes (13): dependencies, class-variance-authority, clsx, i18next, @radix-ui/react-slot, react, react-dom, react-i18next (+5 more)

### Community 20 - "Architekturprinzipien und RPCs"
Cohesion: 0.18
Nodes (5): ESLint-Regel teampanel/layers (config/eslint-plugin-teampanel.js), Fehler-Mapping lib/errors.ts (TP403/TP409/TP422), Tabelle notifications, Tabelle private.outbox (Domänen-Events), private.my_membership_ids()

### Community 21 - "ESLint-Konfiguration"
Cohesion: 0.20
Nodes (8): eslint-plugin-jsx-a11y, eslint, @eslint/js, eslint-plugin-i18next, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals

### Community 22 - "Modulsystem und Registry"
Cohesion: 0.29
Nodes (6): Contract-Test Registry ↔ DB-Katalog, Frontend-Registry src/modules/registry.ts (defineModule), Tabelle dashboard_layouts, Tabelle modules (globaler Katalog), Tabelle organization_modules, Tabelle permissions (globaler Katalog)

### Community 23 - "Identität, Mitgliedschaft, Einladung"
Cohesion: 0.29
Nodes (8): Sentry (EU, PII-Scrubbing), RPC accept_invitation(token), Tabelle availability, Tabelle employee_profiles (HR-/Kontaktdaten), Tabelle invitations, Tabelle memberships (Mitgliedschaft und Mitarbeiterdatensatz), Tabelle notification_preferences, Tabelle profiles

### Community 24 - "Entitlements und Reporting"
Cohesion: 0.22
Nodes (7): entitlement(org, key) Lookup, Tabelle organization_entitlement_overrides, CSV Export, Performance (Query Caching, Lazy Loading, Code Splitting), Reporting, Phase 13 - Reporting und Export, private.orgs_with_module(module)

### Community 25 - "Autorisierung und Scopes"
Cohesion: 0.31
Nodes (4): Standortbeschränkung location_scope (all|assigned), Tabelle team_members, private.member_ids_in_scope(perm_base), private.role_has(role_id, key)

### Community 26 - "Organisation, Standorte, Schichten"
Cohesion: 0.32
Nodes (5): Tabelle locations, Tabelle membership_locations, Tabelle organizations, Tabelle schedule_publications, Tabelle shifts

### Community 27 - "Prettier-Konfiguration"
Cohesion: 0.25
Nodes (7): plugins, printWidth, semi, singleQuote, tailwindFunctions, tailwindStylesheet, trailingComma

### Community 28 - "Bundle-Secret-Scan"
Cohesion: 0.29
Nodes (3): findings, FORBIDDEN, listFiles()

### Community 30 - "Rollen, Teams, Ankündigungen"
Cohesion: 0.50
Nodes (5): Tabellen announcements / announcement_audiences / announcement_reads, Tabelle role_permissions, Tabelle roles, Tabelle teams, private.orgs_with_permission(perm)

### Community 32 - "Lokaler DB-Testlauf"
Cohesion: 0.70
Nodes (4): as_server_user(), cleanup(), psql_as(), db-test-local.sh script

### Community 33 - "Storage und Dateien"
Cohesion: 0.50
Nodes (3): Dateien: private Buckets und signierte URLs, private.my_org_ids(), Storage-Policies (private Buckets, Pfad {organization_id}/…)

### Community 35 - "Favicon und Markenfarbe"
Cohesion: 1.00
Nodes (3): Brand Primary Color #006390, App Favicon (T monogram on blue rounded square), T Letter Monogram Logo

## Ambiguous Edges - Review These
- `Abgeleiteter access_state (Grace Period, Restricted Mode)` → `E-15 Billing-Status: Stripe-Status vs. access_state`  [AMBIGUOUS]
  docs/roadmap.md · relation: conceptually_related_to

## Knowledge Gaps
- **54 isolated node(s):** `@testing-library/dom`, `@types/estree`, `@types/node`, `@types/react`, `@types/react-dom` (+49 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 297 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TeamPanel Masterplan (Spezifikation, Source of Truth)` connect `Projektregeln (CLAUDE.md)` to `Produktumfang und Module (Spez.)`, `Sicherheits- und Code-Regeln`?**
  _High betweenness centrality (0.305) - this node is a cross-community bridge._
- **What connects `@testing-library/dom`, `@types/estree`, `@types/node` to the rest of the system?**
  _54 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend-App und UI-Bausteine` be split into smaller, more focused modules?**
  _Cohesion score 0.07627118644067797 - nodes in this community are weakly interconnected._
- **Why does `lib Layer (lowest layer)` connect `Sicherheits- und Code-Regeln` to `Frontend-App und UI-Bausteine`, `CI, Deploy und Staging`, `Projektregeln (CLAUDE.md)`?**
  _High betweenness centrality (0.208) - this node is a cross-community bridge._
- **Should `Plattform-Infrastruktur und Betrieb` be split into smaller, more focused modules?**
  _Cohesion score 0.057971014492753624 - nodes in this community are weakly interconnected._
- **Why does `Eskalations- und Aussperrschutz` connect `Projektregeln (CLAUDE.md)` to `Zeiterfassung und Billing-Zustand`, `Produktumfang und Module (Spez.)`, `Rollen, Teams, Ankündigungen`, `Identität, Mitgliedschaft, Einladung`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Abgeleiteter access_state (Grace Period, Restricted Mode)` and `E-15 Billing-Status: Stripe-Status vs. access_state`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._