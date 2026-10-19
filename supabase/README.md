# supabase

- `migrations/`: einzige Quelle für Schemaänderungen (`pnpm exec supabase migration new <name>`). Nie manuell in Staging oder Production ändern.
- `tests/database/`: pgTAP-Tests. `000_guardrails.test.sql` prüft automatisch jede künftige Tabelle, Policy und Funktion (RLS an, keine anon-Rechte, keine `FOR ALL`-Policies, `security_invoker`-Views, gepinnter `search_path`, `unique (organization_id, id)`).
- `seed.sql`: Demo-Daten, nur lokal und in Staging.
- `functions/`: Edge Functions (ab Phase 4).
