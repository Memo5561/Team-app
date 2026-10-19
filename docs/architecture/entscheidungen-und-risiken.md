# TeamPanel – Widersprüche, Lücken, Risiken und Architekturentscheidungen

> Status: **Freigegeben am 2026-10-19.** Der Product Owner hat alle Empfehlungen dieses Dokuments übernommen. Jede
> **Empfehlung** gilt damit als verbindliche Entscheidung, bis sie ausdrücklich geändert wird. Nichts hier ändert die
> [Spezifikation](../product/spezifikation.md) still. E-43 bis E-46 sind mit Phase 1 dazugekommen und ebenfalls
> am 2026-10-19 entschieden; E-46 ersetzt dabei einen Teil von E-43.
>
> **Legende:** 🟥 Entscheidung des Product Owners nötig, bevor die betroffene Phase startet ·
> 🟨 Empfehlung wird umgesetzt, solange niemand widerspricht · 🟩 rein technische Präzisierung

## Übersicht: Product-Owner-Entscheidungen (am 2026-10-19 wie empfohlen getroffen)

| Nr. | Thema | Betrifft Phase | Entscheidung (Kurzform) |
|---|---|---|---|
| E-02 | Rollenrechte im Free-Tarif fest oder konfigurierbar? | 3 | Fest; Konfiguration ab Pro |
| E-04 | Mitarbeiter ohne E-Mail/Account erlaubt? | 4 | Ja |
| E-05 | Zählen eingeladene Mitglieder zum Limit? | 4 | Ja |
| E-11 | Sehen Mitarbeiter den Dienstplan der Kollegen? | 3/8 | Ja, eigenes Team (veröffentlicht) |
| E-14 | Downgrade über Limit – was passiert? | 12 | Nichts löschen, Neuanlage sperren |
| E-15 | Länge der Grace Period | 12 | 14 Tage |
| E-16 | Stempeln im Modus „restricted“? | 12 | Erlaubt |
| E-23 | Urlaubskonto/Resturlaub in V1? Krankmeldung als Antrag? | 9 | Kein Konto in V1; Krankenstand als Meldung |
| E-28 | Änderungen an bereits veröffentlichten Schichten | 8 | Sofort sichtbar + Benachrichtigung |
| E-31 | Preise netto/brutto, Steuerabwicklung | 12 | Netto für B2B, Stripe Tax |
| E-37 | „1 Unternehmen“ im Free-Tarif: pro Account? | 2 | Max. 3 eigene Organisationen pro Account |
| E-43 | Registrierung ohne Passwort? | 1 | Ja: immer per E-Mail-Link; Passwort optional, erst nach der Bestätigung (E-46) |
| E-44 | E-Mail-Versand in Staging bis Phase 4 | 1 | Supabase-Standardversand (nur Team-Adressen, ~2 Mails/h) |
| E-45 | „Require current password when updating“ (gehostet) | 1 | An; lokal aus. Nachweis: Negativtest auf Staging |
| E-46 | Fremdes Passwort in einem unbestätigten Konto | 1 | Option 1: Passwort erst nach der Bestätigung; DB-Trigger löscht ein früher gesetztes |

---

## A. Rollen, Berechtigungen, Identität

### E-01 🟩 „Admin / Manager“ ist eine Rolle
§6 nennt „Admin / Manager“ als eine Rolle. §10 und §27 sprechen von „Manager“, §8 von Permissions.
**Empfehlung:** Eine Systemrolle `admin`, im UI „Manager“ genannt. Umbenennen ist pro Organisation möglich (nur der
Anzeigename; der `key` bleibt).

### E-02 🟥 Teamleiter-Rechte „konfigurierbar“ vs. „eigene Berechtigungen nur Pro“
§6 sagt, Teamleiter-Rechte müssen konfigurierbar sein. Laut §38/§39 fehlen im Free-Tarif „eigene Rollen“, und
„eigene Berechtigungen“ sind ein Pro-Feature. Das widerspricht sich für Free-Kunden.
**Empfehlung:** Free nutzt die vier Standardrollen mit festen Rechten. Ab Pro (Entitlements `custom_permissions` und
`custom_roles`) lassen sich auch die Rechte der Standardrollen anpassen.

### E-03 🟨 Owner-Schutz und mehrere Owner
§6: Der Owner darf nicht ausgesperrt werden. Ob es mehrere Owner geben darf, lässt die Spec offen.
**Empfehlung:** Mehrere Owner sind erlaubt, mindestens einer ist Pflicht (DB-Trigger). Eigentümerwechsel per
`transfer_ownership()`. Der Zahlungskontakt bei Stripe ist der Owner, der das Abo abgeschlossen hat; das ist änderbar.

### E-04 🟥 Mitarbeiter ohne E-Mail bzw. ohne Account
§13 verlangt eine E-Mail pro Mitglied, §5 trennt Account und Mitgliedschaft. In der Zielgruppe (Gastro, Reinigung,
Bau, Lehrlinge) haben viele Beschäftigte keine geschäftliche E-Mail oder wollen die App nicht nutzen, müssen aber
im Dienstplan stehen.
**Empfehlung:** `memberships.user_id` ist nullable, E-Mail ist optional. Solche Mitarbeiter können geplant werden,
sich aber nicht einloggen. Einladung später per E-Mail oder Link. Der Begriff „Mitarbeiter“ heißt im Code durchgängig
`membership` (statt `employee_id` aus §22).

### E-05 🟥 Was zählt als „aktives Mitglied“ für `max_members`?
§38 sagt „bis zu 10 aktive Mitglieder“. Ungeklärt ist, ob eingeladene, inaktive oder Mitarbeiter ohne Account
mitzählen.
**Empfehlung:** Es zählen `invited` + `active`, auch ohne Account. `inactive` und `archived` zählen nicht. Sonst lässt
sich das Limit über „ewig eingeladen“ umgehen.

### E-06 🟨 `teams.manager_id` vs. mehrere Teams
§14 hat einen einzelnen `manager_id`, soll aber später mehrere Teams pro Person erlauben.
**Empfehlung:** Junction-Tabelle `team_members(is_lead, is_primary)` ab V1. Ein Team kann mehrere Leads haben. Das
UI erlaubt in V1 ein Hauptteam pro Person.

### E-07 🟩 Cross-Tenant-Referenzen über Fremdschlüssel (Lücke in der Spec)
RLS prüft die `organization_id` der *eigenen* Zeile, nicht die der referenzierten Zeile. Ohne Zusatzmaßnahme könnte
eine Aufgabe in Organisation A per API einem Mitglied aus Organisation B zugewiesen werden (Datenleck über Joins und
Benachrichtigungen).
**Entscheidung:** Zusammengesetzte FKs `(organization_id, x_id)` überall. Ein Meta-Test erzwingt das.

### E-08 🟥→🟨 Scopes für Verwaltungsrechte und Standort-Sichtbarkeit fehlen
§8 hat Scopes nur für `view` (`.self/.team/.all`). `schedule.manage`, `leave.approve` und `time.edit` sind
unscoped. Trotzdem soll ein Teamleiter „den Dienstplan *seines Teams* verwalten“ (§6), und „Manager Wien soll Graz
nicht sehen“ (§15). Mit den Keys aus §8 ist beides nicht ausdrückbar.
**Empfehlung:** (a) Verwaltungsrechte für Personendaten erhalten `.team/.all`. (b) Pro Membership gibt es
`location_scope = all | assigned`; `assigned` schränkt auch `.all` auf die zugewiesenen Standorte ein. Default ist
`assigned` (secure by default). Owner haben immer `all`.

### E-09 🟨 Nicht delegierbare Rechte
§6: Admin hat keinen Zugriff auf Zahlung oder Eigentümerwechsel. Mit Custom Roles (§7) könnte aber jemand
`billing.manage` in eine eigene Rolle packen.
**Empfehlung:** `billing.manage`, `organization.transfer_ownership` und `organization.delete` sind `owner_only` und
nicht zuweisbar.

### E-10 🟩 Privilege Escalation über `roles.manage` (Lücke in der Spec)
Wer Rollen verwalten darf, könnte sich eine Rolle mit allen Rechten bauen und sich selbst zuweisen.
**Entscheidung:** Es dürfen nur eigene Rechte weitergegeben werden. Die eigene Rolle ist nicht änderbar. Owner
ernennt nur ein Owner. Alles wird in RPCs erzwungen und mit Negativtests geprüft.

### E-11 🟥 Sichtbarkeit unter Kollegen; Löschen vs. Archivieren
- §6 gibt Mitarbeitern nur „eigene Schichten“. In der Praxis wollen fast alle Betriebe, dass Mitarbeiter sehen, wer mit
  ihnen Dienst hat.
  **Empfehlung:** Mitarbeiter-Default ist `schedule.view.team` (nur veröffentlichte Schichten). Pro Organisation
  änderbar (ab Pro).
- Für Dienstplan und Aufgaben müssen Namen von Kollegen sichtbar sein, für Kontakt- und HR-Daten nicht.
  **Empfehlung:** Ein „Verzeichnis“ (Name, Avatar, Team, Rolle) ist für alle Mitglieder im Standort-Scope sichtbar.
  E-Mail, Telefon, Personalnummer und Eintrittsdatum stehen getrennt in `employee_profiles` und unterliegen
  `employees.view.*`.
- `employees.delete` (§8) widerspricht §13 („nicht vollständig löschen“).
  **Empfehlung:** Die Permission heißt `employees.archive`. Physisches Löschen gibt es nur für Mitglieder ohne jede
  Historie (z. B. falsche Einladung) und nur über die Funktion „Einladung zurückziehen“.

### E-12 🟩 Zwei Registries für Permissions und Module
§49 verlangt Tabellen `permissions`/`modules`, §79 eine Registry im Code. Das sind zwei Quellen der Wahrheit.
**Entscheidung:** Die DB (Migrationen) ist maßgeblich für Sicherheit, die TS-Registry für UI. Ein Contract-Test in CI
vergleicht beide; generierte Typen machen unbekannte Keys zu Compile-Fehlern.

## B. Module, Tarife, Billing

### E-13 🟨 Deaktiviertes Modul: nur ausblenden oder sperren?
§12: Das Modul soll „verschwinden“, Daten bleiben erhalten. Wird nur ausgeblendet, bleiben die Daten per API
erreichbar. Das verstößt gegen „secure by default“.
**Empfehlung:** RLS prüft `orgs_with_module()`, das Modul ist also auch serverseitig gesperrt. Owner können die Daten
deaktivierter Module weiterhin exportieren (Exportfunktion, Phase 13).

### E-14 🟥 Downgrade bzw. Kündigung über Tarif-Limits
Die Spec definiert nicht, was bei 25 Mitgliedern, 3 Standorten und eigenen Rollen nach einem Rückfall auf Free
passiert.
**Empfehlung:** Nichts wird gelöscht und nichts automatisch deaktiviert. Neuanlagen über dem Limit sind gesperrt und
ein Banner erklärt den Grund. Eigene Rollen bleiben zugewiesen, sind aber nicht mehr bearbeitbar. Pro-Module
(Dokumente, Formulare) werden schreibgeschützt.

### E-15 🟥 Billing-Status: Spec-Status ≠ Stripe-Status
§42 nennt `active, past_due, grace_period, restricted, cancelled`. Stripe kennt `grace_period` und `restricted` nicht,
dafür aber `trialing`, `unpaid`, `incomplete` und `paused`. Außerdem heißen die Webhook-Events
`customer.subscription.created` usw. (§41 schreibt verkürzt `subscription.created`).
**Empfehlung:** `subscriptions.status` speichert den Stripe-Status unverändert. `access_state`
(`active | grace_period | restricted`) wird daraus abgeleitet. Mit der Stripe-Einstellung „nach letztem
Zahlungsversuch kündigen“ endet ein Abo als `canceled` und die Organisation fällt auf Free zurück.
**Offen:** Dauer der Grace Period. Vorschlag: 14 Tage ab erstem Fehlschlag, danach `restricted`.

### E-16 🟥 Gesperrter Modus vs. gesetzliche Arbeitszeitaufzeichnung
Wenn der Modus „restricted“ das Stempeln blockiert, verliert der Kunde Arbeitszeitaufzeichnungen, zu denen er in
Österreich verpflichtet ist (AZG). Das ist ein Haftungs- und Reputationsrisiko.
**Empfehlung:** Stempeln, eigene Zeiten sehen und Export bleiben im Modus `restricted` möglich. Gesperrt sind
Verwaltung, Einladungen und Pro-Funktionen.

### E-31 🟥 Preise, Umsatzsteuer, Rechnungen
§39/§40 nennen „ca. 29,90 €“ ohne netto/brutto. B2B-Verkauf in der EU braucht UID-Erfassung, Reverse Charge und
rechtskonforme Rechnungen.
**Empfehlung:** Netto-Preise (B2B). Stripe Tax und Stripe Invoicing; UID im Checkout erfassen. Das gehört vor Phase 12
steuerlich geklärt.

### E-37 🟥 „1 Unternehmen“ im Free-Tarif
Entitlements gelten pro Organisation, „1 Unternehmen“ ist aber ein Limit pro Account. Ohne Regel kann jemand beliebig
viele Free-Organisationen anlegen.
**Empfehlung:** Hartes Limit von 3 selbst erstellten Organisationen pro Account (konfigurierbar) als
Missbrauchsschutz. Kein Tarifmerkmal.

## C. Zeiterfassung, Dienstplan, Urlaub

### E-18 🟩 Schicht als `date + start_time + end_time` widerspricht §65
§22 definiert `date`, `start_time` und `end_time`. Damit sind 22:00–06:00 und Sommerzeitwechsel nur über
Sonderlogik abbildbar (§65 fordert genau das).
**Entscheidung:** `starts_at`/`ends_at` als `timestamptz` plus abgeleitetes `business_date`. Maximal 24 h, Pausen
kürzer als die Schicht. Doppelbelegung per Exclusion-Constraint ausgeschlossen.

### E-19 🟩 Zeitstempel beim Stempeln kommen vom Server (Lücke)
Würde der Client die Uhrzeit senden, wäre die Zeiterfassung trivial manipulierbar.
**Entscheidung:** `occurred_at = now()` in der RPC. Abweichungen gehen nur über Korrekturanträge.

### E-20 🟩 `clock_events` vs. `time_entries`: zwei Wahrheiten?
§49 listet beide Tabellen. Wenn beide schreibbar sind, laufen sie auseinander.
**Entscheidung:** Events sind die Wahrheit (append-only). `time_entries` wird abgeleitet und ist für Clients nur
lesbar.

### E-21 🟨 Berechnung doppelt (SQL und TypeScript)
Der Live-Timer im Browser braucht die Berechnung clientseitig, maßgeblich ist aber die DB.
**Empfehlung:** Gemeinsame Testfall-Datei (`tests/fixtures/time-cases.json`), die sowohl Vitest als auch pgTAP
ausführen. So bleiben beide Implementierungen nachweislich gleich.

### E-22 🟨 Vergessenes Ausstempeln
Die Spec regelt Korrekturanträge, aber nicht, was mit einer Sitzung passiert, die tagelang offen bleibt.
**Empfehlung:** Kein Auto-Ausstempeln in V1. Nach 16 h (konfigurierbar) wird die Sitzung als `needs_review`
markiert und Mitarbeiter und Manager werden benachrichtigt.

### E-23 🟥 Urlaub: halbe Tage, Krankenstand, Resturlaub, Konflikt mit Schichten
- „Halber Tag“ und „Von–Bis“ (§26) sind bei mehrtägigen Anträgen mehrdeutig.
  **Empfehlung:** Halbe Tage gibt es in V1 nur bei eintägigen Anträgen.
- Krankenstand wird in Österreich gemeldet, nicht beantragt.
  **Empfehlung:** Der Typ `sick` ist eine Meldung ohne Genehmigung. Er ist für Kollegen nur als „abwesend“ sichtbar.
  Es gibt kein Grund- oder Diagnosefeld (§54).
- **Resturlaub/Urlaubsanspruch fehlt komplett in der Spec.** Österreichische KMU erwarten das häufig.
  **Empfehlung:** Nicht in V1 (Phase-1-Fokus), das Datenmodell lässt Platz für `leave_balances`. Als Pilot-Feedback
  abfragen.
- §27: „Dienstplan erhält Abwesenheit“. Was passiert mit bestehenden Schichten im Zeitraum?
  **Empfehlung:** Schichten werden nicht automatisch gelöscht. Der Dienstplan markiert den Konflikt, der Manager
  entscheidet.

### E-28 🟥 Änderungen an bereits veröffentlichten Schichten
§23 regelt nur die Erstveröffentlichung.
**Empfehlung:** Eine Änderung an einer veröffentlichten Schicht ist sofort sichtbar. Der betroffene Mitarbeiter wird
benachrichtigt. Neue Schichten sind immer zuerst `draft`. Ein „Änderungen sammeln und erneut veröffentlichen“ wäre
deutlich komplexer und ist nicht V1.

### E-29 🟨 Arbeitsrecht: Betriebsrat und Aufzeichnungspflicht (Hinweis, keine Rechtsberatung)
Zeiterfassungs- und Kontrollsysteme können in Österreich zustimmungspflichtig sein (Betriebsvereinbarung, ArbVG).
TeamPanel berechnet Stunden, ist aber keine Lohnverrechnung (§68).
**Empfehlung:** Vor dem Pilot rechtlich prüfen lassen. Hilfetext/FAQ für Kunden. Kein Leistungs-Scoring und keine
Standortdaten (bereits Spec-konform).

## D. Datenschutz und Recht

### E-17 🟥 Rollen nach DSGVO, AVV, Account-Löschung vs. Aufbewahrungspflicht
- Die Spec erwähnt den **Auftragsverarbeitungsvertrag (AVV/DPA)** nicht. Das Kundenunternehmen ist Verantwortlicher
  für die Mitarbeiterdaten, TeamPanel ist Auftragsverarbeiter. Für den Verkauf werden AVV, TOMs und eine Liste der
  Unterauftragsverarbeiter (Supabase, Cloudflare, Resend, Stripe, Sentry) gebraucht.
- §55 „Account löschen → anonymisieren“ kollidiert mit der Aufbewahrungspflicht des Arbeitgebers für
  Arbeitszeitaufzeichnungen.
  **Empfehlung:** Account-Löschung entfernt Login und globales Profil. Firmenbezogene Mitarbeiterdaten (Name, Zeiten)
  gehören der Firma und werden nach deren Aufbewahrungsregeln gelöscht. Deshalb steht der Name in `memberships` und
  nicht nur im Account.
- Die Spec nennt keine **Aufbewahrungsfristen**.
  **Empfehlung:** Konfigurierbar pro Organisation mit gesetzeskonformem Default. Vor dem Pilot klären.

### E-33 🟨 Produkt-Analytics ohne Tracking
§88 verlangt Kennzahlen ohne personenbezogene Überwachung.
**Empfehlung:** In V1 keine Drittanbieter-Tracker. Kennzahlen werden aggregiert aus der DB berechnet (Admin-Report).
Dadurch ist auch kein Cookie-Banner nötig.

### E-34 🟨 IP-Adresse im Audit Log
§52 nennt sie optional.
**Empfehlung:** In V1 nicht speichern, da kein klarer Zweck (Datenminimierung). Login-Ereignisse liegen in den
Supabase-Auth-Logs.

## E. Technik und Betrieb

### E-24 🟨 „Sichere Cookies“ vs. SPA mit supabase-js
§53 fordert sichere Cookies und Tokens. supabase-js speichert die Session in einer reinen SPA in `localStorage`.
HttpOnly-Cookies würden einen eigenen Backend-for-Frontend-Server verlangen (Kosten, Komplexität).
**Empfehlung:** `localStorage` mit strikter CSP, ohne Inline-Scripts, mit kurzer JWT-Laufzeit und
Refresh-Rotation. CSRF ist bei Bearer-Tokens kein Angriffsvektor auf die API. Rechte werden **nicht** in JWT-Claims
gecacht (sonst wirken Rechteentzüge erst nach Token-Ablauf). Neubewertung in Phase 15.

### E-25 🟨 Malware in Uploads
§53 fordert, das Malware-Risiko zu berücksichtigen. Supabase hat keinen eingebauten Scanner.
**Empfehlung:** In V1 nur Bilder (Logo, Avatar). Mit dem Dokumente-Modul folgen ein Scan-Job (ClamAV in einer Edge
Function oder einem externen Dienst) und eine Quarantäne bis zur Freigabe.

### E-26 🟩 Phasenreihenfolge der Spec hat Lücken
- **Audit Log** (MVP) hat keine eigene Phase, wird aber ab Phase 3 (Rollenänderungen) gebraucht → Infrastruktur in
  Phase 2.
- **Notifications** (MVP) hat keine eigene Phase, wird aber in Phase 8 (Publish) gebraucht → Infrastruktur in Phase 6.
- **Entitlements** werden in Phase 5 (tarifabhängige Module) und Phase 4 (`max_members`) gebraucht, kommen laut Spec
  aber erst in Phase 12 → Lese-Infrastruktur und Free-Plan in Phase 2; Stripe bleibt in Phase 12.
- **Dashboard** (Phase 6) liegt vor den Modulen, die Widgets liefern → Phase 6 baut das Framework. Jedes Modul liefert
  seine Widgets in seiner eigenen Phase.
- **Onboarding** (MVP) hat keine Phase → es wächst schrittweise mit (Phasen 2, 4, 5).
- **E-Mail-Versand** ist für Einladungen (Phase 4) nötig → Outbox und Resend in Phase 4.
- **i18n, Design Tokens, Fehler-Mapping** → Phase 0, damit kein UI-Text je hartkodiert entsteht.

### E-27 🟨 Staging-Kosten
Supabase-Free-Projekte pausieren nach Inaktivität.
**Empfehlung:** Staging startet als Free-Projekt; das Pausieren wird toleriert, CI weckt es vor Deployments. Ab dem
Pilot bekommt Staging ein bezahltes Projekt. Production immer im Pro-Plan (Backups). Restore-Test vor dem Pilot und
danach quartalsweise; zusätzlich ein wöchentlicher, verschlüsselter `pg_dump` in einen separaten Speicher (z. B.
Cloudflare R2), damit Backups nicht nur bei einem Anbieter liegen.

### E-30 🟨 Dashboard-Konfiguration pro Organisation oder pro Rolle?
§11: Der Owner konfiguriert Widgets. Owner- und Mitarbeiter-Dashboard unterscheiden sich aber stark.
**Empfehlung:** Je ein Layout pro Rolle (Fallback: Standardlayout). Widgets ohne passende Permission werden nie
angezeigt.

### E-32 🟨 Repository-Struktur (Abweichung von §77)
§77 legt `auth/`, `billing/` und `permissions/` neben die Feature-Module unter `src/`.
**Empfehlung:** Plattform-Code liegt gebündelt in `src/platform/` (Ebene A), Feature-Module in `src/modules/`
(Ebene B). Das spiegelt §3 wider und erlaubt eine Lint-Regel „Module importieren nur aus `platform`“. `supabase/`
liegt im Repo-Root (vom Supabase CLI erwartet).

### E-35 🟨 Realtime
§20 (Live-Status) verleitet zu Realtime-Subscriptions. Diese kosten Verbindungen und machen RLS-Debugging schwieriger.
**Empfehlung:** In V1 Polling (30–60 s) und Refetch bei Fensterfokus. Realtime nur, wenn Piloten es vermissen.

### E-36 🟩 Pagination
**Entscheidung:** Keyset-Pagination (`created_at, id`) für Logs, Notifications und Zeiteinträge. Offset-Pagination nur
für kleine, sortierbare Listen (Mitarbeiter).

## F. Aus dem Phase-0-Review (2026-10-19)

### E-38 🟩 Kein `citext` für E-Mail-Adressen
`citext`-Operatoren liegen im Schema `extensions`. In `SECURITY DEFINER`-Funktionen mit `search_path = ''` (Pflicht)
werden sie nicht gefunden, und Postgres vergleicht still case-sensitiv als `text`. Auch `citext = varchar`
(`auth.users.email`) ist case-sensitiv. Einladungs- und Dublettenprüfungen würden dadurch unbemerkt falsch.
**Entscheidung:** E-Mail-Spalten sind `text` mit `CHECK (email = lower(btrim(email)))`. RPCs normalisieren Eingaben,
Vergleiche mit `auth.users.email` laufen über `lower(...)`. Die Baseline installiert `citext` nicht.

### E-39 🟨 Kein gefilterter „öffentlicher“ View
Views laufen per Guardrail immer mit `security_invoker`. Eine gefilterte Sicht auf sonst gesperrte Zeilen (z. B.
Abwesenheiten von Kollegen ohne Typ) ist deshalb eine `SECURITY DEFINER`-RPC mit eigener Scope-Prüfung, kein View.

### E-40 🟨 Staging-Einschränkungen im Free-Plan
„Leaked password protection“ gibt es nur in bezahlten Supabase-Plänen. Solange Staging im Free-Plan läuft (E-27),
fehlt dort diese Prüfung. Das ist akzeptiert, weil Staging nur Testdaten enthält. Free-Projekte pausieren nach
Inaktivität und müssen vor einem Deployment im Dashboard aufgeweckt werden.

### E-41 🟨 Staging in Irland, Production in Frankfurt
Das Staging-Projekt wurde in `eu-west-1` (Irland) angelegt; die Region lässt sich nachträglich nicht ändern.
**Entscheidung:** Staging bleibt dort. Datenschutzrechtlich ist das gleichwertig (EU), der Unterschied ist nur die
Latenz (~35–45 ms statt ~10–15 ms aus Österreich), und Staging enthält nur Testdaten. Production wird in
`eu-central-1` (Frankfurt) angelegt.

### E-42 🟨 Cloudflare-Production zeigt vorerst auf Staging
Solange es kein Production-Supabase gibt, baut der `main`-Branch auf Cloudflare Pages mit den Staging-Werten
(`VITE_APP_ENV=staging`). So gibt es sofort eine erreichbare Testadresse. **Vor dem Pilot** werden die drei
Variablen der Production-Umgebung in Cloudflare auf das Production-Projekt umgestellt (und `VITE_APP_ENV=production`).

## G. Aus Phase 1 – Auth (2026-10-19)

### E-43 🟥 Registrierung ohne Passwort
§9 nennt für den Account „Name, E-Mail, Passwort oder Magic Link“. Die Roadmap sah für Phase 1 nur „Name, E-Mail,
Passwort“ vor.
**Entscheidung (Product Owner, 2026-10-19, angepasst durch E-46 am selben Tag):** Registriert wird nur mit Name und
E-Mail, das Konto entsteht immer über den Link in der Bestätigungs-E-Mail. Ein Passwort ist optional und wird erst
nach der Bestätigung festgelegt. Das erfüllt §9 („Passwort oder Magic Link“): Jedes Konto kann sich per E-Mail-Link
anmelden, mit Passwort zusätzlich per E-Mail und Passwort.
- `/signup` hat kein Passwortfeld und ruft `signInWithOtp` mit `shouldCreateUser: true` auf. `display_name` und
  `locale` gehen als Metadaten mit, daraus legt der Trigger das Profil an. Der Link bestätigt die Adresse und meldet
  an.
- Direkt nach der ersten Bestätigung folgt der freiwillige Schritt „Passwort festlegen“ (`/reset-password`,
  mindestens 10 Zeichen, höchstens 72 Byte, zweimal eingeben). Mit „Überspringen“ bleibt das Konto ohne Passwort.
- Ohne Passwort meldet man sich per „Anmeldelink per E-Mail“ an. Ein Passwort lässt sich jederzeit über „Passwort
  vergessen“ setzen.
- Der Anmeldelink auf `/login` legt keine Konten an (`shouldCreateUser: false`).
- Ursprünglich war das Passwort schon bei der Registrierung optional (mit Passwort `signUp`). Das ist mit E-46
  entfallen: Ein Passwort, das vor der Bestätigung gewählt wird, kann von jemand anderem stammen.

### E-44 🟥 E-Mail-Versand in Staging bis Phase 4
Phase 1 braucht Auth-E-Mails (Bestätigung, Anmeldelink, Passwort zurücksetzen), Resend kommt aber erst mit Phase 4
(E-26).
**Entscheidung (Product Owner, 2026-10-19):** Staging verschickt bis Phase 4 über den eingebauten E-Mail-Versand von
Supabase.
- Er liefert nur an Adressen von Mitgliedern des Supabase-Teams, auch mit +Label (z. B. `name+test1@…`). Andere
  Adressen lehnt Supabase ab (`email_address_not_authorized`); die App zeigt dann „An diese E-Mail-Adresse können wir
  gerade keine E-Mails senden …“.
- Er schafft nur rund 2 E-Mails pro Stunde für das ganze Projekt. Das Limit ist nur mit eigenem SMTP änderbar. Ist
  es erreicht, zeigt die App wie immer neutral „Prüfe dein Postfach“ (E-45), die Mail kommt aber nicht. Manuelle
  Tests auf Staging brauchen deshalb Zeit
  ([Umgebungen §2.4](umgebungen.md#24-auth-einstellungen-stagingproduction)). Automatische Tests mit E-Mails laufen
  nur lokal und in CI über Mailpit.
- Für Production reicht das nicht, echte Nutzer bekämen keine E-Mails. Production geht erst mit eigenem
  SMTP-Versand (Resend, Phase 4) in Betrieb.

### E-45 🟨 Bewusst akzeptierte Auth-Restrisiken
Phase 1 schließt die naheliegenden Lücken: neutrale Meldungen, Einlösen von E-Mail-Links erst nach Klick, sichere
Weiterleitung über `next`, Fehlercodes statt Rohtexten. Diese Restrisiken bleiben bewusst:
- **Enumeration auf API-Ebene.** Die UI zeigt bei Registrierung, Anmeldelink, Passwort vergessen und erneutem Senden
  immer denselben Zustand und wertet `identities` nie aus. Wer die Auth-API direkt aufruft, kann an Fehlercodes
  (z. B. `otp_disabled` beim Anmeldelink für eine unbekannte Adresse) und Antwortzeiten trotzdem teilweise erkennen,
  ob eine Adresse registriert ist. Ohne eigenen Server lässt sich das nicht abstellen.
- **Kein CAPTCHA, keine Kontosperre.** Gegen Passwortraten und Mail-Flut wirken nur die IP-basierten Rate-Limits von
  Supabase Auth und der Mindestabstand von 60 s zwischen zwei Mails an dieselbe Adresse. Angriffe über viele
  IP-Adressen bremst das kaum; dagegen helfen nur Mindestlänge 10 und der Leaked-Password-Check (Production).
  CAPTCHA (z. B. Cloudflare Turnstile über `[auth.captcha]`) wird in Phase 15 neu bewertet.
- **„Überall abmelden“ wirkt verzögert.** `signOut({ scope: 'global' })` (und `others` nach einem Passwortwechsel)
  widerruft die Refresh-Tokens sofort. Bereits ausgestellte Access-Tokens bleiben bis zu ihrem Ablauf gültig
  (`jwt_expiry`, derzeit 1 h). Rechte in Organisationen betrifft das nicht, weil die Helper die Membership live prüfen
  (E-24). Schlägt das globale Abmelden fehl, sagt die App das ausdrücklich.
- **Leaked-Password-Check nur in Production** (E-40). Staging prüft Passwörter nicht gegen bekannte Datenlecks. Die
  App kennt die Meldung trotzdem schon (`weak_password` mit Grund `pwned`).
- **Profil schon vor der Bestätigung.** Der Trigger legt die `profiles`-Zeile beim Anlegen in `auth.users` an, also
  vor der E-Mail-Bestätigung. Nie bestätigte Konten (Tippfehler, fremde Adressen) bleiben deshalb mit Profil liegen.
  Eine Bereinigung (Job, der unbestätigte Konten nach einer Frist löscht; `profiles` folgt per `on delete cascade`)
  kommt spätestens mit dem Löschkonzept in Phase 15. Das größere Risiko unbestätigter Konten (fremdes Passwort)
  schließt E-46; ein fremd gewählter Name bleibt (E-46, Restrisiko).

**Entscheidung (Product Owner, 2026-10-19): „Require current password when updating“ ist in Staging und Production
an.** Die Option gibt es nur im Dashboard (`config.toml` hat keinen Schlüssel dafür), lokal und in CI bleibt sie aus.
Wer das Passwort ändert, muss damit das aktuelle kennen. Ausnahme ist eine Sitzung aus einem E-Mail-Link (Methoden
`otp`, `magiclink`, `recovery`), also mit Zugriff auf das Postfach. Ein gestohlenes Token aus einem Passwort-Login
(E-24) reicht so nicht, um das Passwort zu ändern. `/reset-password` nutzt genau diesen Weg und lässt nur Sitzungen
aus E-Mail-Links zu, auch beim Schritt „Passwort festlegen“ nach der ersten Bestätigung (E-46); einen anderen
Passwortwechsel gibt es in Phase 1 nicht. Weil die E2E-Tests ohne die Option
laufen, wird sie auf Staging mit einem Negativtest nachgewiesen: Eine Sitzung aus einem Passwort-Login, die ohne
aktuelles Passwort ein neues setzen will, muss mit `current_password_required` scheitern
([Umgebungen §2.4](umgebungen.md#24-auth-einstellungen-stagingproduction), Test Schritt 6). Ein Passwort-Reset per
E-Mail-Link taugt als Nachweis nicht, er gelingt mit und ohne die Option. Bis zum Deployment von Phase 1 ist das
offen.

### E-46 🟥 Fremdes Passwort in einem unbestätigten Konto
Aus dem Review von Phase 1, am Quellcode von Supabase Auth (GoTrue v2.197.0, das Image der Supabase CLI 2.121)
geprüft.
**Problem (Pre-Account-Takeover):** Jemand registriert sich mit der Adresse einer anderen Person (z. B.
`anna@firma.at`) und einem eigenen Passwort. Das Konto bleibt unbestätigt, das Profil mit dem gewählten Namen
entsteht sofort. Registriert sich später die echte Person, mit oder ohne Passwort, ändert Supabase am bestehenden
unbestätigten Konto nichts (weder Passwort noch Name) und schickt nur eine neue Bestätigungs-E-Mail. Klickt sie den
Link, ist das Konto bestätigt und sie angemeldet, aber mit dem Passwort des Angreifers: Er kann sich danach jederzeit
mit E-Mail und Passwort anmelden. Wer ohne Passwort arbeitet, merkt davon nichts. Dasselbe passiert, wenn die Person
die erste Bestätigungs-E-Mail anklickt, die der Angreifer ausgelöst hat. Ab Phase 2/4, wenn Firmen ihre Leute per
E-Mail ins System holen, wird das ein realistischer gezielter Angriff.
**Warum nicht einfach im Code behoben:** In der Datenbank sieht der Angriff genauso aus wie eine echte Registrierung
mit Passwort, die per Link bestätigt wird. Jede wirksame Abhilfe ändert deshalb den Ablauf aus E-43.
**Optionen:**
1. **Passwort erst nach der Bestätigung:** Registrierung nur per E-Mail-Link, Passwort danach; ein Trigger auf
   `auth.users` löscht ein vorher gesetztes Passwort bei der ersten Bestätigung.
2. **E-43 beibehalten, Zeitfenster verkleinern:** unbestätigte Konten nach 24 h löschen (Job, z. B. `pg_cron`). Ein
   Angreifer kann sich danach aber einfach neu registrieren.
3. **Bewusst akzeptieren** bis Phase 15 und nur in E-45 dokumentieren.

**Entscheidung (Product Owner, 2026-10-19): Option 1** (wie empfohlen). Sie ersetzt in E-43 den Teil „Passwort bei
der Registrierung optional“. Umgesetzt in Phase 1:
- **App:** `/signup` fragt nur Name und E-Mail und legt das Konto immer per `signInWithOtp` an (E-43). Hat ein Link
  das Konto zum ersten Mal bestätigt, führt `/auth/confirm` zum freiwilligen Schritt „Passwort festlegen“
  (`/reset-password` im Einrichtungsmodus, mit „Überspringen“). Die App erkennt das nur an Server-Zeitstempeln aus der
  Antwort von `/verify`, nie an der Geräteuhr: `email_confirmed_at` und `last_sign_in_at` stammen aus derselben
  Anfrage (höchstens 60 s auseinander), und seit der Bestätigung wurde kein weiterer Link verschickt
  (`confirmation_sent_at`, `recovery_sent_at`; `src/platform/auth/first-confirmation.ts`). Der Schritt ist nur UX;
  wer ihn verpasst, hat kein Passwort und setzt es bei Bedarf über „Passwort vergessen“.
- **Datenbank** (Migration `20261019204325_clear_password_before_first_confirmation.sql`): Trigger
  `on_auth_user_first_confirmation` (`BEFORE UPDATE` auf `auth.users`, ohne Spaltenliste, damit Migrationen von
  Supabase Auth die Spalte `email_confirmed_at` weiter ändern können) ruft
  `private.clear_password_before_first_confirmation()` auf (`SECURITY DEFINER`, `search_path = ''`). Er setzt
  `encrypted_password` auf `NULL`, wenn alle drei Bedingungen gelten:
  - Das Konto wird zum ersten Mal bestätigt (`email_confirmed_at` vorher leer, nachher gesetzt).
  - Vorher ging eine Bestätigungs-E-Mail hinaus (`confirmation_sent_at` gesetzt). Das trifft jede
    Selbstregistrierung (`signUp`, `signInWithOtp`), auch wenn die Bestätigung über einen Recovery-Link kommt.
  - Dieselbe Anweisung setzt nicht selbst ein Passwort (`encrypted_password` unverändert).

  Das wirkt auch, wenn jemand `/auth/v1/signup` direkt mit Passwort aufruft. `NULL` heißt für GoTrue „kein
  Passwort“, wie bei seinem eigenen Schutz für OAuth-Anmeldungen; die Passwort-Anmeldung scheitert mit
  `invalid_credentials`. Unberührt bleiben Konten aus `admin.createUser` mit `email_confirm: true` und Passwort
  (keine Mail, `confirmation_sent_at` leer; Integrationstests, später Werkzeuge), Passwörter, die nach der
  Bestätigung gesetzt werden (`updateUser`, „Passwort vergessen“), und alle anderen Updates. Die Annahmen über
  GoTrue stehen mit Quellstellen im Kommentar der Migration.
- **Warum das reicht:** GoTrue schreibt bei der Bestätigung nur `confirmation_token` und `email_confirmed_at`, nie
  die ganze Zeile. Ein Passwort aus der Zeit vor der Bestätigung ist danach weg, egal von wem es stammt. Ohne Passwort
  entsteht eine Sitzung nur über einen E-Mail-Link, ein neues Passwort setzt also nur, wer das Postfach hat.
- **Bekannte Nebenwirkungen:** Ein Konto aus `admin.generateLink({ type: 'signup', password })` verliert dieses
  Passwort beim Einlösen des Links (bestätigte Konten deshalb mit `admin.createUser` anlegen). Ein Telefon-Konto würde
  sein Passwort bei der ersten E-Mail-Bestätigung verlieren; die Registrierung per Telefon ist aus.
- **Restrisiko (akzeptiert):** Der Name, den der Angreifer bei der Registrierung mitschickt, bleibt im Profil stehen,
  bis man ihn auf einer Profilseite ändern kann (spätere Phase). Er fällt auf der Startseite („Hallo, ‹Name›!“) auf.
- **Tests:** pgTAP `020_auth_users_password_guard.test.sql` (25 Assertions: Struktur und Rechte, jede Bedingung
  einzeln, als `postgres` und, wo die DB den Rollenwechsel erlaubt, als `supabase_auth_admin`), Integrationstests
  gegen das echte GoTrue (`tests/integration/password-guard.test.ts`: Bestätigung über die Mail des Angreifers, eine
  spätere Registrierung per Link, den Anmeldelink von `/login` und „Passwort vergessen“) und ein `@supabase`-E2E-Test
  (fremdes Passwort per API, Bestätigung in der App, Passwort-Anmeldung scheitert). CI prüft nur das GoTrue der
  gepinnten Supabase CLI; das gehostete Supabase Auth wird unabhängig aktualisiert, deshalb nach Auth-Updates den
  Nachweis E-46 aus `umgebungen.md` §2.4 (Test nach dem Deployment, Schritt 4) wiederholen.

