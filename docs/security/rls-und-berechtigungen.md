# TeamPanel – Sicherheitsmodell: Mandantentrennung, RLS und Berechtigungen

> Status: **Entwurf zur Freigabe** · Konkretisiert §4, §8, §50–§53, §73 und §92 der [Spezifikation](../product/spezifikation.md).

## 1. Bedrohungsmodell (kurz)

| Angreifer | Ziel | Hauptschutz |
|---|---|---|
| Eingeloggter User aus Organisation B | Daten von Organisation A lesen oder ändern | RLS-Basisregel, zusammengesetzte FKs, Negativtests |
| Mitarbeiter derselben Organisation | Fremde Arbeitszeiten, Urlaubsgründe, HR-Daten lesen; eigene Zeiten fälschen | Scope-Prüfung in RLS; append-only Events; Server-Zeit |
| User mit `roles.manage` | Sich selbst Owner- oder Billing-Rechte geben | Eskalationsregeln in RPC und Trigger |
| Anonymer Angreifer | API ohne Login nutzen, Einladungs-Tokens raten | `anon` ohne Tabellenrechte; Tokens mit 256 Bit, nur Hash gespeichert, Ablauf |
| Fremder, der Webhooks fälscht | Pro-Tarif „kaufen“ | Stripe-Signaturprüfung; Status wird bei Stripe nachgeladen |
| XSS über Benutzereingaben | Token-Diebstahl | React-Escaping, kein `dangerouslySetInnerHTML`, strikte CSP, keine SVG-Uploads |

## 2. Grundregeln (gelten für jede Migration)

1. **`alter table … enable row level security`** auf jeder Tabelle in `public`. Ein pgTAP-Meta-Test schlägt fehl, wenn
   eine Tabelle ohne RLS existiert.
2. **Keine Policy = kein Zugriff.** Policies werden pro Operation (`select`/`insert`/`update`/`delete`) und nur für
   die Rolle `authenticated` geschrieben. Nie `for all`, nie `to public`.
3. **`anon` bekommt nichts:** `revoke all on all tables in schema public from anon` plus Default Privileges. Supabase
   vergibt standardmäßig Rechte an `anon`/`authenticated`; das wird in der Baseline-Migration zurückgenommen und
   pro Tabelle explizit für `authenticated` gegrantet.
4. **Funktionen:** `revoke execute on all functions … from public`. RPCs werden einzeln an `authenticated` gegrantet.
   `SECURITY DEFINER` nur mit `set search_path = ''` und voll qualifizierten Namen. Helper liegen im nicht exponierten
   Schema `private`.
5. **Service-Role-Key** existiert nur in Edge Functions und CI-Secrets. Das Frontend-Bundle wird in CI auf
   `service_role` und `sk_live`/`sk_test` gescannt.
6. **Mandantenkonsistenz** über zusammengesetzte FKs (siehe [Datenmodell](../architecture/datenmodell.md#1-konventionen)).
7. **Unveränderliche Spalten** (`organization_id`, `membership_id` bei Events, `created_by_*`) werden per Trigger
   gegen UPDATE geschützt.

## 3. Permission-Katalog V1

Schema: `<bereich>.<aktion>[.<scope>]`. Scopes: `self` (eigene Daten), `team` (Mitglieder der eigenen Teams),
`all` (gesamte Organisation, eingeschränkt durch `location_scope`). Ein höherer Scope schließt die niedrigeren ein.

| Bereich | Keys | Anmerkung zur Spec |
|---|---|---|
| Organisation | `settings.manage`, `modules.manage`, `roles.manage`, `dashboard.manage`, `audit.view` | |
| Nur Owner | `billing.manage`, `organization.transfer_ownership`, `organization.delete` | `owner_only`, nicht vergebbar (E-09) |
| Mitarbeiter | `employees.view.self/team/all`, `employees.invite`, `employees.edit.team/all`, `employees.archive` | `employees.create` → `invite`, `employees.delete` → `archive` (E-11) |
| Struktur | `teams.manage`, `locations.manage` | |
| Dienstplan | `schedule.view.self/team/all`, `schedule.manage.team/all`, `availability.edit.self` | `schedule.manage` mit Scope (E-08) |
| Zeit | `time.clock`, `time.view.self/team/all`, `time.edit.team/all` | `time.edit` = Korrekturen genehmigen, mit Scope |
| Urlaub | `leave.request`, `leave.view.team/all`, `leave.approve.team/all` | `leave.approve` mit Scope |
| Aufgaben | `tasks.view.all`, `tasks.create`, `tasks.assign`, `tasks.complete`, `tasks.manage`, `tasks.templates.manage` | Eigene bzw. zugewiesene Aufgaben sind immer sichtbar |
| News | `announcements.view`, `announcements.publish` | |
| Reports | `reports.view.team/all`, `reports.export` | Export zusätzlich Entitlement `export_enabled` |

### Standardrollen (Seed bei Organisationserstellung)

| Permission | Owner | Admin/Manager | Teamleiter | Mitarbeiter |
|---|:-:|:-:|:-:|:-:|
| `billing.manage`, `organization.*` | ✔ | – | – | – |
| `settings.manage`, `modules.manage`, `roles.manage`, `dashboard.manage`, `audit.view` | ✔ | ✔ | – | – |
| `employees.view.*` | all | all | team | self |
| `employees.invite`, `employees.edit.*`, `employees.archive` | ✔ / all | ✔ / all | – / team (nur edit) | – |
| `teams.manage`, `locations.manage` | ✔ | ✔ | – | – |
| `schedule.view.*` | all | all | team | self¹ |
| `schedule.manage.*` | all | all | team | – |
| `time.clock` | ✔ | ✔ | ✔ | ✔ |
| `time.view.*` / `time.edit.*` | all / all | all / all | team / team | self / – |
| `leave.request` | ✔ | ✔ | ✔ | ✔ |
| `leave.view.*` / `leave.approve.*` | all / all | all / all | team / team | – / – |
| `tasks.create`, `tasks.assign` | ✔ | ✔ | ✔ | – |
| `tasks.complete` | ✔ | ✔ | ✔ | ✔ |
| `tasks.view.all`, `tasks.manage`, `tasks.templates.manage` | ✔ | ✔ | – | – |
| `announcements.view` / `.publish` | ✔ / ✔ | ✔ / ✔ | ✔ / – | ✔ / – |
| `reports.view.*` / `reports.export` | all / ✔ | all / ✔ | team / – | – / – |

¹ Produktentscheidung offen: Viele Betriebe wollen, dass Mitarbeiter den ganzen Dienstplan ihres Teams sehen
(„wer arbeitet mit mir?“). Vorschlag: Mitarbeiter-Default `schedule.view.team` (E-11).

**Owner** besitzt implizit **jede** Permission, auch künftige. Das wird im Helper geprüft, nicht über Seed-Zeilen,
damit ein Owner durch neue Permissions nie ausgesperrt wird.
**Free-Tarif:** Die Permissions der Systemrollen sind fest, sofern das Entitlement `custom_permissions` fehlt (E-02).

## 4. Helper-Funktionen (Skizze)

Alle Helper sind **unkorreliert**, hängen also nicht von der aktuellen Zeile ab. Postgres wertet sie deshalb **einmal
pro Statement** als InitPlan aus und nicht pro Zeile. Das ist der wichtigste Performance-Hebel bei RLS.

```sql
-- Organisationen, in denen ich aktives Mitglied bin
create function private.my_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id from public.memberships m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

-- Meine aktiven Memberships (eine pro Organisation)
create function private.my_membership_ids() returns setof uuid ... -- analog

-- Organisationen, in denen ich eine Permission habe (Owner: alle)
create function private.orgs_with_permission(perm text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id
  from public.memberships m
  join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active'
    and (r.key = 'owner'
         or exists (select 1 from public.role_permissions rp
                    where rp.role_id = m.role_id and rp.permission_key = perm))
$$;

-- Organisationen, in denen ein Modul aktiv UND vom Tarif erlaubt ist
create function private.orgs_with_module(module text) returns setof uuid ...

-- Mitglieder, deren personenbezogene Daten ich für '<bereich>.<aktion>' sehen bzw. bearbeiten darf
-- (vereinigt self / team / all ∩ Standort-Scope über alle meine Organisationen)
create function private.member_ids_in_scope(perm_base text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  with me as (
    select m.id, m.organization_id, m.location_scope,
           private.role_has(m.role_id, perm_base || '.all')  as has_all,
           private.role_has(m.role_id, perm_base || '.team') as has_team,
           private.role_has(m.role_id, perm_base || '.self') as has_self
    from public.memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'
  )
  select id from me where has_self or has_team or has_all                 -- self
  union
  select tm2.membership_id from me                                         -- team
    join public.team_members tm1 on tm1.membership_id = me.id
    join public.team_members tm2 on tm2.team_id = tm1.team_id
                                and tm2.organization_id = me.organization_id
   where me.has_team
  union
  select t.id from me                                                      -- all ∩ Standort
    join public.memberships t on t.organization_id = me.organization_id
   where me.has_all
     and (me.location_scope = 'all'
          or exists (select 1 from public.membership_locations a
                       join public.membership_locations b on b.location_id = a.location_id
                      where a.membership_id = me.id and b.membership_id = t.id))
$$;
-- private.role_has(role_id, key) liefert true für Owner-Rollen und sonst einen Lookup in role_permissions.
```

## 5. Policy-Muster

```sql
-- Basisregel: Mitglied der Organisation (z. B. locations, teams, roles)
create policy locations_select on public.locations for select to authenticated
  using (organization_id in (select private.my_org_ids()));

create policy locations_write on public.locations for update to authenticated
  using      (organization_id in (select private.orgs_with_permission('locations.manage')))
  with check (organization_id in (select private.orgs_with_permission('locations.manage')));

-- Personenbezogene Moduldaten: Modul aktiv + Scope
create policy time_entries_select on public.time_entries for select to authenticated
  using (organization_id in (select private.orgs_with_module('time_tracking'))
         and membership_id in (select private.member_ids_in_scope('time.view')));
-- kein insert/update/delete auf time_entries für Clients (nur via RPC/Trigger)

-- Dienstplan: Entwürfe nur für Planer
create policy shifts_select on public.shifts for select to authenticated
  using (organization_id in (select private.orgs_with_module('schedule'))
         and (   membership_id in (select private.member_ids_in_scope('schedule.manage'))
              or (status <> 'draft'
                  and membership_id in (select private.member_ids_in_scope('schedule.view')))));
```

**Schreiboperationen mit Geschäftslogik** (Statusübergänge, Genehmigungen, Stempeln, Publish, Rollenwechsel) laufen
**nur** über `SECURITY DEFINER`-RPCs. Diese prüfen am Anfang explizit mit denselben Helpern, z. B.:

```sql
if not exists (select 1 from private.member_ids_in_scope('leave.approve') s where s = v_request.membership_id)
   or v_request.membership_id in (select private.my_membership_ids()) then
  raise exception using errcode = 'TP403', message = 'forbidden';
end if;
```

Eigene Fehlercodes (`TP403` forbidden, `TP409` conflict, `TP422` limit_reached …) werden im Frontend auf i18n-Texte
gemappt (§61).

## 6. Eskalations- und Aussperrschutz

| Regel | Durchsetzung |
|---|---|
| Mindestens ein aktiver Owner pro Organisation | Deferred Constraint-Trigger auf `memberships` |
| Owner-Rolle: nicht löschbar, nicht umbenennbar, Permissions implizit | Trigger auf `roles`/`role_permissions` |
| Owner wird man nur per `transfer_ownership()` oder `add_owner()` (nur durch Owner) | RPC; direkter UPDATE von `role_id` auf die Owner-Rolle per Trigger blockiert |
| `owner_only`-Permissions keiner anderen Rolle zuweisbar | Trigger auf `role_permissions` |
| Nur Permissions vergeben, die man selbst besitzt | RPC `set_role_permissions()` |
| Eigene Rolle nicht ändern; keine Rolle zuweisen, die mehr Rechte hat als die eigene | RPC `assign_role()` |
| Eigene Korrekturanträge bzw. eigenen Urlaub nicht selbst genehmigen (außer Owner ohne weitere Manager) | RPC-Prüfung, Audit markiert Selbstgenehmigung |
| Rechteänderung wirkt sofort | Keine Rechte in JWT-Claims cachen; Helper lesen live (E-24) |

## 7. Storage

- Buckets: `org-assets` (Logo), `avatars`, später `documents` und `form-uploads`. Alle `public = false`.
- Pfad: `{organization_id}/…`. Policy: `(storage.foldername(name))[1]::uuid in (select private.my_org_ids())` plus
  bereichsspezifische Permission für Schreibzugriffe.
- MIME-Whitelist und `file_size_limit` pro Bucket. Speicherkontingent per Entitlement `storage_bytes` (RPC
  `request_upload` prüft vor dem Upload).
- Auslieferung über `createSignedUrl` mit kurzer Laufzeit (≤ 10 min).

## 8. Auth und Sessions

- Supabase Auth: E-Mail + Passwort **und** Magic Link (§9), E-Mail-Bestätigung Pflicht, Mindestlänge 10 Zeichen und
  Leaked-Password-Check (Supabase-Option).
- JWT-Laufzeit 15–60 min, Refresh-Token-Rotation an (Default).
- Session Revocation (§53): „Überall abmelden“ = `signOut({ scope: 'global' })`. Eine archivierte Membership verliert
  sofort den Zugriff, weil die Helper `status = 'active'` live prüfen.
- Auth-Rate-Limits über Supabase konfigurieren (Sign-up, OTP, Passwort-Reset). Eigene Limits für RPCs mit Außenwirkung
  (Einladungen: max. N pro Stunde und Organisation, gezählt in der Outbox).
- CSP über Cloudflare Pages `_headers`: `default-src 'self'; connect-src 'self' https://<projekt>.supabase.co wss://…; img-src 'self' blob: data: https://<projekt>.supabase.co; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'`. Dazu `X-Content-Type-Options`, `Referrer-Policy` und `Permissions-Policy` (Geolocation, Kamera und Mikrofon aus).

## 9. Teststrategie Sicherheit

**Werkzeug:** pgTAP via `supabase test db` (läuft in CI gegen eine frische lokale DB). Helper
`tests.as_user(email)` setzt `role authenticated` und `request.jwt.claims`.

**Meta-Tests** (fangen vergessene Policies bei *künftigen* Tabellen ab):
- Jede Tabelle in `public` hat RLS aktiviert.
- Jede Tabelle mit Spalte `organization_id` hat `unique (organization_id, id)` und mindestens eine Select-Policy.
- Keine Policy richtet sich an `anon` oder `public`.
- Jede `SECURITY DEFINER`-Funktion hat einen gesetzten `search_path`.
- `anon` hat auf keiner Tabelle Privilegien.

**Isolationsmatrix** (pro Mandantentabelle, wächst mit jeder Phase), Seed mit „Demo GmbH“ und „Fremd AG“:

| Akteur | Erwartung |
|---|---|
| anon | liest 0 Zeilen, Schreibversuche schlagen fehl |
| Owner Fremd AG | liest 0 Zeilen der Demo GmbH; INSERT mit fremder `organization_id` schlägt fehl; UPDATE/DELETE betrifft 0 Zeilen |
| Mitarbeiter Demo GmbH | sieht nur eigene Zeit-, Urlaubs- und HR-Daten; keine Schicht-Entwürfe |
| Teamleiter Service | sieht Service-Team, nicht das Küchen-Team |
| Manager mit `location_scope = assigned` (Wien) | sieht keine Daten von Graz |
| Admin | kann sich `billing.manage` nicht geben, keinen Owner ernennen, eigene Rolle nicht ändern |
| beliebig | Cross-Tenant-FK (Aufgabe aus A zeigt auf Mitglied aus B) schlägt an Constraint fehl |
| Modul deaktiviert | Moduldaten nicht lesbar, Schreiben schlägt fehl |

Zusätzlich gibt es E2E-Negativtests (§73): URL einer fremden Organisation aufrufen → „Kein Zugriff“-Seite,
keine Daten im Netzwerkverkehr.
