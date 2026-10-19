# TeamPanel

Modulares Team-Management-SaaS für kleine und mittlere Unternehmen: Mitarbeiter, Dienstplan, Zeiterfassung,
Urlaub, Aufgaben und Team-News, als responsive Web-App/PWA.

**Status:** Architektur- und Planungsphase. Es gibt noch keinen Anwendungscode.

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [Spezifikation](docs/product/spezifikation.md) | Masterplan, Source of Truth |
| [Architektur](docs/architecture/architektur.md) | Systemaufbau, Schichten, Modulsystem, Billing, Zeiterfassung, Frontend, Betrieb |
| [Datenmodell](docs/architecture/datenmodell.md) | Tabellen, Constraints, Indizes |
| [RLS & Berechtigungen](docs/security/rls-und-berechtigungen.md) | Mandantentrennung, Permission-Katalog, Policies, Sicherheitstests |
| [Entscheidungen & Risiken](docs/architecture/entscheidungen-und-risiken.md) | Widersprüche/Lücken der Spec, Empfehlungen, offene Entscheidungen |
| [Implementierungsplan](docs/roadmap.md) | Phasen 0–16 mit Abnahmekriterien |

## Geplanter Stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · TanStack Query · Supabase (PostgreSQL, Auth, Storage,
Edge Functions, RLS) · Stripe · Resend · Cloudflare Pages · Vitest · Playwright · pgTAP · GitHub Actions
