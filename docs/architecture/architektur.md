# TeamPanel – Technische Architektur (V1)

> Status: **Entwurf zur Freigabe** · Grundlage: [`docs/product/spezifikation.md`](../product/spezifikation.md)
> Verwandte Dokumente:
> [Datenmodell](datenmodell.md) ·
> [RLS & Berechtigungen](../security/rls-und-berechtigungen.md) ·
> [Entscheidungen & Risiken](entscheidungen-und-risiken.md) ·
> [Implementierungsplan](../roadmap.md)

Dieses Dokument legt fest, **wie** TeamPanel V1 gebaut wird. Wo es von der Spezifikation abweicht oder sie präzisiert,
ist das mit einem Verweis `→ E-xx` auf [Entscheidungen & Risiken](entscheidungen-und-risiken.md) markiert.

---

## 1. Leitprinzipien

| Prinzip | Konsequenz in der Architektur |
|---|---|
| **Secure by default** (§92) | Jede Tabelle: RLS an, `anon` ohne Rechte, keine Policy = kein Zugriff. Neue Permissions werden keiner Rolle automatisch gegeben (außer Owner). |
| **Datenbank ist die Sicherheitsgrenze** (§4, §8, §51) | Mandantentrennung, Berechtigungen, Statusübergänge und Tarif-Limits werden in PostgreSQL erzwungen. Das Frontend spiegelt sie nur für UX. |
| **Eine Quelle der Wahrheit pro Fakt** | Zahlungsstatus → Stripe. Permission-/Modul-Katalog → DB-Migrationen. Arbeitszeit → `clock_events`. Preise → Stripe. Limits → `plan_entitlements`. |
| **Geringe Betriebskosten** (§43) | Kein eigener Applikationsserver. Supabase (DB, Auth, Storage, Edge Functions, Cron) + statisches Frontend auf Cloudflare Pages. |
| **Kleine, isolierte Module** (§78–80) | Feature-Module hängen nur von der Plattform-Schicht ab, nie voneinander. |
| **Keine KI in V1** (§67) | Kein LLM-SDK, keine KI-Abhängigkeit. Erweiterbarkeit nur über die allgemeine Modul-/Entitlement-Struktur. |

## 2. Systemübersicht

```
┌──────────────────────────────┐        ┌──────────────────────────────────────────────┐
│  Browser / installierte PWA  │        │  Supabase (EU-Region, z. B. Frankfurt)        │
│  React + Vite (SPA)          │  HTTPS │                                              │
│  Cloudflare Pages (statisch) │───────▶│  Auth (GoTrue)     ── JWT (sub = user_id)     │
│                              │        │  PostgREST         ── Tabellen-CRUD unter RLS │
│  supabase-js (anon key +     │        │  RPC (SQL-Funktionen) ── Mehrschritt-Logik    │
│  User-JWT, nie Service-Key)  │        │  Storage (private Buckets, signierte URLs)    │
└──────────────────────────────┘        │  Edge Functions (Deno) ── Stripe, E-Mail,     │
                                        │                            Einladungen        │
                                        │  pg_cron ── Jobs (Recurrence, Grace, Outbox)  │
                                        └───────────┬───────────────────────┬──────────┘
                                                    │ Webhooks              │ API
                                              ┌─────▼─────┐           ┌─────▼─────┐
                                              │  Stripe   │           │  Resend   │
                                              └───────────┘           └───────────┘
```

Es gibt **keinen eigenen Node-Server**. Das hält Kosten und Angriffsfläche klein. Wenn später eine öffentliche API
(§81) kommt, wird sie als eigene Schicht (Edge Functions oder separater Service) vor dieselben DB-Funktionen gesetzt.

## 3. Wo lebt welche Logik?

| Art der Logik | Ort | Begründung |
|---|---|---|
| Mandantentrennung, Lese-/Schreibrechte | **RLS-Policies** + Helper-Funktionen | Nicht umgehbar durch Client. |
| Invarianten (Ende > Start, gültige Status, eindeutige Membership, gleiche Organisation bei Fremdschlüsseln) | **Constraints** (CHECK, UNIQUE, zusammengesetzte FKs) | Billig, deklarativ, immer aktiv. |
| Mehrschritt-Operationen und Statusübergänge (Einstempeln, Dienstplan veröffentlichen, Urlaub genehmigen, Rolle ändern, Organisation anlegen) | **SQL-Funktionen (RPC)**, `SECURITY DEFINER` mit expliziter Rechteprüfung | Atomar in einer Transaktion; Audit-Eintrag und Notification in derselben Transaktion. |
| Tarif-Limits (max. Mitglieder, Standorte …) | **Trigger/RPC** mit `entitlement()`-Lookup | Kann nicht durch direkten INSERT umgangen werden. |
| Drittanbieter (Stripe, Resend), Einladungsmails, Signatur-Prüfung | **Edge Functions** | Secrets bleiben serverseitig. |
| Reine Berechnungen (Netto-Arbeitszeit, Pausensumme, Zeitzonen-Darstellung) | **TypeScript `domain/`** *und* SQL | Die DB-Berechnung ist maßgeblich. Die TS-Variante dient Live-Timer und Vorschau und wird gegen dieselben Testfälle geprüft (→ E-21). |
| Darstellung, Formvalidierung, Navigation | **Frontend** | Nur UX, nie Sicherheit. |

**Regel:** Einfache Listen und Einzel-Updates gehen direkt über PostgREST unter RLS. Alles, was mehr als eine Zeile
konsistent ändern, einen Statusübergang vollziehen oder einen Audit-Eintrag erzeugen muss, läuft über eine RPC-Funktion.

## 4. Multi-Tenancy

- **Modell:** Shared Database, Shared Schema, `organization_id` auf jeder mandantenbezogenen Tabelle (§4).
- **Durchsetzung:** RLS auf jeder Tabelle im Schema `public`. Die Basisregel ist `is_member(organization_id)`, siehe
  [RLS-Dokument](../security/rls-und-berechtigungen.md).
- **Konsistenz über Fremdschlüssel (wichtig, in der Spec nicht erwähnt → E-07):** Ein einfacher FK verhindert nicht, dass
  eine Aufgabe in Organisation A auf ein Mitglied aus Organisation B zeigt. Deshalb erhalten alle mandantenbezogenen
  Tabellen `UNIQUE (organization_id, id)` und referenzieren einander über **zusammengesetzte FKs**
  `(organization_id, membership_id) → memberships(organization_id, id)`. Damit sind Cross-Tenant-Referenzen
  strukturell unmöglich, unabhängig von RLS.
- **„Aktive Organisation“** ist reiner Client-Zustand (URL-Segment `/o/:orgSlug/...`). RLS braucht ihn nicht, weil jede
  Zeile ihre `organization_id` trägt. Jede Query filtert trotzdem explizit nach `organization_id` (Performance und
  Klarheit). Query-Keys in TanStack Query beginnen immer mit `orgId`, damit beim Organisationswechsel kein Cache
  „durchleckt“.
- **Schema-Aufteilung:**
  - `public` – über PostgREST exponierte Tabellen (alle mit RLS).
  - `private` – nicht exponierte Helper-Funktionen, Outbox, Stripe-Event-Log, interne Jobs.
  - `auth`, `storage` – von Supabase verwaltet.

## 5. Identität: Account ≠ Mitgliedschaft ≠ Mitarbeiterdatensatz

```
auth.users ──1:1── profiles                (globaler Account: Login, Sprache, Avatar)
     │
     └──1:n── memberships ──n:1── organizations
                  │                (Mitgliedschaft = Mitarbeiterdatensatz der Firma)
                  ├── employee_profiles   (firmenbezogene Stammdaten: Name, Personalnr., Eintritt …)
                  ├── role_id → roles
                  ├── team_members        (n:m, V1: genau ein Hauptteam)
                  └── membership_locations (Standortzuordnung / Standortbeschränkung)
```

Entscheidungen (Details in [Datenmodell](datenmodell.md)):

- `memberships.user_id` ist **nullable** (→ E-04). Ein Mitarbeiter kann im Dienstplan stehen, bevor oder ohne dass er
  einen Account hat (Lehrling ohne E-Mail, Aushilfe). Status `invited` mit `user_id IS NULL`, nach Annahme der
  Einladung wird `user_id` gesetzt.
- Der **Name des Mitarbeiters gehört der Firma** (`employee_profiles.first_name/last_name`), nicht dem globalen Account.
  So bleiben Arbeitszeitnachweise auch nach Löschung des Accounts korrekt zuordenbar. Die Firma ist dafür
  datenschutzrechtlich Verantwortliche, TeamPanel ist Auftragsverarbeiter (→ E-17).
- `invitations` ist eine eigene Tabelle (fehlt in §49). Sie enthält einen gehashten Token, ein Ablaufdatum und die
  Ziel-Membership. Das Annehmen läuft über eine RPC-Funktion, die E-Mail und Token prüft.

## 6. Autorisierung – vier Schranken

Jeder Zugriff auf Moduldaten muss **alle vier** Schranken passieren. Jede wird in der DB geprüft und im Frontend
gespiegelt:

```
1. Tarif erlaubt es?          entitlement(org, 'documents_enabled')         ← plan_entitlements + Overrides
2. Modul ist aktiviert?       module_enabled(org, 'documents')              ← organization_modules
3. Rolle hat Permission?      has_permission(org, 'documents.view')        ← role_permissions
4. Datensatz im Scope?        self / team / all  ∩  Standortbeschränkung   ← memberships, team_members, membership_locations
```

- **Permission-Scopes** (präzisiert die Spec → E-08): Lese- *und* Verwaltungsrechte für personenbezogene Daten
  existieren in den Abstufungen `.self`, `.team` und `.all`. Beispiele: `schedule.manage.team` und
  `schedule.manage.all`, nicht nur `schedule.manage`. Nur so kann ein Teamleiter „den Dienstplan seines Teams
  verwalten“ (§6).
- **Standortbeschränkung** (§15): `memberships.location_scope = 'all' | 'assigned'`. Bei `assigned` reduziert sich
  auch `.all` auf die zugewiesenen Standorte. Default ist `assigned` (secure by default), Owner hat `all`.
- **Nicht delegierbare Rechte** (→ E-09): `billing.manage`, `organization.transfer_ownership` und
  `organization.delete` sind `owner_only` und können keiner anderen Rolle zugewiesen werden.
- **Eskalationsschutz** (→ E-10): Wer `roles.manage` hat, darf nur Permissions vergeben, die er selbst besitzt. Er darf
  die eigene Rolle nicht ändern und niemanden zum Owner machen.

Vollständige Regeln und SQL-Skizzen: [RLS & Berechtigungen](../security/rls-und-berechtigungen.md).

## 7. Modulsystem

Zwei Hälften, die per Test synchron gehalten werden (→ E-12):

**DB-Katalog** (Migrationen, maßgeblich für Sicherheit):

```
modules(key, required_entitlement, default_enabled, sort_order, is_core)
permissions(key, module_key, scope, owner_only, description_key)
organization_modules(organization_id, module_key, enabled, enabled_at, enabled_by)
```

**Frontend-Registry** (`src/modules/registry.ts`, maßgeblich für UI):

```ts
export const timeTrackingModule = defineModule({
  key: 'time_tracking',
  requiredEntitlement: null,            // in allen Tarifen
  navigation: [{ section: 'work', labelKey: 'nav.time', icon: 'clock', to: 'time', permission: 'time.view.self' }],
  mobileTab: { slot: 'time' },
  routes: () => import('./time/routes'),  // Lazy Loading pro Modul (§63)
  widgets: [/* Dashboard-Widgets dieses Moduls */],
});
```

- Navigation, Routen und Widgets werden aus `registry ∩ aktivierte Module ∩ Entitlements ∩ Permissions` berechnet.
- Ein Contract-Test prüft, dass jeder `key` und jede Permission der Registry in der DB existiert und umgekehrt.
- **Deaktivieren löscht keine Daten** (§12). Die RLS-Policies der Modultabellen prüfen `module_enabled()`. Ein
  deaktiviertes Modul ist damit auch serverseitig gesperrt und nicht nur ausgeblendet. Ausnahme: Owner-Export
  (→ E-13).
- Kernbereiche ohne Abschaltmöglichkeit (`is_core`): Mitarbeiter, Einstellungen, Benachrichtigungen. Teams und
  Standorte sind Konfiguration, kein abschaltbares Modul.
- Marketplace-Fähigkeit (§80): Module kommunizieren nur über Plattform-Dienste (Notifications, Audit, Files,
  Membership-Lookup), nie direkt miteinander. Neue Module = neue Zeilen im Katalog + neuer Ordner + neue Migrationen.

## 8. Entitlements, Tarife und Billing

```
plans(key: free|pro|business, stripe_product_id, is_public)
plan_prices(plan_key, stripe_price_id, interval)            ← Preise leben in Stripe (§40)
plan_entitlements(plan_key, entitlement_key, value jsonb)   ← z. B. max_members = 10
organization_entitlement_overrides(org, key, value, reason, expires_at)  ← Pilotkunden, Kulanz
subscriptions(org, stripe_customer_id, stripe_subscription_id, plan_key, status, current_period_end, …)
stripe_events(event_id PK, type, received_at, processed_at, error)       ← Idempotenz (§41)
```

- `entitlement(org, key)` liefert Override → Plan-Wert → Default „aus“ (secure by default).
- Code fragt **nie** nach dem Tarifnamen, sondern immer nach einem Entitlement (§37).
- **Stripe-Webhook** (Edge Function): Signatur prüfen → `INSERT INTO stripe_events … ON CONFLICT DO NOTHING`
  (Idempotenz) → das Subscription-Objekt **frisch von Stripe abrufen**, statt dem Event-Payload zu vertrauen
  (löst das Problem verspäteter oder vertauschter Events, §74) → Spiegel in `subscriptions` aktualisieren → Audit.
- **Zugriffsstatus der Organisation** (→ E-15) wird aus Stripe-Status + Zeit abgeleitet und nicht separat gepflegt:

  | Stripe `status` | Abgeleiteter `access_state` |
  |---|---|
  | kein Abo (Free) / `active` / `trialing` | `active` |
  | `past_due`, weniger als N Tage seit erstem Fehlschlag | `grace_period` |
  | `past_due` länger als N Tage / `unpaid` | `restricted` |
  | `canceled` | fällt auf **Free** zurück (nicht löschen) |

- Im Modus `restricted` gilt: Lesen erlaubt, Ein- und Ausstempeln erlaubt (gesetzliche Aufzeichnungspflicht, → E-16),
  Verwaltungsänderungen und das Einladen neuer Mitglieder gesperrt.
- **Downgrade über Limit** (→ E-14): Nichts wird gelöscht. Neue Datensätze über dem Limit werden blockiert und ein
  Banner zeigt, was zu tun ist. Pro-only-Konfiguration (eigene Rollen) bleibt wirksam, ist aber nur noch lesbar.

## 9. Zeiterfassung (kritischster Bereich)

- **`clock_events` ist append-only** (§17): kein UPDATE und kein DELETE für irgendeine Client-Rolle. Erzwungen durch
  fehlende Policies und einen Trigger.
- **Zeitstempel kommen vom Server** (`now()` in der RPC-Funktion `clock(action)`), nie vom Client. Sonst wäre die
  Zeiterfassung manipulierbar (→ E-19).
- **Zustandsmaschine in der DB:** `clock()` sperrt den Zustand des Mitglieds (`SELECT … FOR UPDATE` auf
  `time_clock_state`) und erlaubt nur gültige Übergänge:

  ```
  OFFLINE/FINISHED ──CLOCK_IN──▶ WORKING ──BREAK_START──▶ ON_BREAK
         ▲                          │  ▲                       │
         └────────CLOCK_OUT─────────┘  └───────BREAK_END───────┘
                (aus ON_BREAK: CLOCK_OUT beendet implizit die Pause)
  ```

  Doppelklick, zwei Geräte und Netzwerk-Retry führen so nicht zu doppelten Events. Dazu kommt ein optionaler
  `client_request_id` als Idempotenzschlüssel.
- **`time_entries`** ist eine **abgeleitete** Tabelle: eine Zeile pro Arbeitssitzung (CLOCK_IN…CLOCK_OUT) mit
  `gross_seconds`, `break_seconds`, `net_seconds`. Sie wird in derselben Transaktion wie das Event aktualisiert und
  ist für Clients nur lesbar. So gibt es keine zweite Wahrheit (→ E-20).
- **Korrekturen** (§18): `time_adjustment_requests` (pending → approved/rejected). Eine Genehmigung erzeugt
  **zusätzliche** Events mit `source = 'correction'` und `supersedes_event_id`. Das Original bleibt sichtbar. Danach
  wird `time_entries` neu berechnet und ein Audit-Eintrag geschrieben.
- **Vergessenes Ausstempeln:** Eine offene Sitzung über einem konfigurierbaren Schwellwert (Default 16 h) wird
  markiert (`needs_review`) und erscheint beim Manager. V1 schließt Sitzungen **nicht** automatisch, weil das die
  Zeiterfassung verfälschen würde (→ E-22).
- **Tageszuordnung:** Eine Sitzung gehört zum lokalen Datum ihres CLOCK_IN in der Zeitzone des Standorts bzw. der
  Organisation.

## 10. Zeit und Zeitzonen (§65)

- Alle Zeitpunkte sind `timestamptz` (UTC gespeichert).
- **Schichten speichern `starts_at`/`ends_at` als `timestamptz`**, nicht `date + start_time + end_time` (→ E-18).
  `business_date` (lokales Datum des Schichtbeginns) wird als generierte bzw. per Trigger gepflegte Spalte für
  Wochenansicht und Indizes mitgeführt. Damit funktionieren 22:00–06:00 und Sommerzeitwechsel korrekt.
- **Zeitzonen-Auflösung:** `location.timezone` → `organization.timezone`. Ganztägige Dinge (Urlaub, Verfügbarkeit)
  sind `date` ohne Zeitzone.
- Frontend: `date-fns` + `date-fns-tz` (klein, tree-shakeable). Keine Rechnungen mit nativen `Date`-Offsets.

## 11. Benachrichtigungen und E-Mail

- **In-App:** `notifications`-Tabelle (pro Empfänger-Membership), paginiert, `read_at`. Sie wird von RPC-Funktionen in
  derselben Transaktion wie das auslösende Ereignis geschrieben.
- **Aktualisierung:** In V1 per Polling (TanStack Query `refetchInterval` ~60 s, plus Refetch bei Fensterfokus) statt
  Realtime. Das ist günstiger und robuster. Realtime erst einsetzen, wenn es echten Bedarf gibt (§43 „nur wo sinnvoll“).
- **E-Mail über Outbox-Pattern:** Die RPC schreibt in `private.email_outbox`. pg_cron ruft minütlich eine Edge Function
  auf, die versendet (Resend), mit Retry/Backoff und `failed`-Status. So gehen keine E-Mails verloren, und keine
  E-Mail wird verschickt, wenn die Transaktion zurückgerollt wurde.
- **Präferenzen:** `notification_preferences(membership_id, event_type, channel, enabled)`. Fehlt ein Eintrag, greift
  ein sinnvoller Default aus dem Event-Katalog.
- E-Mails enthalten **keine sensiblen Inhalte** (keine Abwesenheitsgründe), nur einen Link in die App.

## 12. Dateien (Logo, Avatare; später Dokumente und Formular-Uploads)

- Ausschließlich **private Buckets**. Pfadschema: `{organization_id}/{bereich}/{uuid}.{ext}`.
- Storage-RLS prüft das erste Pfadsegment gegen `is_member()` und das Bereichsrecht.
- Auslieferung über **kurzlebige signierte URLs** (§32).
- Upload-Validierung: erlaubte MIME-Typen pro Bucket (Bucket-Konfiguration), Größenlimit pro Bucket und pro
  Entitlement (Speicherkontingent). Keine SVG-Uploads (XSS). Bilder werden beim Anzeigen nie als HTML
  interpretiert.
- Malware (§53): V1 erlaubt nur Bilder und PDF. Ein Virenscan (z. B. ClamAV als Edge-Job) kommt mit dem
  Dokumente-Modul in Phase 2 der Produktvision (→ E-25).

## 13. Audit Log

- `audit_logs` wird **nur** über `private.write_audit(...)` geschrieben (aus RPCs und Triggern). Clients haben kein
  INSERT, UPDATE oder DELETE (§52).
- Lesen nur mit `audit.view`. Aufbewahrung über das Entitlement `audit_log_retention_days`, Bereinigung per pg_cron.
- `before`/`after` enthalten nur die geänderten Felder, keine sensiblen Freitexte (Datenminimierung).
- Die IP-Adresse (§52 optional) wird in V1 **nicht** gespeichert. Sie ist ein personenbezogenes Datum ohne klaren
  Zweck. Login-Anomalien stehen in den Supabase-Auth-Logs.

## 14. Frontend-Architektur

```
src/
  app/            Bootstrapping, Router, Provider, Layouts (Desktop-Sidebar / Mobile-Bottom-Nav), Error Boundary
  platform/       Plattform-Schicht (Ebene A): auth, organizations, permissions, entitlements,
                  modules (Registry-Runtime), notifications, audit, billing, files, onboarding
  modules/        Feature-Module (Ebene B): employees, teams, locations, time, schedule, leave,
                  tasks, announcements, dashboard (+ später documents, forms, reports)
    <modul>/      components/ hooks/ queries/ mutations/ schemas/ types/ domain/ permissions.ts routes.ts index.ts
  components/ui/  shadcn/ui-Basiskomponenten (nur Darstellung)
  lib/            supabase-Client, env (Zod-validiert), Fehler-Mapping, Datum/Zeitzone, Query-Client
  i18n/           de.json (V1), Typen für Keys
  styles/         Design Tokens (CSS-Variablen), Tailwind-Theme
```

Regeln (per ESLint `import/no-restricted-paths` erzwungen):

- `modules/*` darf `platform/*`, `components/*` und `lib/*` importieren, **nicht** andere `modules/*`.
  Gemeinsames gehört in `platform`.
- `components/ui` kennt keine Domäne.
- Datenzugriff nur in `queries/`/`mutations/` (bzw. `platform/*/api.ts`), nie in Komponenten. Das ist die spätere
  Andockstelle für eine öffentliche API (§81).
- **Typen** werden aus der DB generiert (`supabase gen types typescript`) und nicht von Hand gepflegt.
- **Fehler-Mapping** (§61): `lib/errors.ts` übersetzt Postgres-/PostgREST-Codes und eigene `RAISE`-Codes
  (`TP001 limit_reached` …) in i18n-Keys. Rohfehler gehen nur ans Error-Tracking.
- **i18n** (§66): `i18next` + `react-i18next`, ESLint-Regel gegen hartkodierte JSX-Texte.
- **Design Tokens** (§48): CSS-Variablen (shadcn-Konvention). Firmenfarbe (Branding-Entitlement) überschreibt nur
  `--brand`, nie Kontrastfarben (Accessibility).
- **Routing:** `/login`, `/signup`, `/onboarding/*`, `/invite/:token`, `/o/:orgSlug/<modul>/...`. Guards prüfen
  Session → Membership → Modul → Permission und dienen nur der UX.
- **Formulare:** React Hook Form + Zod. Zod-Schemas spiegeln DB-Constraints, die DB bleibt maßgeblich.
- **Auth-Token-Speicherung** (→ E-24): supabase-js speichert Tokens standardmäßig in `localStorage`. Das ist
  akzeptabel mit strikter CSP, kurzer JWT-Laufzeit und ohne `dangerouslySetInnerHTML`. Bearer-Tokens statt Cookies
  machen CSRF-Schutz für die API weitgehend überflüssig.

## 15. Umgebungen, Deployment, CI

| Umgebung | Datenbank | Frontend | Stripe | E-Mail |
|---|---|---|---|---|
| **local** | `supabase start` (Docker) | `vite dev` | Test-Keys + `stripe listen` | Inbucket/Mailpit (lokal) |
| **staging** | eigenes Supabase-Projekt (EU) | Cloudflare Pages Preview/Branch | Test-Mode | Resend, Test-Domain |
| **production** | eigenes Supabase-Projekt (EU, Pro-Plan) | Cloudflare Pages Production | Live-Mode | Resend, Prod-Domain |

- **Migrationen** nur über `supabase/migrations/*.sql` (§76). Deployment auf staging/production ausschließlich durch
  CI (`supabase db push`) nach grünen Tests. Keine manuellen Änderungen in Produktion.
- **CI (GitHub Actions)** pro PR: install → lint → typecheck → unit tests → `supabase start` → `supabase db reset` →
  pgTAP-Tests (RLS) → Integrationstests → Build → Playwright (Smoke) → Typ-Drift-Check (generierte Typen müssen
  aktuell sein).
- **Secrets** nur in GitHub Environments und Supabase-/Cloudflare-Konfiguration. `.env.example` ohne Werte. Das
  Frontend kennt nur `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (öffentlich by design).
  `gitleaks` läuft in CI.

## 16. Observability (§62)

- **Frontend-Fehler:** Sentry (EU-Datenregion) mit PII-Scrubbing (`sendDefaultPii: false`, keine Request-Bodies).
- **Edge Functions:** strukturierte Logs ohne Personendaten (nur IDs). Fehlgeschlagene Webhooks bleiben in
  `stripe_events.error` sichtbar.
- **Health Check:** Edge Function `health` (DB-Ping) für Uptime-Monitoring (z. B. Better Stack Free).
- **DB-Performance:** Supabase Query Performance / `pg_stat_statements`, Index-Advisor vor jedem Release.

## 17. Erweiterbarkeit ohne V1-Ballast

| Zukunft (Spec) | Was V1 dafür bereits tut | Was V1 bewusst **nicht** tut |
|---|---|---|
| Öffentliche API (§81) | Datenzugriff gekapselt; Logik in DB-RPCs, die jeder Caller nutzen kann | Keine API-Keys, kein OpenAPI |
| Webhooks (§82) | Domänen-Ereignisse fließen durch die Outbox (`private.outbox`) | Keine Webhook-Endpunkte |
| KI (§83) | Jeder Zugriff läuft über RLS mit User-JWT. Ein späterer KI-Layer nutzt dieselben Rechte; Entitlements für `ai_module` sind möglich | Kein LLM, kein Embedding, keine KI-Abhängigkeit |
| Marketplace (§80) | Modul-Katalog in der DB, Registry, Modul-Isolation | Kein Plugin-Laden zur Laufzeit |
| Mehrere Teams pro Person (§14) | `team_members` n:m mit `is_primary` | UI erlaubt nur ein Hauptteam |
| Offline-Clock-In (§71 Phase 14) | `client_request_id` als Idempotenzschlüssel | Kein Offline-Queueing |

## 18. Laufende Kosten (Richtwerte, vor Entscheidung aktuelle Preislisten prüfen)

| Posten | Start (Pilot) | Bemerkung |
|---|---|---|
| Supabase Production (Pro) | ~25 USD/Monat | Tägliche Backups enthalten; PITR optional gegen Aufpreis |
| Supabase Staging | 0–10 USD/Monat | Free-Projekte pausieren nach Inaktivität (→ E-27) |
| Cloudflare Pages | 0 € | |
| Resend | 0 € bis ca. 3.000 Mails/Monat | |
| Sentry | 0 € (Developer-Tier) | |
| Stripe | nur Transaktionsgebühren | + ggf. Stripe Tax |
| Domain | ~1–2 €/Monat | |
| **Summe** | **≈ 30–40 €/Monat** | |
