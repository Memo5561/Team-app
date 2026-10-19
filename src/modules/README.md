# src/modules

Feature-Module (Spec Ebene B), je ein Ordner: `components/ hooks/ queries/ mutations/ schemas/ types/ domain/ permissions.ts routes.ts index.ts`.
Ein Modul importiert nur `@/platform`, `@/components`, `@/lib`, `@/i18n`, `@/types` und sich selbst, **nie** ein anderes Modul (per ESLint erzwungen). Datenzugriff nur in `queries/` und `mutations/`. Erste Module ab Phase 4.
