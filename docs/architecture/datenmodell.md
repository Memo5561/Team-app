# TeamPanel – Datenmodell V1

> Status: **Freigegeben am 2026-10-19** · Ergänzt §49/§50 der [Spezifikation](../product/spezifikation.md).
> Das Dokument beschreibt das Zielmodell. Jede Tabelle entsteht erst in der Phase, die sie braucht
> (siehe [Implementierungsplan](../roadmap.md)), immer per versionierter Migration.

## 1. Konventionen

| Thema | Regel |
|---|---|
| Primärschlüssel | `id uuid primary key default gen_random_uuid()` (Ausnahme: `audit_logs.id bigint generated always as identity`) |
| Mandant | `organization_id uuid not null`, plus `unique (organization_id, id)` auf jeder Mandantentabelle |
| Fremdschlüssel innerhalb eines Mandanten | **zusammengesetzt**: `foreign key (organization_id, membership_id) references memberships (organization_id, id)` → Cross-Tenant-Referenzen sind unmöglich (E-07) |
| Zeitpunkte | `timestamptz`; reine Kalendertage als `date` |
| Zeitstempel | `created_at timestamptz not null default now()`, `updated_at` per Trigger `private.set_updated_at()` |
| Status-/Enum-Felder | `text` + `CHECK (status in (...))` statt Postgres-`enum`, weil Migrationen damit einfacher bleiben (§50 „gültige Statuswerte“) |
| E-Mail | `text` mit `CHECK (email = lower(btrim(email)))`. Eingaben werden in RPCs mit `lower(btrim(...))` normalisiert, Vergleiche mit `auth.users.email` immer über `lower(...)`. **Kein `citext`**: In `search_path = ''`-Funktionen fallen seine Operatoren still auf case-sensitiven `text`-Vergleich zurück (E-38). |
| Löschen | Mandantendaten werden archiviert (`status = 'archived'` / `archived_at`), nicht gelöscht. Physische Löschung nur über kontrollierte Jobs (Organisation löschen, DSGVO). FKs auf Mandantendaten: `on delete restrict`, außer bei reinen Kind-Tabellen (`cascade`). |
| Indizes | Jede FK-Spalte ist indiziert. Zusätzlich gibt es zusammengesetzte Indizes für die Hauptabfragen (unten pro Tabelle). |
| Namen | Tabellen im Plural, `snake_case`. „Mitarbeiter“ heißt im Code durchgängig **membership** (`membership_id`), nicht `employee_id` (E-04). |

## 2. Übersicht

```
PLATTFORM                    ORGANISATION                 MODULE
───────────                  ────────────                 ──────
profiles                     organizations                time:      time_clock_state, clock_events,
plans                        locations                               time_entries, time_adjustment_requests
plan_prices                  memberships                  schedule:  shifts, schedule_publications, availability
plan_entitlements            employee_profiles            leave:     leave_types, leave_requests
entitlement_definitions      membership_locations         tasks:     tasks, task_assignments, task_checklist_items,
organization_entitlement_    teams                                   task_templates, task_template_items,
  overrides                  team_members                            task_recurrences
subscriptions                invitations                  news:      announcements, announcement_audiences,
modules                      roles                                   announcement_reads
organization_modules         role_permissions             dashboard: dashboard_layouts
permissions                  notifications                ─ nach MVP ─
feature_flags                notification_preferences     documents: document_folders, documents, document_permissions
organization_feature_flags   audit_logs                   forms:     form_templates, form_fields, form_submissions
private.stripe_events                                     schedule:  shift_swap_requests
private.email_outbox
private.outbox
```

Abgleich mit §49: `users` → `auth.users` + `profiles`. `permissions` und `modules` sind **globale** Kataloge ohne
`organization_id`. Gegenüber §49 **neu**: `invitations`, `team_members`, `membership_locations`,
`time_clock_state`, `schedule_publications`, `task_template_items`, `task_recurrences`,
`announcement_audiences`, `notification_preferences`, `dashboard_layouts`, `plans`, `plan_prices`,
`entitlement_definitions`, `organization_entitlement_overrides`, `feature_flags`,
`organization_feature_flags`, `stripe_events`, `email_outbox`, `outbox`. Begründungen in den Abschnitten unten.

## 3. Plattform und Organisation

### profiles (1:1 zu `auth.users`, kein Mandant)
Seit Phase 1 (Migration `20261019185317_profiles.sql`).

| Spalte | Typ | Regeln |
|---|---|---|
| id | uuid PK | FK → `auth.users(id)` on delete cascade |
| display_name | text | not null; CHECK `profiles_display_name_valid`: 1–100 Zeichen, ohne führende oder folgende Leerzeichen (`= btrim(...)`), keine Steuerzeichen |
| locale | text | not null, default `'de'`; CHECK `profiles_locale_supported`: `locale in ('de')` (wächst mit den UI-Sprachen) |
| avatar_path | text | null |
| created_at, updated_at | timestamptz | not null, default `now()`; `updated_at` per Trigger `profiles_set_updated_at` |

Globale Account-Daten. Firmenbezogene Namen stehen in `memberships`.

- **Anlage nur per Trigger:** `on_auth_user_created` (AFTER INSERT auf `auth.users`) ruft
  `private.handle_new_user()` auf (`SECURITY DEFINER`, `search_path = ''`). Der Name kommt aus
  `raw_user_meta_data->>'display_name'`, normalisiert mit `private.normalize_display_name()` (Folgen von Leer- und
  Steuerzeichen → ein Leerzeichen, trimmen, auf 100 Zeichen kürzen). Fehlt er, gilt der normalisierte lokale Teil der
  E-Mail-Adresse, sonst `'user'`. `locale` nur, wenn unterstützt, sonst `'de'`. Metadaten, die kein JSON-Objekt sind,
  werden ignoriert. `ON CONFLICT DO NOTHING`; der Trigger wirft nie einen Fehler, damit ein Sign-up nicht mit einem
  Rohfehler abbricht. Konten, die vor der Migration existierten, bekommen ihr Profil per einmaligem Backfill in
  derselben Migration (gleiche Regeln, idempotent).
- Die Zeile entsteht schon vor der E-Mail-Bestätigung; unbestätigte Konten werden später bereinigt (E-45). Hat
  sich jemand mit fremder Adresse registriert, bleibt sein Name stehen, bis das Profil bearbeitbar ist (E-46,
  akzeptiertes Restrisiko).
- **Rechte in Phase 1:** RLS an, Policy `profiles_select_own` (`id = auth.uid()`), Grant nur `SELECT` an
  `authenticated`. Kein `INSERT`/`UPDATE`/`DELETE`, bis eine spätere Phase das Profil bearbeitbar macht.
- Das Registrierungsformular normalisiert den Namen vorab nach derselben Regel (`src/platform/auth/schemas.ts`).
  Es ist dabei etwas strenger: Unicode-Leerzeichen (z. B. geschützte Leerzeichen) erkennt die Datenbank je nach
  Locale nicht als Leerzeichen, das Formular schon.

### Eigene Trigger auf `auth.users`
`auth.users` gehört Supabase Auth (GoTrue); ihre Spalten ändern wir nicht. Wir hängen nur Trigger an, deren
Funktionen in `private` liegen (`SECURITY DEFINER`, `search_path = ''`, für `anon`/`authenticated` nicht
ausführbar).

| Trigger | Zeitpunkt | Funktion | Wirkung |
|---|---|---|---|
| `on_auth_user_created` | AFTER INSERT | `private.handle_new_user()` | legt `profiles` an (siehe oben) |
| `on_auth_user_first_confirmation` | BEFORE UPDATE (ohne Spaltenliste) | `private.clear_password_before_first_confirmation()` | löscht ein Passwort, das vor der ersten Bestätigung gesetzt wurde (E-46) |

`on_auth_user_first_confirmation` (seit Phase 1, Migration
`20261019204325_clear_password_before_first_confirmation.sql`) setzt `encrypted_password := null`, wenn
- `old.email_confirmed_at is null and new.email_confirmed_at is not null` (erste Bestätigung),
- `old.confirmation_sent_at is not null` (eine Bestätigungs-E-Mail ging hinaus, also Selbstregistrierung) und
- `new.encrypted_password is not distinct from old.encrypted_password` (setzt die bestätigende Anweisung selbst
  ein Passwort, bleibt es; das geht nur mit privilegiertem SQL).

`NULL` bedeutet für GoTrue „kein Passwort“, wie `''`. Unberührt bleiben `admin.createUser` mit
`email_confirm: true` (keine Mail, `confirmation_sent_at` leer), Passwörter aus `updateUser` und „Passwort
vergessen“ nach der Bestätigung (sie ändern `email_confirmed_at` nicht) und alle anderen Updates. Der Trigger beruht
auf der Annahme, wie GoTrue bei Registrierung und Bestätigung schreibt. Sie ist im Kommentar der Migration mit
Quellstellen belegt (v2.197.0). Ob sie nach einem Update von Supabase Auth noch stimmt, prüfen die
Integrationstests gegen das echte GoTrue (`tests/integration/password-guard.test.ts`: Bestätigung über die Mail des
Angreifers, eine spätere Registrierung per Link, den Anmeldelink von `/login` und „Passwort vergessen“); pgTAP
spielt GoTrues Anweisungen nur nach. Die Integrationstests sehen nur die Version, die die gepinnte Supabase CLI
startet. Das gehostete Supabase Auth (Staging, Production) wird unabhängig davon aktualisiert; dort ist der Nachweis
E-46 aus `umgebungen.md` §2.4 (Test nach dem Deployment, Schritt 4) nach Auth-Updates zu wiederholen.

Der Trigger hat bewusst keine Spaltenliste (`UPDATE OF email_confirmed_at`): PostgreSQL legt für jede gelistete
Spalte eine Abhängigkeit an und verweigert dann `ALTER COLUMN … TYPE` und `DROP COLUMN` darauf. Das würde
Migrationen von Supabase Auth an seiner eigenen Tabelle blockieren. Die Funktion prüft alte und neue Werte selbst.

### organizations
| Spalte | Typ | Regeln |
|---|---|---|
| id | uuid PK | |
| slug | text | unique, `^[a-z0-9-]{3,48}$` (nur Kleinbuchstaben), für URLs |
| name | text | not null, 1–120 |
| industry | text | null (Freitext/Katalog, nur Statistik) |
| country | text | not null, ISO-3166-1 alpha-2, default `'AT'` |
| timezone | text | not null, default `'Europe/Vienna'`, CHECK gegen `pg_timezone_names` per Trigger |
| default_locale | text | not null, default `'de'` |
| size_bucket | text | CHECK in (`solo`,`2_5`,`6_10`,`11_30`,`31_100`,`100_plus`) |
| logo_path, brand_color | text | null; `brand_color` CHECK `^#[0-9a-f]{6}$` |
| onboarding_completed_at | timestamptz | null |
| deletion_requested_at, deletion_scheduled_for | timestamptz | null (§55-Workflow) |
| created_by_user_id | uuid | FK → auth.users, on delete set null |

### locations
`id, organization_id, name, address_line1, address_line2, postal_code, city, country, timezone (null = Organisation), status ('active'|'archived')`
- unique `(organization_id, lower(name))` für aktive Standorte (partieller Index)
- Limit `max_locations` per Trigger (zählt `status = 'active'`)

### memberships – Mitgliedschaft **und** Mitarbeiterdatensatz
| Spalte | Typ | Regeln |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid | not null |
| user_id | uuid | **null** (Mitarbeiter ohne Account / noch nicht angenommen, E-04); FK → auth.users on delete set null |
| role_id | uuid | not null, FK `(organization_id, role_id)` → roles |
| status | text | `invited`, `active`, `inactive`, `archived` |
| first_name, last_name | text | not null, firmenbezogen (überdauert Account-Löschung, E-17) |
| avatar_path | text | null |
| location_scope | text | `all` \| `assigned`, default `assigned` (E-08) |
| joined_at, archived_at | timestamptz | null |

- `unique (organization_id, user_id) where user_id is not null` (§50 „eindeutige Membership“)
- CHECK: `status = 'active' → user_id is not null`
- Index `(organization_id, status)`, `(user_id) where status = 'active'` (für RLS-Helper)
- Limit `max_members` zählt `status in ('invited','active')` (E-05)
- **Owner-Schutz:** Constraint-Trigger (deferred), der sicherstellt, dass jede Organisation mindestens eine aktive
  Membership mit Systemrolle `owner` hat (E-03)
- Sichtbarkeit: Name, Avatar, Status, Team und Rolle sind ein „Verzeichnis“ und für alle aktiven Mitglieder im
  Standort-Scope sichtbar (für Dienstplan und Aufgabenzuweisung nötig, E-11). Kontakt- und HR-Daten liegen getrennt
  in `employee_profiles`.

### employee_profiles (1:1 zu memberships, HR-/Kontaktdaten)
`membership_id (PK, FK (organization_id, membership_id)), organization_id, email text (normalisiert), phone, personnel_number, entry_date date`
- unique `(organization_id, email) where email is not null`
- unique `(organization_id, personnel_number) where personnel_number is not null`
- Lesen: eigene Zeile oder `employees.view.team/all` im Scope. Schreiben: `employees.edit` im Scope; eigene
  Telefonnummer darf der Mitarbeiter selbst ändern.

### membership_locations
`organization_id, membership_id, location_id, is_primary bool` · PK `(membership_id, location_id)` ·
unique `(membership_id) where is_primary`

### teams
`id, organization_id, name, description, location_id null, status ('active'|'archived')`
- `manager_id` aus §14 wird durch `team_members.is_lead` ersetzt (E-06)

### team_members
`organization_id, team_id, membership_id, is_lead bool default false, is_primary bool default true`
- PK `(team_id, membership_id)`, unique `(membership_id) where is_primary` (V1: genau ein Hauptteam, später mehrere)

### invitations
| Spalte | Regeln |
|---|---|
| id, organization_id, membership_id | FK auf die `invited`-Membership |
| email text | not null, normalisiert (`lower(btrim(...))`) |
| token_hash bytea | unique; nur der SHA-256-Hash wird gespeichert, der Klartext-Token steht nur in der E-Mail bzw. im Link |
| expires_at | default `now() + 7 days` |
| accepted_at, revoked_at | null |
| invited_by_membership_id | FK |

Annahme per RPC `accept_invitation(token)`: Hash prüfen, Ablauf prüfen, E-Mail des eingeloggten Users muss passen
(bei E-Mail-Einladung), Membership aktivieren, `user_id` setzen, Audit schreiben.

### roles
`id, organization_id, key text null, name, description, color, icon, is_system bool`
- System-Rollen: `key in ('owner','admin','team_lead','employee')`, unique `(organization_id, key) where key is not null`
- unique `(organization_id, lower(name))`
- Owner-Rolle: nicht löschbar, Permissions nicht änderbar (implizit alle)
- Löschen einer Rolle nur, wenn ihr keine Membership mehr zugeordnet ist (FK restrict)
- Anlegen nicht-systemischer Rollen nur mit Entitlement `custom_roles` (Trigger)

### permissions (globaler Katalog, per Migration gepflegt)
`key text PK, module_key text FK → modules, owner_only bool, sort_order int`
Key-Schema: `<bereich>.<aktion>[.<scope>]` mit `scope ∈ {self, team, all}`. Vollständige V1-Liste in
[RLS & Berechtigungen](../security/rls-und-berechtigungen.md#3-permission-katalog-v1).

### role_permissions
`organization_id, role_id, permission_key` · PK `(role_id, permission_key)` · FK `(organization_id, role_id)` → roles ·
CHECK per Trigger: kein `owner_only`-Key

### modules (globaler Katalog) / organization_modules
- `modules(key PK, required_entitlement text null, depends_on text[] default '{}', is_core bool, default_enabled bool, sort_order int)`
- `organization_modules(organization_id, module_key, enabled bool, updated_by_membership_id)` · PK `(organization_id, module_key)`
- Abhängigkeit: `checklists` hängt von `tasks` ab (Trigger verhindert inkonsistente Aktivierung)

### Tarife und Entitlements
- `plans(key PK: 'free'|'pro'|'business', stripe_product_id, is_public, sort_order)`
- `plan_prices(id, plan_key, stripe_price_id unique, interval 'month'|'year', active)`. Beträge stehen nur in Stripe.
- `entitlement_definitions(key PK, value_type 'bool'|'int'|'bytes'|'days', default_value jsonb)`
- `plan_entitlements(plan_key, entitlement_key, value jsonb)` · PK `(plan_key, entitlement_key)`
- `organization_entitlement_overrides(organization_id, entitlement_key, value jsonb, reason text not null, expires_at)`

V1-Entitlements: `max_members`, `max_locations`, `custom_roles`, `custom_permissions`, `documents_enabled`,
`forms_enabled`, `export_enabled`, `recurring_tasks`, `branding_enabled`, `audit_log_retention_days`,
`storage_bytes`, `advanced_reports`.

### subscriptions (Spiegel von Stripe, 1 pro Organisation)
`organization_id unique, stripe_customer_id unique, stripe_subscription_id unique null, plan_key, status (Stripe-Status unverändert), current_period_end, cancel_at_period_end, past_due_since, last_event_created_at`
- Nur die Service-Rolle (Webhook) schreibt. Clients dürfen mit `billing.manage` lesen.
- `last_event_created_at` dient als Schutz gegen veraltete Events. Aktualisiert wird aber immer aus dem frisch von
  Stripe geladenen Objekt.

### private.stripe_events
`event_id text PK, type, created_at_stripe, received_at, processed_at, error text` (Idempotenz und Fehler-Tracking, §41/§62)

### feature_flags / organization_feature_flags
`feature_flags(key PK, description, default_enabled)`, `organization_feature_flags(organization_id, flag_key, enabled)` (§58).
Flags sind Rollout-Schalter, keine Tarife und keine Rechte.

### notifications
`id, organization_id, recipient_membership_id, type text, params jsonb (nur IDs/Zahlen, keine sensiblen Texte), link text, read_at, created_at`
- Index `(recipient_membership_id, created_at desc)`, partieller Index `where read_at is null`
- Keyset-Pagination über `(created_at, id)`

### notification_preferences
`organization_id, membership_id, event_type, channel ('in_app'|'email'), enabled` · PK `(membership_id, event_type, channel)`

### private.email_outbox / private.outbox
- `email_outbox(id, to_user_id, template, params jsonb, status 'pending'|'sent'|'failed', attempts, next_attempt_at, last_error)`
- `outbox(id, organization_id, event_type, payload jsonb, created_at)`: Domänen-Events als spätere Quelle für Webhooks
  (§82). In V1 nur geschrieben, nicht ausgeliefert. Bereinigung nach 30 Tagen.

### audit_logs
`id bigint identity, organization_id, actor_user_id null, actor_membership_id null, action text, entity_type text, entity_id uuid, changes jsonb ({field: [old, new]}), created_at`
- Index `(organization_id, created_at desc)`, `(organization_id, entity_type, entity_id)`
- Kein INSERT/UPDATE/DELETE für Client-Rollen. Bereinigung per pg_cron gemäß `audit_log_retention_days`.

### dashboard_layouts
`id, organization_id, role_id null (null = Standard), widgets jsonb` (Array aus `{key, enabled, position}`)
- Widget-Keys werden gegen die Registry validiert (DB: CHECK auf JSON-Schema-Form; Keys im Frontend-Contract-Test)
- Widgets, für die der Betrachter keine Permission hat, werden unabhängig vom Layout nicht angezeigt (E-30)

## 4. Zeiterfassung

### time_clock_state (Sperrzeile pro Mitglied)
`membership_id PK, organization_id, state ('OFFLINE'|'WORKING'|'ON_BREAK'), since timestamptz, open_entry_id uuid null`
- Wird in `clock()` per `FOR UPDATE` gesperrt. Das serialisiert gleichzeitige Stempelaktionen desselben Mitglieds.
- `FINISHED` (§20) wird nicht gespeichert, sondern abgeleitet: `OFFLINE` plus eine abgeschlossene Sitzung am
  heutigen lokalen Datum.

### clock_events (append-only)
| Spalte | Regeln |
|---|---|
| id, organization_id, membership_id | |
| type | `CLOCK_IN`, `BREAK_START`, `BREAK_END`, `CLOCK_OUT` |
| occurred_at | Server-Zeit (`now()`) bei `source = 'app'`. Bei Korrekturen der genehmigte Zeitpunkt. |
| recorded_at | immer `now()` |
| source | `app`, `correction`, `admin` |
| time_entry_id | FK auf die Sitzung |
| location_id | null |
| supersedes_event_id | null; bei Korrektur das ersetzte Event |
| adjustment_request_id | null |
| client_request_id | uuid null; unique `(membership_id, client_request_id)` (Idempotenz) |
| created_by_user_id | |

- Trigger blockiert UPDATE und DELETE für alle Rollen außer Migrationen
- Index `(membership_id, occurred_at)`, `(organization_id, occurred_at)`

### time_entries (abgeleitet, nur lesbar für Clients)
`id, organization_id, membership_id, location_id, business_date date, started_at, ended_at null, gross_seconds, break_seconds, net_seconds, status ('open'|'closed'|'needs_review')`
- CHECK `ended_at is null or ended_at > started_at`, `break_seconds between 0 and gross_seconds`, `net_seconds = gross_seconds - break_seconds`
- unique `(membership_id) where ended_at is null` (höchstens eine offene Sitzung)
- Index `(organization_id, business_date)`, `(membership_id, business_date)`
- Berechnung ausschließlich in `private.recompute_time_entry(entry_id)` aus den gültigen (nicht ersetzten) Events

### time_adjustment_requests
`id, organization_id, membership_id, time_entry_id null (null = fehlender Eintrag), kind ('missing_clock_out'|'change_times'|'missing_entry'|'change_breaks'), requested_started_at, requested_ended_at, requested_break_minutes, reason text not null (1–500), status ('pending'|'approved'|'rejected'|'cancelled'), decided_by_membership_id, decided_at, decision_note`
- CHECK `requested_ended_at > requested_started_at` (wenn beide gesetzt)
- Genehmigung nur per RPC: Rechteprüfung (`time.edit.team/all` im Scope, **nicht** für eigene Anträge), Korrektur-Events
  einfügen, neu berechnen, Notification, Audit `TIME_ENTRY_CORRECTED`

## 5. Dienstplan

### shifts
| Spalte | Regeln |
|---|---|
| id, organization_id, location_id, membership_id | membership_id not null in V1 (offene Schichten erst später) |
| starts_at, ends_at | `timestamptz` (E-18), CHECK `ends_at > starts_at`, CHECK `ends_at - starts_at <= interval '24 hours'` |
| business_date | `date`, per Trigger = lokales Datum von `starts_at` in der Zeitzone des Standorts |
| break_minutes | `int >= 0`, CHECK `break_minutes * 60 < extract(epoch from ends_at - starts_at)` |
| status | `draft`, `published`, `cancelled` |
| notes | text ≤ 500 |
| published_at, published_by_membership_id | |

- **Doppelbelegung verhindert:** `EXCLUDE USING gist (membership_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status <> 'cancelled')` (benötigt `btree_gist`)
- Index `(organization_id, business_date)`, `(location_id, business_date)`, `(membership_id, starts_at)`
- RLS: Mitarbeiter sehen nur `published` und `cancelled` (§22)

### schedule_publications
`id, organization_id, location_id null, period_start date, period_end date, shift_count int, published_by_membership_id, published_at`
Protokoll der Veröffentlichung und Anker für die Benachrichtigungen.

### availability
`id, organization_id, membership_id, kind ('weekly'|'date'), weekday smallint null (1–7), date null, availability ('available'|'unavailable'|'partial'), from_time time null, to_time time null, note`
- CHECK: `weekly → weekday not null and date is null`, `date → date not null and weekday is null`, `partial → from_time/to_time` sinnvoll gesetzt

## 6. Urlaub und Abwesenheit

### leave_types
`id, organization_id, key null, name, category ('vacation'|'time_off_in_lieu'|'sick'|'other'), is_sensitive bool, requires_approval bool, color, active`
- Standard-Seed: Urlaub, Zeitausgleich, Krankenstand (`is_sensitive`, ohne Genehmigung, E-23), Sonstige Abwesenheit

### leave_requests
`id, organization_id, membership_id, leave_type_id, start_date, end_date, half_day ('none'|'am'|'pm'), comment text null (≤ 500), status ('pending'|'approved'|'rejected'|'cancelled'), decided_by_membership_id, decided_at, decision_note`
- CHECK `end_date >= start_date`, CHECK `half_day = 'none' or start_date = end_date` (E-23)
- **Keine Überschneidung:** `EXCLUDE USING gist (membership_id WITH =, daterange(start_date, end_date, '[]') WITH &&) WHERE (status in ('pending','approved'))`
- Index `(organization_id, status)`, `(membership_id, start_date)`
- Sensible Typen: Für Kollegen ohne `leave.approve` im Scope wird nur „abwesend“ angezeigt (eigene View
  ist eine `SECURITY DEFINER`-RPC `absences_in_scope(from, to)` mit `search_path = ''` und Scope-Prüfung, die nur
  `membership_id` und Zeitraum liefert. Views laufen immer mit `security_invoker` (Guardrail) und können daher keine
  gefilterte Sicht auf sonst gesperrte Zeilen bieten.)

## 7. Aufgaben und Checklisten

- `tasks(id, organization_id, title (1–200), description (≤ 5000), due_at null, priority ('low'|'normal'|'high'|'urgent'), status ('open'|'in_progress'|'completed'|'cancelled'), location_id null, team_id null, created_by_membership_id, completed_at, completed_by_membership_id, recurrence_id null, template_id null)`
  - CHECK `status = 'completed' ↔ completed_at is not null`
  - Index `(organization_id, status, due_at)`
- `task_assignments(organization_id, task_id, membership_id)` · PK `(task_id, membership_id)` · Index `(membership_id)`
- `task_checklist_items(id, organization_id, task_id, position, label, completed_at, completed_by_membership_id)`
- `task_templates(id, organization_id, name, title, description, priority)` + `task_template_items(id, organization_id, template_id, position, label)`. Das sind die gespeicherten Checklisten-Vorlagen (§30).
- `task_recurrences(id, organization_id, template_id, rule jsonb (eingeschränktes RRULE-Subset: FREQ DAILY/WEEKLY/MONTHLY, BYDAY, BYHOUR, BYMINUTE), timezone, assignee/team/location, next_run_at, active)` (Entitlement `recurring_tasks`)
  - pg_cron erzeugt alle 15 min Aufgaben für fällige `next_run_at` und erzeugt nur die **nächste** Instanz (§29)
- Kommentare und Anhänge (§28 „optional“): **nach MVP**

## 8. Ankündigungen

- `announcements(id, organization_id, title, body text (Plaintext/Markdown, beim Rendern escaped), audience ('all'|'targeted'), requires_ack bool, published_at, author_membership_id, archived_at)`
- `announcement_audiences(organization_id, announcement_id, location_id null, team_id null, role_id null)`. CHECK: genau eines gesetzt.
- `announcement_reads(organization_id, announcement_id, membership_id, read_at, acknowledged_at)` · PK `(announcement_id, membership_id)`
- „Gelesen 12/15“: RPC berechnet die Zielgruppe zum Veröffentlichungszeitpunkt × Lesebestätigungen

## 9. Nach MVP (nur skizziert, damit V1 nichts verbaut)

- **Dokumente:** `document_folders(id, organization_id, parent_id, name, scope ('general'|'location'|'team'|'member'), scope_ref_id)`, `documents(id, organization_id, folder_id, storage_path, mime_type, size_bytes, uploaded_by, …)`, `document_permissions(document_id|folder_id, role_id|membership_id|team_id|location_id, can_view, can_manage)`
- **Formulare:** `form_templates(id, organization_id, name, version, status)`, `form_fields(id, template_id, type, label, required, options jsonb, position)`, `form_submissions(id, organization_id, template_id, template_version, membership_id, data jsonb, submitted_at)`. Die Submission speichert die Template-Version, damit spätere Änderungen alte Antworten nicht verfälschen.
- **Schichttausch:** `shift_swap_requests(id, organization_id, shift_id, offered_by, taken_by, status, decided_by)`

## 10. Seed „Demo GmbH“ (§59)

`supabase/seed.sql` (nur lokal und staging, **nie** production):
Organisation „Demo GmbH“ (Wien), Standorte „Filiale Wien“ und „Filiale Graz“, Teams „Service“ und „Küche“,
Accounts `owner@demo.test`, `manager@demo.test`, `teamlead@demo.test`, `ma1@demo.test`, `ma2@demo.test`
(lokales Passwort aus `.env`), dazu eine zweite Organisation „Fremd AG“ als Gegenprobe für Isolationstests.
Pro Phase kommen Demo-Daten des jeweiligen Moduls dazu (Schichten, Arbeitszeiten, Urlaub, Aufgaben, Ankündigungen).
