# TeamPanel

Modulares Team-Management-SaaS für kleine und mittlere Unternehmen: Mitarbeiter, Dienstplan, Zeiterfassung,
Urlaub, Aufgaben und Team-News, als responsive Web-App/PWA.

**Status:** Phase 0 (Repository-Fundament) umgesetzt. Als Nächstes folgt Phase 1 (Auth).

## Schnellstart

```bash
corepack enable            # pnpm 10
pnpm install
cp .env.example .env.local # Werte aus `pnpm db:start` eintragen
pnpm db:start              # Supabase lokal (Docker)
pnpm dev                   # http://127.0.0.1:5173
```

`pnpm check` (Format, Lint, Typecheck, Unit-Tests), `pnpm e2e` (Playwright), `pnpm db:test` (pgTAP).
Alles Weitere, inklusive Staging und Production: [Umgebungen](docs/architecture/umgebungen.md).

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [Spezifikation](docs/product/spezifikation.md) | Masterplan, Source of Truth |
| [Architektur](docs/architecture/architektur.md) | Systemaufbau, Schichten, Modulsystem, Billing, Zeiterfassung, Frontend, Betrieb |
| [Datenmodell](docs/architecture/datenmodell.md) | Tabellen, Constraints, Indizes |
| [RLS & Berechtigungen](docs/security/rls-und-berechtigungen.md) | Mandantentrennung, Permission-Katalog, Policies, Sicherheitstests |
| [Entscheidungen & Risiken](docs/architecture/entscheidungen-und-risiken.md) | Widersprüche/Lücken der Spec, Empfehlungen, offene Entscheidungen |
| [Implementierungsplan](docs/roadmap.md) | Phasen 0–16 mit Abnahmekriterien |
| [Umgebungen](docs/architecture/umgebungen.md) | Lokale Entwicklung, Supabase, Cloudflare Pages, GitHub-Secrets |

## Stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · TanStack Query · Supabase (PostgreSQL, Auth, Storage,
Edge Functions, RLS) · Stripe · Resend · Cloudflare Pages · Vitest · Playwright · pgTAP · GitHub Actions
