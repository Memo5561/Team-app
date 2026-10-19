# TeamPanel – Masterplan (Source of Truth)

> **Dieses Dokument ist die zentrale Source of Truth des Projekts.**
> Inhaltlich unverändert aus dem Masterplan übernommen, nur als Markdown formatiert.
> Abweichungen, Präzisierungen und Widersprüche werden **nicht hier**, sondern in
> [`docs/architecture/entscheidungen-und-risiken.md`](../architecture/entscheidungen-und-risiken.md) dokumentiert.

- **Dokumenttyp:** Product Specification + Technical Architecture + Development Roadmap
- **Arbeitstitel:** TeamPanel
- **Plattform:** Responsive Web-App / PWA
- **Geschäftsmodell:** SaaS mit Free-, Pro- und Business-Tarif
- **Primärmarkt zum Start:** Kleine und mittlere Unternehmen in Österreich/EU
- **KI:** Nicht Bestandteil von V1. Architektur muss spätere KI-Module ermöglichen.

---

## 1. Produktvision

TeamPanel ist kein branchenspezifisches Mitarbeiterprogramm.
TeamPanel soll ein universelles, modular konfigurierbares Betriebssystem für kleine und mittlere Teams werden.

Ein Unternehmer erstellt einen Account, legt sein Unternehmen an und baut sich anschließend ohne Programmierkenntnisse sein eigenes internes Team-Portal zusammen.

Beispiele für mögliche Kunden: Friseursalons, Barbershops, Restaurants, Cafés, Reinigungsfirmen, Bauunternehmen, Einzelhandel, Werkstätten, Fitnessstudios, Agenturen, kleine Büros, Lieferdienste, Handwerksbetriebe, Hotels, Eventfirmen, Sicherheitsunternehmen.

Das System darf nicht auf eine bestimmte Branche zugeschnitten sein. Stattdessen besteht TeamPanel aus Modulen.

- Ein **Friseur** aktiviert: Mitarbeiter, Dienstplan, Zeiterfassung, Urlaub, Aufgaben, Checklisten
- Eine **Reinigungsfirma** aktiviert zusätzlich: Standorte, Formulare, Dokumente
- Eine **Baufirma** aktiviert: Teams, Projekte, Checklisten, Dokumente, Arbeitszeiten

## 2. Zentrales Produktversprechen

Der Benutzer soll das Gefühl haben: *„Ich baue mir mein eigenes Team-System.“*
Nicht: *„Ich muss mich an irgendeine komplizierte HR-Software anpassen.“*

Das Produkt muss deshalb drei Grundprinzipien erfüllen:

### 2.1 Einfachheit

Ein kleiner Unternehmer ohne IT-Kenntnisse muss innerhalb weniger Minuten verstehen:

- wie Mitarbeiter hinzugefügt werden,
- wie Rollen funktionieren,
- wie Module aktiviert werden,
- wie ein Dienstplan erstellt wird,
- wie Mitarbeiter einstempeln,
- wie Aufgaben verteilt werden.

### 2.2 Modularität

Nicht jeder Kunde sieht automatisch jede Funktion. Der Owner aktiviert nur die Module, die sein Unternehmen benötigt.

### 2.3 Konfigurierbarkeit

Unternehmen dürfen: eigene Rollen erstellen, Berechtigungen konfigurieren, Module ein-/ausschalten, Standorte anlegen, Teams erstellen, Dashboard konfigurieren, Firmenlogo hochladen, Unternehmensfarben festlegen, Arbeitsregeln konfigurieren.

## 3. Produktstruktur

Das System besteht aus drei Ebenen:

**Ebene A – TeamPanel Plattform** (technisches Fundament):
Authentifizierung, Unternehmen/Workspaces, Benutzer, Rollen, Berechtigungen, Abonnements, Tariflimits, Benachrichtigungen, Audit Logs, Dateiablage, Datenschutz, Sicherheit.

**Ebene B – Kernmodule** (die eigentlichen Team-Funktionen):
Mitarbeiter, Teams, Standorte, Dienstplan, Zeiterfassung, Urlaub/Abwesenheiten, Aufgaben, Checklisten, Ankündigungen, Dokumente, Formulare, Statistiken.

**Ebene C – zukünftige Erweiterungen** (noch NICHT V1):
KI, Marketplace, externe Integrationen, API für Drittanbieter, Payroll, Lohnabrechnung, Buchhaltung, CRM, Inventar, Projektmanagement, GPS-Tracking, NFC-Terminals, biometrische Zeiterfassung.

Die Architektur soll diese Funktionen später ermöglichen, aber sie dürfen V1 nicht unnötig kompliziert machen.

## 4. Multi-Tenant-Architektur

TeamPanel ist ein Multi-Tenant-SaaS. Jede Firma ist ein eigener Tenant. Technischer Begriff: `organization`.

```
TeamPanel
├── Unternehmen A
│   ├── Mitarbeiter
│   ├── Rollen
│   ├── Aufgaben
│   └── Arbeitszeiten
├── Unternehmen B
│   ├── Mitarbeiter
│   ├── Rollen
│   ├── Aufgaben
│   └── Arbeitszeiten
└── Unternehmen C
```

Ein Benutzer darf niemals Daten eines anderen Unternehmens sehen.
Diese Trennung muss auf Datenbankebene durchgesetzt werden – nicht nur `if user.organization == ...` im Frontend.

Jede mandantenbezogene Tabelle erhält `organization_id`. Die Zugriffsregeln müssen durch Datenbank-RLS abgesichert werden.

## 5. Benutzertypen

- **Account:** Die persönliche Anmeldung einer Person, z. B. `max@example.com`.
- **Mitgliedschaft:** Die Zugehörigkeit dieses Accounts zu einem Unternehmen.

Ein Account kann später theoretisch Mitglied in mehreren Unternehmen sein:

```
Max Mustermann
  Unternehmen A: Manager
  Unternehmen B: Mitarbeiter
```

Datenmodell deshalb nicht `users.organization_id`, sondern `users`, `organizations`, `memberships`.

## 6. Standardrollen

Bei Erstellung eines Unternehmens werden zunächst Standardrollen angeboten.

**Owner** – volle Kontrolle. Darf: Unternehmen verwalten, Abonnement verwalten, Mitarbeiter verwalten, Rollen erstellen, Berechtigungen verändern, Module aktivieren, alle Arbeitszeiten sehen, Dienstpläne verwalten, Dokumente verwalten, Audit Logs sehen.
Der Owner darf nicht versehentlich aus dem Unternehmen ausgesperrt werden.

**Admin / Manager** – fast vollständige operative Kontrolle. Kein Zugriff auf: Eigentümerwechsel, Zahlungsinformationen, Kündigung des Hauptkontos.

**Teamleiter** – kann beispielsweise: Mitglieder seines Teams sehen, Dienstplan seines Teams verwalten, Aufgaben vergeben, Urlaubsanträge bearbeiten. Rechte müssen konfigurierbar sein.

**Mitarbeiter** – standardmäßig: eigenes Profil, eigene Schichten, eigene Zeiterfassung, eigene Aufgaben, eigene Urlaubsanträge, Team-News. Keine administrativen Unternehmensdaten.

## 7. Custom Roles

Pro- und Business-Kunden können eigene Rollen erstellen.
Beispiele: Filialleiter, Küchenchef, Lehrling, Fahrer, Vorarbeiter, Rezeption, Reinigungskraft, Senior Stylist.

Eine Rolle besteht aus: Name, Beschreibung, Farbe/Icon (optional), Berechtigungen.

## 8. Permission System

Berechtigungen dürfen niemals hardcoded an einzelne Rollennamen gekoppelt sein. Verwende Permission Keys, z. B.:

```
employees.view.self   employees.view.team   employees.view.all
employees.create      employees.edit        employees.delete
schedule.view.self    schedule.view.team    schedule.manage
time.clock            time.view.self        time.view.team        time.edit
tasks.create          tasks.assign          tasks.complete        tasks.manage
leave.request         leave.approve
documents.view        documents.manage
settings.manage       billing.manage        roles.manage
```

Die UI zeigt nur Funktionen, für die Berechtigungen vorhanden sind.
Aber: Die tatsächliche Sicherheit muss server-/datenbankseitig erfolgen. Frontend-Berechtigungen sind nur UX.

## 9. Onboarding

Nach Registrierung darf der Benutzer nicht einfach in einem leeren Dashboard landen. Es gibt einen Setup-Assistenten.

1. **Account** – Name, E-Mail, Passwort oder Magic Link, E-Mail bestätigen
2. **Unternehmen** – Firmenname, Branche optional, Land, Zeitzone, Standardsprache
3. **Unternehmensgröße** – Nur ich, 2–5, 6–10, 11–30, 31–100, 100+
4. **Module auswählen** (Checkboxen) – Dienstplan, Zeiterfassung, Aufgaben, Urlaub, Checklisten, Dokumente, Team-News, Formulare
5. **Ersten Standort erstellen** – z. B. „Hauptfiliale“. Standort ist optional für Ein-Personen-Unternehmen.
6. **Mitarbeiter einladen** – per E-Mail, Einladungslink; später QR-Code
7. **Dashboard** – System erstellt anhand der aktivierten Module ein Standarddashboard. Danach: „TeamPanel öffnen“

## 10. Startdashboard

Owner sieht beispielsweise:

```
Guten Morgen, Mehmet

Heute
────────────────────
14 Mitarbeiter
11 anwesend
2 frei
1 im Urlaub
[Anwesenheit]

Dienstplan heute
────────────────────
09:00 Mehmet
09:00 Ali
10:00 Sarah

Offene Aufgaben
────────────────────
12 offen
4 überfällig

Urlaubsanträge
────────────────────
3 warten auf Entscheidung
```

Dashboard-Komponenten müssen modular sein.

## 11. Dashboard Builder

V1 soll keinen komplett freien Webseiten-Builder enthalten. Stattdessen gibt es vorbereitete Widgets:
Anwesenheit heute, Meine nächste Schicht, offene Aufgaben, Team-Aufgaben, Mitarbeiterstatus, Urlaubsanträge, heutiger Dienstplan, Arbeitsstunden, Ankündigungen, Schnellaktionen.

Owner kann: Widgets aktivieren, Widgets deaktivieren, Reihenfolge ändern. Später kann Drag & Drop ergänzt werden.

## 12. Modulsystem

Jedes Modul besitzt: `module_key`, `name`, `description`, `icon`, `enabled`, `required_plan`.

Beispiel-Keys: `time_tracking`, `schedule`, `tasks`, `leave`, `documents`, `forms`, `announcements`.

Navigation wird dynamisch aus aktivierten Modulen erstellt.
Deaktiviert ein Owner „Dokumente“, soll dieses Modul für das Unternehmen verschwinden. Daten dürfen dadurch nicht automatisch gelöscht werden.

## 13. Mitarbeitermodul

Jedes Mitglied besitzt Basisdaten: Vorname, Nachname, Profilbild, E-Mail, Telefonnummer optional, Personalnummer optional, Eintrittsdatum, Rolle, Team, Standort, Status.

Status: `invited`, `active`, `inactive`, `archived`.

Mitarbeiter dürfen normalerweise nicht vollständig gelöscht werden, wenn bereits historische Daten wie Arbeitszeiten existieren. Stattdessen: `archived`.

## 14. Teams

Unternehmen können Teams erstellen, z. B. Küche, Service, Verkauf, Reinigung, Filiale Wien, Montage, Frühschicht.

Ein Mitarbeiter kann V1 einem Hauptteam zugeordnet sein. Architektur soll später mehrere Teams ermöglichen.

Team besitzt: `id`, `organization_id`, `name`, `description`, `manager_id`, `location_id`.

## 15. Standorte

Standorte sind wichtig für Unternehmen mit mehreren Filialen.
Standort enthält: Name, Adresse, Zeitzone, Status.
Beispiele: Filiale Wien 10, Filiale Graz, Lager, Zentrale.

Standortzugriff kann rollenabhängig sein. Manager Wien soll nicht automatisch Daten aus Graz sehen.

## 16. Zeiterfassung

Eines der wichtigsten Module. Mitarbeiter sieht einen großen Button `[ EINSTEMPELN ]`.

Nach Einstempeln:

```
Arbeitszeit
03:14:28
[ PAUSE STARTEN ]
[ AUSSTEMPELN ]
```

## 17. Zeiterfassungs-Events

Arbeitszeiten sollten intern nicht nur als `start`/`ende` gespeichert werden. Stattdessen Event-Modell verwenden:
`CLOCK_IN`, `BREAK_START`, `BREAK_END`, `CLOCK_OUT`. Dadurch entsteht eine nachvollziehbare Historie.

```
08:57 CLOCK_IN
12:03 BREAK_START
12:31 BREAK_END
17:08 CLOCK_OUT
```

Aus diesen Events werden die tatsächlichen Arbeitszeiten berechnet.

## 18. Manuelle Korrekturen

Ein Mitarbeiter darf vergangene Arbeitszeit nicht einfach unsichtbar verändern. Stattdessen: **Korrekturanfrage**.

Beispiel: „Ich habe gestern vergessen auszustempeln.“
Mitarbeiter sendet: *Gewünschtes Ende: 18:00, Grund: Ausstempeln vergessen.*
Manager: Genehmigen / Ablehnen.

Jede Änderung erzeugt einen Audit-Eintrag.

## 19. Pausen

System unterstützt: Pause starten, Pause beenden, mehrere Pausen, automatische Berechnung der Nettoarbeitszeit.

```
Gesamtzeit: 8:31
Pause:      0:30
Arbeitszeit: 8:01
```

Pausenregeln können später automatisiert werden. V1 berechnet zunächst nur dokumentierte Pausen.

## 20. Arbeitszeit-Status

Mögliche Live-Status: `OFFLINE`, `WORKING`, `ON_BREAK`, `FINISHED`.

Chef-Dashboard:

```
● Mehmet arbeitet seit 08:57
● Ali Pause seit 12:03
○ Sarah noch nicht eingestempelt
```

Keine permanente Standortüberwachung.

## 21. Dienstplan

Ansichten: Tag, Woche, Mitarbeiter, Standort. V1-Fokus: Wochenansicht.

```
         Mo     Di     Mi     Do    Fr
Mehmet   9–17   9–17   Frei   9–17  9–15
Ali      10–18  10–18  10–18  Frei  10–18
Sarah    Frei   8–16   8–16   8–16  8–16
```

## 22. Schicht

Shift besitzt: `organization_id`, `location_id`, `employee_id`, `date`, `start_time`, `end_time`, `break_minutes`, `status`, `notes`.

Status: `draft`, `published`, `cancelled`. Mitarbeiter dürfen nur veröffentlichte Schichten sehen.

## 23. Dienstplan Publishing

Manager baut Dienstplan zunächst als Entwurf. Mitarbeiter sehen Änderungen noch nicht.
Manager klickt „Dienstplan veröffentlichen“. Danach: Mitarbeiter sehen neue Schichten, In-App-Benachrichtigung, optional E-Mail.
Das verhindert, dass unfertige Planungen sichtbar werden.

## 24. Verfügbarkeit

Mitarbeiter kann Verfügbarkeit eintragen, z. B. Montag: verfügbar, Dienstag: ab 14 Uhr, Mittwoch: nicht verfügbar.
Dies ist keine automatische Dienstplanerstellung. Es dient dem Manager als Information.

## 25. Schichttausch

Nicht zwingend für erste Beta. Phase nach MVP.

Ablauf: Mitarbeiter A → Schicht zum Tausch anbieten; Mitarbeiter B → übernehmen; Manager → genehmigen.
Erst nach Genehmigung wird der Dienstplan geändert.

## 26. Urlaub und Abwesenheit

Mitarbeiter: Urlaub beantragen. Eingaben: Typ, Von, Bis, halber Tag optional, Kommentar optional.
Typen beispielsweise: Urlaub, Zeitausgleich, Sonstige Abwesenheit.

Krankheitsdaten besonders vorsichtig behandeln. Keine unnötigen medizinischen Informationen verlangen.

## 27. Urlaubs-Workflow

```
Mitarbeiter → Antrag → Manager → Genehmigt / Abgelehnt → Dienstplan erhält Abwesenheit
```

Status: `pending`, `approved`, `rejected`, `cancelled`.

## 28. Aufgaben

Task enthält: Titel, Beschreibung, Fälligkeitsdatum, Priorität, Mitarbeiter, Team, Standort, Status, Checkliste optional, Anhänge optional, Kommentare optional.

Status: `open`, `in_progress`, `completed`, `cancelled`.
Priorität: `low`, `normal`, `high`, `urgent`.

## 29. Wiederkehrende Aufgaben

Pro-Tarif. Beispiel: Jeden Montag um 09:00 Lager kontrollieren. Oder: Jeden Abend Salon schließen.

Nicht tausende zukünftige Aufgaben sofort erzeugen. Stattdessen Recurrence Rule speichern und Aufgaben bei Bedarf erzeugen.

## 30. Checklisten

Restaurant schließen: ☐ Kasse kontrollieren ☐ Kühlschrank prüfen ☐ Geräte ausschalten ☐ Türen abschließen
Friseursalon: ☐ Handtücher ☐ Waschplätze ☐ Produkte auffüllen ☐ Boden reinigen

Checklisten können Aufgaben zugeordnet, als Template gespeichert und wiederverwendet werden.

## 31. Team-News / Ankündigungen

Owner oder Manager veröffentlicht, z. B. „Neue Öffnungszeiten ab Montag.“
Option: Lesebestätigung erforderlich. Dann kann der Manager sehen: *Gelesen: 12/15*.

Keine vollständige WhatsApp-Kopie in V1. Kein komplexer Messenger.

## 32. Dokumente

Unternehmensdokumente: Arbeitsanweisungen, Handbücher, Preislisten, PDFs, Sicherheitsinformationen.
Ordnerstruktur: Allgemein, Mitarbeiter, Standorte, Teams.

Dokument besitzt Zugriffsregeln. Private Mitarbeiterdokumente dürfen nicht für andere Mitarbeiter sichtbar sein.
Dateien müssen über private Storage-Buckets und signierte URLs ausgeliefert werden.

## 33. Formulare

Phase nach Kern-MVP. Owner erstellt Formular aus Feldtypen: Text, Langtext, Zahl, Datum, Auswahl, Checkbox, Foto/Datei.

Beispiele: *Schadensmeldung* (Standort, Beschreibung, Datum, Foto), *Materialbestellung* (Produkt, Menge, Kommentar).

Keine komplett freie Datenbanklogik in V1.

## 34. Benachrichtigungen

**V1 In-App**, z. B.: neue Aufgabe, Urlaub genehmigt, Dienstplan veröffentlicht, Einladung, Ankündigung.
**E-Mail:** Nur wichtige Ereignisse.
**Später:** Web Push, Mobile Push, SMS, WhatsApp.

Notification Center: Alle / Ungelesen. Benutzer kann Benachrichtigungseinstellungen konfigurieren.

## 35. Reporting

V1 benötigt einfache, nützliche Auswertungen.

- **Arbeitszeit:** heute, Woche, Monat, pro Mitarbeiter, pro Team, pro Standort
- **Anwesenheit:** aktuell anwesend, Pausen, Abwesenheiten
- **Aufgaben:** offen, erledigt, überfällig
- **Urlaub:** offen, genehmigt, historisch

Keine komplizierte Business Intelligence Plattform bauen.

## 36. Export

Pro/Business: CSV Export für Mitarbeiter, Arbeitszeiten, Urlaub, Aufgaben.
Später: Excel, PDF, Payroll-Integrationen.

## 37. Free / Pro / Business

Tarife müssen technisch über ein Entitlement-System gesteuert werden. Nicht überall Code schreiben wie `if plan == pro`. Stattdessen `entitlements`, z. B.:

```
max_members  max_locations  custom_roles  documents_enabled  forms_enabled
export_enabled  recurring_tasks  branding_enabled  audit_log_retention
```

## 38. Vorläufiger Free Tarif

Preis: 0 €.

Vorschlag: 1 Unternehmen, 1 Standort, bis zu 10 aktive Mitglieder, Standardrollen, Mitarbeiterverwaltung, Basis-Dienstplan, Zeiterfassung, einfache Aufgaben, Urlaub, Team-News, begrenzter Speicher, Basisstatistiken.

Nicht enthalten: eigene Rollen, erweiterte Exporte, Formulare, erweiterte Dokumente, wiederkehrende Aufgaben, eigenes Branding, erweiterte Audit-Historie, API.

Die Limits müssen später ohne Codeänderung geändert werden können.

## 39. Pro Tarif

Vorläufig ca. 29,90 € / Monat.
Beispielumfang: bis 30 aktive Mitglieder, mehrere Standorte, eigene Rollen, eigene Berechtigungen, Dokumente, Formulare, wiederkehrende Aufgaben, erweiterte Reports, CSV Export, Branding, erweiterte Checklisten.

## 40. Business Tarif

Vorläufig ca. 59,90 € / Monat.
Beispiel: größere Teams, mehr Standorte, detailliertes Audit Log, erweiterte Rechte, Prioritätssupport, zukünftige API, zukünftige Integrationen, größere Speicherlimits.

Preise sind Produktentscheidungen und dürfen nicht tief im Code verankert sein.

## 41. Billing

Für Abonnements: **Stripe**. Stripe ist alleinige Quelle für Zahlungsstatus.
Eigene Datenbank speichert Spiegelinformationen: `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `current_period_end`.

Stripe-Webhooks müssen signaturgeprüft, idempotent und serverseitig verarbeitet werden.
Beispiele: `subscription.created`, `subscription.updated`, `subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

Frontend darf niemals selbst behaupten: „Der Kunde hat bezahlt.“

## 42. Grace Period

Wenn Zahlung fehlschlägt: Nicht sofort Unternehmen löschen.
Status: `active`, `past_due`, `grace_period`, `restricted`, `cancelled`.

Im eingeschränkten Modus sollten Daten weiterhin lesbar sein. Keine Kundendaten wegen eines fehlgeschlagenen Monats sofort löschen.

## 43. Empfohlener Tech-Stack

Ziel: günstig, wartbar, modern, skalierbar, sehr gut mit Claude entwickelbar.

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, React Hook Form, Zod
- **Backend / Datenbank:** Supabase – PostgreSQL, Authentication, Storage, Realtime nur wo sinnvoll, Row Level Security, Edge Functions
- **Hosting Frontend:** Cloudflare Pages
- **Billing:** Stripe
- **Transaktions-E-Mail:** Resend oder vergleichbarer Anbieter
- **Tests:** Vitest, React Testing Library, Playwright, Datenbank-/RLS-Tests
- **Repository:** GitHub
- **CI:** GitHub Actions

## 44. Warum PWA

TeamPanel soll zunächst keine separate native Android- und iOS-App benötigen. Responsive Web-App + PWA.
Dadurch funktioniert: Desktop, Windows, Mac, Android, iPhone, Tablet.
Mitarbeiter können TeamPanel auf den Homescreen installieren. Später kann bei Bedarf eine native App folgen.

## 45. Mobile-First

Mitarbeiter verwenden das System häufig am Smartphone. Daher müssen mindestens folgende Funktionen mobile-first sein:
Einstempeln, Ausstempeln, Pause, Aufgaben, Dienstplan, Urlaub, Benachrichtigungen.

Owner-Dashboard darf auf Desktop umfangreicher sein.

## 46. Navigation

Desktop:

```
Dashboard
TEAM          Mitarbeiter, Teams, Standorte
ARBEIT        Dienstplan, Zeiterfassung, Urlaub
ORGANISATION  Aufgaben, Checklisten, Dokumente, Formulare, Ankündigungen
AUSWERTUNG    Reports
SYSTEM        Einstellungen, Abonnement
```

Nicht aktivierte Module verschwinden.

## 47. Mobile Navigation

Unterer Bereich: Home · Plan · Zeit · Aufgaben · Mehr.
Owner kann zusätzliche Managementfunktionen über „Mehr“ öffnen.

## 48. Designprinzipien

UI soll sein: modern, ruhig, professionell, leicht verständlich, keine überladene Enterprise-Software, große Touchflächen, gute Lesbarkeit, Dark Mode später oder optional, responsive, accessible.

Farben nicht hart im Code verteilen. Design Tokens verwenden.

## 49. Datenmodell – Kerntabellen

Mindestens:

```
users  organizations  memberships  roles  permissions  role_permissions
teams  locations  modules  organization_modules  employee_profiles
clock_events  time_entries  time_adjustment_requests  shifts  availability
leave_types  leave_requests  tasks  task_assignments  task_checklist_items
task_templates  announcements  announcement_reads  documents  document_permissions
form_templates  form_fields  form_submissions  notifications  subscriptions
plan_entitlements  audit_logs
```

Alle relevanten Tabellen benötigen `id`, `organization_id`, `created_at`, `updated_at` – wo sinnvoll.

## 50. Database Constraints

Nicht nur Frontend-Validierung. Datenbank soll kritische Regeln ebenfalls absichern, z. B.:

- eindeutige Membership pro User/Organisation
- keine negative Schichtdauer
- kein Ende vor Start
- gültige Statuswerte
- Foreign Keys
- NOT NULL wo erforderlich
- Indizes auf häufige Filter

Wichtige Indizes: `organization_id`, `user_id`, `employee_id`, `location_id`, `created_at`, `status`, `date`.

## 51. Row Level Security

RLS muss auf allen exponierten mandantenbezogenen Tabellen aktiv sein.

Grundregel: User darf nur Datensätze lesen, deren `organization_id` einer aktiven Membership des Users entspricht. Danach zusätzliche Permission-Regeln.

- Mitarbeiter: eigene `time_entries`
- Manager: `time_entries` seines Teams
- Owner: alle `time_entries` des Unternehmens

Service Role Key darf niemals im Browser landen.

## 52. Audit Log

Für administrative Aktionen: `actor_user_id`, `organization_id`, `action`, `entity_type`, `entity_id`, `before`, `after`, `timestamp`, `ip` optional.

Beispiele: `ROLE_UPDATED`, `EMPLOYEE_ARCHIVED`, `TIME_ENTRY_CORRECTED`, `LEAVE_APPROVED`, `SUBSCRIPTION_CHANGED`.

Audit Logs dürfen normale Mitarbeiter nicht manipulieren können.

## 53. Sicherheit

Mindestens: HTTPS, sichere Authentifizierung, E-Mail-Verifizierung, Rate Limits, sichere Cookies/Tokens, keine Secrets im Frontend, RLS, Input Validation, Output Escaping, Schutz gegen XSS, Schutz gegen CSRF wo erforderlich, sichere File Uploads, MIME-Validation, Dateigrößenlimits, Malware-Risiko bei Uploads berücksichtigen, signierte Datei-URLs, Audit Logs, Session Revocation.

Optional später: MFA, SSO, Passkeys.

## 54. DSGVO / Privacy by Design

Produkt von Anfang an datensparsam entwickeln. Prinzipien: nur notwendige Daten sammeln, klare Zwecke, Rechte beschränken, Löschkonzept, Exportmöglichkeit, Aufbewahrungsregeln, EU-Datenregion bevorzugen, keine unnötige GPS-Erfassung, keine heimliche Mitarbeiterüberwachung.

Krankheitsinformationen besonders sensibel behandeln. Nicht speichern *„Diagnose: Grippe“*, wenn eigentlich nur notwendig ist: *„Abwesend“*.

## 55. Datenlöschung

- **Mitglied archivieren:** Historische Unternehmensdaten bleiben.
- **Benutzeraccount löschen:** Personenbezogene Accountdaten entsprechend Regeln entfernen/anonymisieren.
- **Unternehmen löschen:** Nicht sofort physisch löschen. Workflow: Kündigung → Grace Period → Exportmöglichkeit → geplante Löschung → endgültige Löschung.

## 56. Backups

Produktionsbetrieb benötigt: automatisierte Datenbankbackups, getesteten Restore-Prozess, getrennte Produktions-/Entwicklungsumgebung.
Backup ohne getestete Wiederherstellung gilt nicht als vollständige Backup-Strategie.

## 57. Umgebungen

Mindestens: `LOCAL`, `STAGING`, `PRODUCTION`. Keine Tests direkt auf Produktionsdaten.
Separate: Datenbanken, API Keys, Stripe Keys, Domains.

## 58. Feature Flags

Neue größere Funktionen nicht sofort für alle veröffentlichen. Beispiel: `forms_v2`, `shift_swap`, `new_dashboard`.
Dadurch können Pilotkunden neue Funktionen testen.

## 59. Demo-Unternehmen

Development Seed: **Demo GmbH**. Mitarbeiter: Owner, Manager, Mitarbeiter 1, Mitarbeiter 2.
Mit: Schichten, Arbeitszeiten, Urlaub, Aufgaben, Ankündigungen.
Dadurch ist die App während Entwicklung jederzeit realistisch testbar.

## 60. Import

Später wichtig für Kundenwechsel. Mindestens Mitarbeiterimport über CSV vorbereiten.
Format: Vorname, Nachname, E-Mail, Rolle, Team, Standort.
Vor Import: Vorschau, Fehlerprüfung, Dublettenprüfung.

## 61. Fehlerbehandlung

Keine technischen Fehlermeldungen an normale Benutzer.
Schlecht: `PostgREST error 23505`. Gut: „Diese E-Mail ist bereits Mitglied dieses Unternehmens.“
Technische Details nur Logging.

## 62. Observability

Produktion benötigt: Error Tracking, Server Logs, failed Webhook Tracking, Login-Anomalien, Datenbankperformance, Health Checks.
Keine sensiblen Mitarbeiterdaten in Logs schreiben.

## 63. Performance

Normale App-Navigation soll schnell reagieren. Nicht bei jedem Seitenwechsel komplette Datenbank neu laden.
Verwende: Query Caching, Pagination, Indizes, Lazy Loading, Code Splitting, Serverfilter.
Keine Abfrage `SELECT * FROM everything`.

## 64. Pagination

Listen wie Mitarbeiter, Audit Logs, Arbeitszeiten, Aufgaben, Notifications müssen paginiert werden.
Kein Laden von zehntausenden Datensätzen auf einmal.

## 65. Zeitzonen

Zeitstempel intern: UTC. Darstellung: Unternehmens-/Standort-Zeitzone.
Datumsschichten müssen vorsichtig behandelt werden. Eine Schicht 22:00–06:00 geht über Mitternacht und muss korrekt funktionieren.

## 66. Internationalisierung

V1: Deutsch. Architektur trotzdem über Translation Keys – nicht `<button>Mitarbeiter</button>`, sondern zentral übersetzbar.
Später: Englisch, Türkisch, weitere Sprachen.

## 67. Keine KI in V1

Explizit verboten für V1: AI Chatbot, AI Scheduling, AI Analytics, AI Dashboard Builder, LLM API, automatische KI-Texte.
Aber spätere Erweiterung soll über ein eigenes Modul möglich sein, z. B. `ai_module` mit eigenen Entitlements und Nutzungslimits.

## 68. Kein Payroll in V1

TeamPanel berechnet Arbeitsstunden. Es macht zunächst keine rechtlich verbindliche Gehaltsabrechnung, Lohnsteuer, Sozialversicherung, Personalverrechnung.
Später können Exporte oder Integrationen folgen.

## 69. Kein GPS-Tracking in V1

Kein permanentes Tracking. Später optional denkbar: Einstempeln nur in Standortnähe – aber nur unter Berücksichtigung von Datenschutz und Arbeitsrecht.

## 70. MVP – Was muss zuerst fertig werden?

Auth, Unternehmen, Onboarding, Mitarbeiter, Memberships, Rollen, Berechtigungen, Teams, Standorte, Module, Dashboard, Zeiterfassung, Dienstplan, Urlaub, Aufgaben, Team-News, Notifications, Tariflimits, Stripe Billing, Audit Log, Responsive PWA, Security, Backups, Tests.

Dokumente, Formulare und komplexere Funktionen können direkt danach folgen.

## 71. Entwicklungsreihenfolge

- **Phase 0 – Repository Foundation:** Repository, TypeScript strict, Linter, Formatter, Tests, CI, environment schema, staging environment. Noch keine Businesslogik.
- **Phase 1 – Auth:** Registrierung, Login, Logout, Passwort vergessen, E-Mail-Verifizierung, Session Handling, Protected Routes. Tests.
- **Phase 2 – Organizations:** Unternehmen erstellen, Unternehmen auswählen, Membership, Owner-Zuweisung, Multi-Tenant Foundation, RLS. Security Tests müssen beweisen: User A kann niemals Daten von Organisation B lesen oder verändern.
- **Phase 3 – Rollen & Berechtigungen:** Standardrollen, Permission Registry, Role Permissions, Permission Guards, Datenbankregeln. Keine weitere große Funktion bauen, bevor RBAC funktioniert.
- **Phase 4 – Mitarbeiter / Teams / Standorte:** Mitarbeiterliste, Einladungen, Profile, Teams, Locations, archivieren, Suche, Filter.
- **Phase 5 – Module & Navigation:** Module Registry, organization_modules, modulabhängige Navigation, tarifabhängige Module.
- **Phase 6 – Dashboard:** Dashboard API, Widgets, Rolle berücksichtigen, Schnellaktionen.
- **Phase 7 – Zeiterfassung:** Clock Events, Pause, Arbeitszeiten, Tagesansicht, Wochenansicht, Korrekturanfragen, Manager-Genehmigung. Sehr ausführliche Tests.
- **Phase 8 – Dienstplan:** Schichten, Draft, Publish, Wochenansicht, Mitarbeiteransicht, Standortfilter, Benachrichtigungen.
- **Phase 9 – Urlaub:** Leave Types, Requests, Approve, Reject, Kalenderintegration, Überschneidungen.
- **Phase 10 – Aufgaben:** Tasks, Assignments, Prioritäten, Fälligkeit, Status, Checklisten.
- **Phase 11 – Ankündigungen:** Posts, Zielgruppe, Read Receipt, Notification.
- **Phase 12 – Billing:** Free, Pro, Business, Stripe Checkout, Customer Portal, Webhooks, Entitlements, Limits, Grace Period.
- **Phase 13 – Reporting:** Stunden, Aufgaben, Urlaub, CSV.
- **Phase 14 – PWA:** Manifest, Icons, installierbar, Responsive Audit. V1-Clock-In zunächst online erforderlich. Offline Clock-In erst später.
- **Phase 15 – Security Hardening:** RLS Audit, Permission Audit, Rate Limiting, File Security, Auth Hardening, Dependency Audit, Secret Audit, Privacy Review.
- **Phase 16 – Pilot:** Pilot mit wenigen echten Unternehmen. Feature Flags verwenden. Feedback sammeln. Keine sofortige breite Veröffentlichung.

## 72. Teststrategie

- **Unit Tests** für: Berechnungen, Arbeitszeiten, Pausen, Entitlements, Permission Logic, Validation.
- **Database Tests** – besonders wichtig: Tenant Isolation, RLS, Permissions, Foreign Keys, Constraints.
- **Integration Tests**, z. B.: User registriert sich → Firma erstellt → Mitarbeiter eingeladen → Einladung akzeptiert.
- **E2E Tests** (Playwright), kritische Flows:
  1. Owner → Firma erstellen → Mitarbeiter einladen → Dienstplan erstellen
  2. Mitarbeiter → Login → Einstempeln → Pause → Ausstempeln
  3. Mitarbeiter → Urlaub beantragen; Manager → genehmigt
  4. Owner → Upgrade Pro; Stripe → Webhook; TeamPanel → Pro Features freigeschaltet

## 73. Security Tests

Explizite Negativtests. Beispiel: Organisation-A-User versucht URL/API von Organisation B. Erwartet: 403 / keine Daten.
Testen: fremde Mitarbeiter, fremde Aufgaben, fremde Dokumente, fremde Arbeitszeiten, fremde Standorte, fremde Reports.

## 74. Billing Tests

Testen: Free Limit erreicht, Upgrade, Downgrade, Zahlung fehlgeschlagen, Kündigung, Reaktivierung, Webhook doppelt gesendet, Webhook verspätet, Webhook falsche Signatur.

## 75. Definition of Done

Eine Funktion gilt NICHT als fertig, nur weil die UI sichtbar ist. Fertig bedeutet:
UI implementiert, Mobile funktioniert, Loading State, Empty State, Error State, Berechtigungen, RLS, Validation, Tests, Accessibility, Audit Log falls erforderlich, Dokumentation, keine bekannten kritischen Bugs.

## 76. Codequalität

Pflicht: TypeScript strict, keine unnötigen `any`, keine riesigen Dateien, keine duplizierte Geschäftslogik, klare Domain-Struktur, keine Secrets im Repo, Datenbankänderungen nur über Migrationen, keine manuellen Produktionsänderungen, keine TODOs in sicherheitskritischem Code.

## 77. Repository-Struktur

Empfohlene Grundstruktur:

```
teampanel/
  src/
    app/
    components/
    modules/
      employees/ teams/ locations/ time/ schedule/ leave/
      tasks/ announcements/ documents/ forms/
    auth/
    billing/
    permissions/
    hooks/
    services/
    lib/
    types/
    i18n/
  supabase/
    migrations/
    functions/
    tests/
    seed/
  tests/
    e2e/
  docs/
    architecture/
    product/
    security/
```

Domainlogik nicht wild über UI-Komponenten verteilen.

## 78. Modul-interne Struktur

```
modules/time/
  components/  hooks/  queries/  mutations/  schemas/  types/  utils/
  permissions.ts
  routes.ts
```

Jedes Modul soll möglichst isoliert bleiben.

## 79. Module Registry

Zentrale Registry, z. B.:

```
time_tracking: requiredPermission, requiredEntitlement, navigation, routes, icon
tasks:         requiredPermission, requiredEntitlement, navigation, routes
```

Dadurch können später neue Module ergänzt werden.

## 80. Zukünftiger Marketplace

Noch nicht implementieren. Aber Module nicht so eng koppeln, dass später Marketplace unmöglich wird.
Zukunft: TeamPanel Core + Marketplace: Inventar, Fahrtenbuch, CRM, AI Assistant, Payroll Export, Projects.

## 81. Zukünftige API

Business-Kunden könnten später API Keys erhalten, z. B. `GET /employees`, `GET /time-entries`, `POST /tasks`.
Noch nicht V1. Aber interne Services sauber trennen, damit API später ergänzt werden kann.

## 82. Zukünftige Webhooks

Beispiel: `employee.created`, `clock.out`, `leave.approved`, `task.completed`. Noch nicht entwickeln.

## 83. Zukünftige KI

Spätere KI könnte: Dienstplanvorschläge, Reports zusammenfassen, Aufgaben automatisch erzeugen, Panel konfigurieren, Fragen zu Unternehmensdaten beantworten.

Aber: KI darf später nur Daten sehen, die der jeweilige User ebenfalls sehen darf. AI Layer darf niemals RLS oder Permission System umgehen.

## 84. Zukünftiger No-Code Builder

Langfristiges Ziel: Owner beschreibt oder konfiguriert eigene interne Prozesse, z. B. Materialbestellung, Fahrzeugkontrolle, Salon schließen, Baustellenbericht, Qualitätsprüfung.
V1 legt dafür mit Formularen und Checklisten nur die Grundlage.

## 85. Wichtige Produktregel

Nicht versuchen, sofort Personio, Slack, Monday, Connecteam, Notion, Deputy gleichzeitig zu ersetzen.
V1 gewinnt durch: **Einfachheit + Modularität + gute Bedienung.**

## 86. Erste verkaufbare Version

Ein Unternehmen muss nach Registrierung folgendes vollständig erledigen können:

```
Account erstellen → Firma erstellen → Mitarbeiter einladen → Rollen vergeben → Module konfigurieren
→ Dienstplan erstellen → Mitarbeiter stempeln → Aufgaben verteilen → Urlaub genehmigen → Arbeitszeiten auswerten
```

Wenn dieser Ablauf hervorragend funktioniert, ist das Produkt verkaufbar.

## 87. Pilotkriterien

Vor öffentlichem Launch: Mindestens mehrere Testunternehmen mit unterschiedlichen Branchen, z. B. Friseur, Restaurant, Reinigungsfirma, kleines Büro, Handwerker.
Ziel: Prüfen, ob Produkt wirklich branchenneutral ist.

## 88. Wichtige Kennzahlen nach Launch

Später messen: Registrierungen, Onboarding Completion, aktive Unternehmen, eingeladene Mitarbeiter, aktive Mitarbeiter, Clock-ins pro Woche, erstellte Aufgaben, Dienstpläne, Free → Pro Conversion, Kündigungsrate, Aktivität nach 7/30/90 Tagen.
Keine personenbezogene Überwachung für Analytics verwenden.

## 89. Claude – verbindliche Entwicklungsregeln

Claude soll dieses Dokument als Source of Truth behandeln.

**Claude darf NICHT:**
- eigenmächtig große Features hinzufügen
- KI einbauen
- Architektur ohne Begründung austauschen
- Sicherheitschecks umgehen
- RLS durch reine Frontendchecks ersetzen
- mehrere Entwicklungsphasen gleichzeitig chaotisch implementieren
- ungetestete Migrationen auf Produktion anwenden
- Secrets committen
- vorhandene funktionierende Arbeit ohne Grund neu schreiben

**Claude MUSS:**
- zuerst Repository und Spezifikation lesen,
- aktuelle Projektlage analysieren,
- vor jeder großen Phase einen kleinen Implementierungsplan erstellen,
- Datenmodell vor UI für komplexe Domains definieren,
- Migrationen versionieren,
- Tests mitimplementieren,
- nach jeder Phase Tests ausführen,
- Typecheck/Lint ausführen,
- Security-Auswirkungen prüfen,
- relevante Dokumentation aktualisieren.

## 90. Claude – Arbeitsweise pro Phase

1. Analyse
2. Konkreten Plan erstellen
3. Datenmodell und Permissions festlegen
4. Tests definieren
5. Implementieren
6. Tests ausführen
7. Security prüfen
8. UI/UX prüfen
9. Ergebnis dokumentieren
10. Erst danach nächste Phase

## 91. Checkpoint-Format für Claude

Nach jeder Phase soll Claude berichten:

```
PHASE:
STATUS:
IMPLEMENTIERT:
-
DATENBANK:
-
SECURITY / RLS:
-
TESTS:
-
ERGEBNIS:
-
OFFENE PUNKTE:
-
NÄCHSTE PHASE:
-
```

## 92. Architekturprinzip

**Secure by default.** Neue Funktion standardmäßig: kein Zugriff – bis explizit erlaubt.
Nicht: alles sichtbar und danach Dinge verstecken.

## 93. Produktprinzip

Jede neue Funktion muss diese Frage beantworten: *Hilft diese Funktion einem kleinen Unternehmen dabei, sein Team einfacher zu organisieren?*
Wenn nein: Nicht in den Core aufnehmen.

## 94. V1 Success Criteria

V1 gilt als erfolgreich, wenn:

- neuer Owner ohne Hilfe ein Unternehmen erstellen kann,
- Mitarbeiter in wenigen Minuten eingeladen werden können,
- Rollen zuverlässig funktionieren,
- kein Cross-Tenant-Zugriff möglich ist,
- Zeiterfassung stabil funktioniert,
- Dienstplan mobil gut lesbar ist,
- Aufgaben einfach verteilt werden können,
- Urlaub digital funktioniert,
- Free-/Pro-Limits korrekt greifen,
- Zahlungssystem zuverlässig funktioniert,
- App auf Smartphone und Desktop nutzbar ist,
- keine kritischen Security Bugs bestehen,
- echte Unternehmen das Produkt freiwillig weiterverwenden wollen.

## 95. Langfristige Produktvision

- **Phase 1 – Team Management:** Mitarbeiter, Zeit, Dienstplan, Aufgaben, Urlaub
- **Phase 2 – Company Operations:** Formulare, Dokumente, Checklisten, Standorte, Automationen
- **Phase 3 – Platform:** API, Integrationen, Marketplace, Custom Modules
- **Phase 4 – Intelligence:** AI Assistant, AI Scheduling, AI Reports, AI Setup

## 96. Endziel

TeamPanel soll langfristig nicht bloß eine Zeiterfassungs-App werden. Das Endprodukt soll sein:
Eine Plattform, auf der kleine Unternehmen ihr eigenes internes Betriebssystem für Mitarbeiter und tägliche Arbeitsabläufe konfigurieren können – ohne Programmieren zu müssen.

Die erste Version bleibt bewusst kleiner. Das Fundament muss jedoch stark genug sein, dass daraus später genau diese Plattform entstehen kann.

## 97. Erste Anweisung an Claude

Arbeite noch nicht sofort blind den gesamten Plan ab. Führe zuerst folgende Aufgabe aus:

> Analysiere diese vollständige TeamPanel-Spezifikation als Source of Truth. Erstelle daraus eine konkrete technische Architektur und einen detaillierten Implementierungsplan in kleinen, überprüfbaren Phasen. Prüfe insbesondere Multi-Tenancy, Datenmodell, RLS, Rollen/Berechtigungen, Modularität, Billing und spätere Erweiterbarkeit. Implementiere noch keine Produktfeatures, bevor Architektur, Repository-Struktur, Datenmodell und Phase-0-Plan sauber feststehen. Verwende V1 ausdrücklich ohne KI. Priorisiere Sicherheit, Datenisolation, Wartbarkeit und geringe laufende Kosten. Weise auf Widersprüche oder technische Risiken in der Spezifikation hin, statt sie stillschweigend zu umgehen.

Dieses Dokument bleibt die zentrale Source of Truth des Projekts.
