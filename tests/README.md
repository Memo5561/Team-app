# tests

- `e2e/`: Playwright, läuft auf Desktop und Mobile (`pnpm e2e`).
- `integration/`: Tests gegen lokales Supabase (ab Phase 1).
- `lint/`: Tests der projekteigenen ESLint-Architekturregeln.

Unit-Tests liegen neben dem Code (`src/**/*.test.ts(x)`), DB-Tests in `supabase/tests/database/`.
