# TeamPanel – Widersprüche, Lücken, Risiken und Architekturentscheidungen

> Status: **Freigegeben am 2026-10-19.** Der Product Owner hat alle Empfehlungen dieses Dokuments übernommen. Jede
> **Empfehlung** gilt damit als verbindliche Entscheidung, bis sie ausdrücklich geändert wird. Nichts hier ändert die
> [Spezifikation](../product/spezifikation.md) still.
>
> **Legende:** 🟥 Entscheidung des Product Owners nötig, bevor die betroffene Phase startet ·
> 🟨 Empfehlung wird umgesetzt, solange niemand widerspricht · 🟩 rein technische Präzisierung

## Übersicht: Product-Owner-Entscheidungen (alle am 2026-10-19 wie empfohlen getroffen)

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

