# TeamPanel – Projektregeln für Claude

Modulares Team-Management-SaaS für KMU (AT/EU). Responsive Web-App/PWA. **Keine KI in V1.**

## Zuerst lesen (in dieser Reihenfolge)
1. `docs/product/spezifikation.md` – **Source of Truth**
2. `docs/architecture/entscheidungen-und-risiken.md` – Präzisierungen/Abweichungen (E-xx) und offene Entscheidungen
3. `docs/roadmap.md` – Phasen, aktueller Stand, Abnahmekriterien
4. `docs/architecture/architektur.md`, `docs/architecture/datenmodell.md`, `docs/security/rls-und-berechtigungen.md`

## Aktueller Stand
- Alle Empfehlungen in `entscheidungen-und-risiken.md` sind vom Product Owner freigegeben (2026-10-19).
- **Phase 0 (Repository-Fundament) ist abgeschlossen**, inkl. Staging (`https://teampanel-8i0.pages.dev`, Supabase `teampanel-staging`). Nächste Phase: 1 (Auth). Details: `docs/roadmap.md`, Umgebungen: `docs/architecture/umgebungen.md` §3.
- `main` ist geschützt: Arbeit auf eigenem Branch, Übernahme nur per Pull Request mit grüner CI. Migrationen nach Staging nur über den Workflow *Deploy database*, nie direkt per Supabase-Connector.

## Befehle
- `pnpm check`: Format, Lint, Typecheck, Unit-Tests. **Vor jedem Commit.**
- `pnpm e2e`: Playwright (Desktop + Mobile). In Cloud-Sessions mit `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium`.
- `pnpm db:test`: pgTAP gegen lokales Supabase (Docker). Ohne Docker-Registry (Cloud-Sessions): `pnpm db:test:local`; braucht lokales PostgreSQL + pgTAP (`apt-get install postgresql-<major>-pgtap`, Cloud-Session: 16). CI bleibt maßgeblich.
- `pnpm exec supabase migration new <name>`: neue Migration. `pnpm db:types` (Docker) bzw. `pnpm db:types:local` (ohne Docker): DB-Typen neu generieren und mit committen.
- Setup der Umgebungen: `docs/architecture/umgebungen.md`.

## Nicht verhandelbar
- Sicherheit liegt in der Datenbank: RLS auf jeder `public`-Tabelle, zusammengesetzte FKs `(organization_id, x_id)`, Statusübergänge/Genehmigungen nur über `SECURITY DEFINER`-RPCs mit `set search_path = ''`. Frontend-Checks sind nur UX.
- Secure by default: neue Tabelle/Permission/Modul = kein Zugriff, bis explizit erlaubt. Owner hat implizit alle Permissions.
- Code fragt Entitlements ab (`entitlement('max_members')`), nie Tarifnamen.
- `clock_events` ist append-only, Zeitstempel kommen vom Server, `time_entries` ist abgeleitet.
- Zeitpunkte als `timestamptz` (UTC), Darstellung in Standort-/Organisationszeitzone; Schichten als `starts_at`/`ends_at`.
- Keine hartkodierten UI-Texte (i18n-Keys in `src/i18n/de.json`), keine hartkodierten Farben (Design Tokens in `src/styles/tokens.css`; Tailwind-Standardpalette ist entfernt). Einzige Ausnahme: statische Meta-Tags in `index.html`.
- Keine Rohfehler an Nutzer; Fehlercodes über `src/lib/errors.ts` mappen.
- Keine Secrets im Repo; Service-Role-Key nie im Frontend.
- DB-Änderungen nur per Migration in `supabase/migrations/`; jede neue Mandantentabelle bekommt pgTAP-Isolationstests.
- Schichten: app → modules → platform → components → lib. Feature-Module (`src/modules/*`) importieren nie andere Module; Module verdrahtet nur `src/modules/registry.ts` bzw. `src/app`. Imports außerhalb des eigenen Ordners immer über `@/`. ESLint-Regel `teampanel/layers` erzwingt das inkl. `import()`/`import.meta.glob`. Neue Top-Level-Ordner unter `src/` brauchen erst einen Eintrag in `config/eslint-plugin-teampanel.js`; `src/test` ist nur für `*.test.*`-Dateien.
- Neue Tabellen müssen die Guardrails in `supabase/tests/database/000_guardrails.test.sql` bestehen: RLS an; Grants an `authenticated` explizit (Default: keine); keine `FOR ALL`-Policies; `unique (organization_id, id)`; Views mit `security_invoker`; Definer-Funktionen mit `search_path = ''`.
- E-Mail-Spalten: `text` mit `lower(btrim())`-Normalisierung, kein `citext` (E-38).

## Wissensgraph (graphify) – immer zuerst nutzen
Wunsch des Product Owners: Tokens sparen. Der Graph liegt versioniert in `graphify-out/` (`graph.json`,
`GRAPH_REPORT.md`, semantischer Cache, `manifest.json`); Arbeitsdateien, AST-Cache und `graph.html` bleiben lokal.
- Vor dem ersten grep/Suchen/Dateilesen zu einer Frage über Code oder Doku: `graphify query "<frage>"` (Option
  `--budget N`). Beziehungen: `graphify path "<A>" "<B>"`, einzelne Konzepte: `graphify explain "<X>"`. Rohdateien nur
  für die Stellen lesen, die der Graph genannt hat. Die Regel gehört auch in jeden Subagent-Prompt, der Code erkundet.
- Die Knoten sind überwiegend deutsch beschriftet (Doku) bzw. englisch (Code): Suchbegriffe in beiden Sprachen versuchen.
- `GRAPH_REPORT.md` nur für Architekturüberblicke lesen.
- Nach Code-Änderungen: `graphify update .` (nur AST, keine Tokens). Nach Doku-Änderungen: `/graphify . --update`
  (extrahiert nur geänderte Dokumente neu). Den aktualisierten Graphen mit committen; große Diffs an `graph.json` sind
  normal.

## Arbeitsweise pro Phase (§90)
Analyse → kurzer Plan → Datenmodell & Permissions → Tests definieren → implementieren → Tests/Lint/Typecheck → Security prüfen → UI/UX prüfen → Doku aktualisieren → Checkpoint-Bericht (§91). Nur eine Phase gleichzeitig. Keine eigenmächtigen großen Features. Offene 🟥-Entscheidungen der Phase vorher beim Product Owner klären.

## Sprache
Doku und UI-Texte: Deutsch. Code, Bezeichner, Commit-Messages: Englisch.
