# TeamPanel – Projektregeln für Claude

Modulares Team-Management-SaaS für KMU (AT/EU). Responsive Web-App/PWA. **Keine KI in V1.**

## Zuerst lesen (in dieser Reihenfolge)
1. `docs/product/spezifikation.md` – **Source of Truth**
2. `docs/architecture/entscheidungen-und-risiken.md` – Präzisierungen/Abweichungen (E-xx) und offene Entscheidungen
3. `docs/roadmap.md` – Phasen, aktueller Stand, Abnahmekriterien
4. `docs/architecture/architektur.md`, `docs/architecture/datenmodell.md`, `docs/security/rls-und-berechtigungen.md`

## Aktueller Stand
- Architektur und Plan liegen als Entwurf vor. **Phase 0 ist noch nicht begonnen.**
- Befehle (`pnpm check`, `pnpm db:test` …) werden in Phase 0 eingerichtet und hier ergänzt.

## Nicht verhandelbar
- Sicherheit liegt in der Datenbank: RLS auf jeder `public`-Tabelle, zusammengesetzte FKs `(organization_id, x_id)`, Statusübergänge/Genehmigungen nur über `SECURITY DEFINER`-RPCs mit `set search_path = ''`. Frontend-Checks sind nur UX.
- Secure by default: neue Tabelle/Permission/Modul = kein Zugriff, bis explizit erlaubt. Owner hat implizit alle Permissions.
- Code fragt Entitlements ab (`entitlement('max_members')`), nie Tarifnamen.
- `clock_events` ist append-only, Zeitstempel kommen vom Server, `time_entries` ist abgeleitet.
- Zeitpunkte als `timestamptz` (UTC), Darstellung in Standort-/Organisationszeitzone; Schichten als `starts_at`/`ends_at`.
- Keine hartkodierten UI-Texte (i18n-Keys), keine hartkodierten Farben (Design Tokens).
- Keine Rohfehler an Nutzer; Fehlercodes über `src/lib/errors.ts` mappen.
- Keine Secrets im Repo; Service-Role-Key nie im Frontend.
- DB-Änderungen nur per Migration in `supabase/migrations/`; jede neue Mandantentabelle bekommt pgTAP-Isolationstests.
- Feature-Module (`src/modules/*`) importieren nur aus `src/platform`, `src/components`, `src/lib` – nie aus anderen Modulen.

## Arbeitsweise pro Phase (§90)
Analyse → kurzer Plan → Datenmodell & Permissions → Tests definieren → implementieren → Tests/Lint/Typecheck → Security prüfen → UI/UX prüfen → Doku aktualisieren → Checkpoint-Bericht (§91). Nur eine Phase gleichzeitig. Keine eigenmächtigen großen Features. Offene 🟥-Entscheidungen der Phase vorher beim Product Owner klären.

## Sprache
Doku und UI-Texte: Deutsch. Code, Bezeichner, Commit-Messages: Englisch.
