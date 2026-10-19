# TeamPanel – Umgebungen einrichten (local, staging, production)

> Gehört zu Phase 0, ergänzt in Phase 1 (2.4 Auth-Einstellungen). Spezifikation §56/§57: getrennte Datenbanken,
> Keys, Stripe-Konten und Domains pro Umgebung, keine Tests auf Produktionsdaten, keine manuellen Produktionsänderungen.

## 1. Lokale Entwicklung

Voraussetzungen: Node ≥ 22.22.2 (`.nvmrc`), pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install
cp .env.example .env.local
pnpm db:start            # startet Supabase lokal (Docker), wendet Migrationen + seed.sql an
                         # → URL und Publishable Key in .env.local eintragen
pnpm dev                 # http://127.0.0.1:5173
```

Lokale Auth-E-Mails (Bestätigung, Anmeldelink, Passwort zurücksetzen) werden nicht verschickt, sondern landen in
Mailpit: `http://127.0.0.1:54324`.

| Befehl | Zweck |
|---|---|
| `pnpm check` | Format, Lint, Typecheck, Unit-Tests (vor jedem Commit) |
| `pnpm e2e` | Playwright auf Desktop und Mobile (baut die App selbst) |
| `pnpm db:test` | pgTAP-Tests gegen lokales Supabase (Docker) |
| `pnpm db:test:local` | dieselben pgTAP-Tests ohne Docker (siehe unten) |
| `pnpm db:reset` | lokale DB neu aufsetzen (Migrationen + Seed) |
| `pnpm db:types` | `src/types/database.ts` aus dem lokalen Schema neu generieren |
| `pnpm db:types:local` | dasselbe ohne Docker (Wegwerf-PostgreSQL, gleiche CLI-Version) |
| `pnpm exec supabase migration new <name>` | neue Migration anlegen |

**Ohne Docker** (z. B. Cloud-Sessions, in denen die Supabase-Images nicht geladen werden können):
`pnpm db:test:local` startet einen Wegwerf-PostgreSQL-Cluster, bildet die benötigten Supabase-Teile nach
(`scripts/local-db/supabase-shim.sql`: Rollen, `auth`-Schema, Default Privileges) und führt Migrationen und
pgTAP-Tests aus. Voraussetzung: lokales PostgreSQL mit pgTAP (`apt-get install postgresql-<major>-pgtap`; in
Cloud-Sessions ist es Version 16).
Das ist ein Ersatz für schnelles Feedback. **Maßgeblich ist CI** mit dem echten Supabase-Image.

## 2. Einmalige Einrichtung durch den Product Owner

Diese Schritte brauchen Konten, Zahlungsdaten und Geheimnisse. Deshalb führt sie ein Mensch aus und nicht Claude.

### 2.0 Default-Branch `main` ✅ (eingerichtet 2026-10-19)

`main` ist Default-Branch und per Ruleset „main schützen“ geschützt: Änderungen nur per Pull Request, die vier
CI-Jobs müssen grün sein, kein Force-Push, kein Löschen. Claude arbeitet auf eigenen Branches und bringt Änderungen
per PR nach `main`.

### 2.1 Supabase (zwei Projekte)

1. Auf supabase.com eine Organisation anlegen. Die EU-Datenregion wählen, z. B. **Frankfurt (eu-central-1)**.
2. Projekt `teampanel-staging` anlegen (Free-Plan genügt bis zum Pilot, E-27).
3. Projekt `teampanel-production` anlegen, **Pro-Plan** (tägliche Backups), gleiche Region.
4. In beiden Projekten unter *Authentication → Providers → Email*:
   - „Confirm email“ aktivieren
   - Mindestpasswortlänge 10
   - „Secure password change“ aktivieren
   - „Leaked password protection“ aktivieren (nur Production; im Free-Plan von Staging nicht verfügbar, E-40)
   - „Require current password when updating“ **an** (entschieden in Phase 1, E-45; lokal aus)
   - unter *URL Configuration* Site-URL und Redirect-URLs der jeweiligen Domain eintragen
   - E-Mail-Vorlagen und weitere Auth-Einstellungen ab Phase 1: siehe 2.4
5. Unter *Settings → API* prüfen, dass nur `public` und `graphql_public` exponiert sind (Default). Das Schema
   `private` darf **nie** exponiert werden. Die Einstellung „Default privileges for new entities“ (automatisches
   Freigeben neuer Tabellen) **ausschalten**, passend zu `auto_expose_new_tables = false` in `supabase/config.toml`.
   Die Baseline-Migration erzwingt dasselbe ohnehin, die Einstellung verhindert nur Abweichungen.
6. Notieren (nicht ins Repo!): Project Ref, Datenbank-Passwort, Publishable Key, Projekt-URL.
7. Den Auftragsverarbeitungsvertrag (DPA) von Supabase abschließen (E-17).

### 2.2 GitHub

1. *Settings → Environments*: drei Environments anlegen:
   - `staging`: Dry-Run und Apply gegen Staging
   - `production-plan`: nur Dry-Run gegen Production, **ohne** Reviewer
   - `production`: Apply gegen Production, mit „Required reviewers“ (du selbst)
2. Bei allen drei unter *Deployment branches* nur den Default-Branch (`main`) zulassen.
3. In jedem Environment drei Secrets anlegen (`production-plan` und `production` mit denselben Werten):
   - `SUPABASE_ACCESS_TOKEN`: Token von supabase.com → *Account → Access Tokens* (Details unten)
   - `SUPABASE_DB_PASSWORD`: Datenbank-Passwort des jeweiligen Projekts
   - `SUPABASE_PROJECT_REF`: Project Ref des jeweiligen Projekts

   **Access Token anlegen** (Supabase bietet projektbezogene Tokens mit feinen Rechten):
   - *Resource access*: **Project** → nur das Projekt der jeweiligen Umgebung, nie „Organization“
   - *Expires in*: höchstens ein Jahr ab heute (genau 1 Jahr wird abgelehnt); Erneuerung im Kalender vormerken
   - *Permissions*: Vorlage **Read-only**, dann nur **Database → Migrations** auf **Read-write**.
     `supabase link` braucht Lesezugriff auf mehrere Endpunkte, darunter **API Key Secrets**. Ohne dieses Recht
     scheitert der Deploy mit „Authorization failed for the access token and project ref pair“.
   - Für **Production** später enger: Account-/Organisationsrechte auf None und nur die gelesenen Endpunkte erlauben.
4. *Settings → Branches* (empfohlen): Branch-Schutz für `main` mit den vier CI-Jobs als Pflicht-Checks. Der
   Deploy-Workflow prüft zusätzlich selbst, dass CI für den Commit grün ist.

Migrationen werden **nur** über den manuellen Workflow *Actions → Deploy database* eingespielt, und nur vom
Default-Branch. Er führt die DB-Tests auf dem Commit erneut aus und zeigt die ausstehenden Migrationen
(`--dry-run`, in der Job-Zusammenfassung). Erst danach wendet er sie an; für Production wartet der Apply-Job auf deine
Freigabe, du siehst den Dry-Run also vorher. Ein pausiertes Free-Projekt (Staging) muss vorher im Dashboard
aufgeweckt werden.

### 2.3 Cloudflare Pages (Frontend)

1. *Workers & Pages → Create*. Cloudflare öffnet standardmäßig den **Workers**-Assistenten (erkennbar an
   `npx wrangler deploy`). Ganz unten auf **„Looking to deploy Pages? Get started“** → **„Import an existing Git
   repository“**. Beim GitHub-Dialog nur dieses Repository freigeben.
2. Build-Einstellungen:
   - Framework preset: *None*
   - Build command: `pnpm build && pnpm check:bundle`
   - Build output directory: `dist`
   - Environment variable `NODE_VERSION` = `22` (Cloudflare nimmt die neueste 22.x; Mindestversion laut `engines`)
3. Umgebungsvariablen:
   - *Production*: `VITE_APP_ENV=production`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` des Production-Projekts
   - *Preview*: dieselben Variablen mit `VITE_APP_ENV=staging` und den Werten des Staging-Projekts
4. Production-Branch auf `main` setzen; alle anderen Branches erzeugen Previews gegen Staging.
5. Eigene Domain für Production verbinden (z. B. `app.<domain>`). Previews laufen unter den `*.pages.dev`-Adressen
   von Cloudflare; diese Adressen in Staging-Supabase als Redirect-URLs eintragen.

Der Build schlägt absichtlich fehl, wenn eine Variable fehlt, die URL in Staging oder Production nicht `https` ist
oder versehentlich ein Secret- bzw. service_role-Key eingetragen wurde (`src/lib/env-schema.ts`). Die
Security-Header (CSP mit der Supabase-URL der jeweiligen Umgebung) erzeugt der Build als `dist/_headers`.
Eine `_redirects`-Datei ist nicht nötig: Ohne `404.html` behandelt Cloudflare Pages das Projekt als Single-Page-App.

### 2.4 Auth-Einstellungen Staging/Production

Ab Phase 1. Gehostete Projekte lesen `supabase/config.toml` nicht, deshalb diese Schritte im Supabase-Dashboard des
jeweiligen Projekts. Staging: nach dem Merge von Phase 1, vor dem Test in Schritt 6. Production: beim Anlegen des
Projekts.

1. **E-Mail-Vorlagen** (*Authentication → Emails → Templates*): Für jede Vorlage den Betreff eintragen und den
   kompletten Inhalt der HTML-Datei als Text einfügen. Die Betreffzeilen stehen auch in `supabase/config.toml`.

   | Vorlage im Dashboard | Datei in `supabase/templates/` | Betreff |
   |---|---|---|
   | Confirm sign up | `confirmation.html` | Bestätige deine E-Mail-Adresse für TeamPanel |
   | Magic link | `magic_link.html` | Dein Anmeldelink für TeamPanel |
   | Reset password | `recovery.html` | Neues Passwort für TeamPanel festlegen |
   | Change email address | `email_change.html` | Bestätige deine neue E-Mail-Adresse für TeamPanel |
   | Reauthentication | `reauthentication.html` | Dein Bestätigungscode für TeamPanel |

   „Invite user“ bleibt unverändert (nicht genutzt). Nach dem Speichern prüfen, dass die Links
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…` lauten („Reauthentication“ zeigt stattdessen
   `{{ .Token }}`). Ändert sich eine Vorlage im Repo, diesen Schritt wiederholen.
2. **Rate-Limits** (*Authentication → Rate Limits*): Defaults lassen. Das E-Mail-Limit („Rate limit for sending
   emails“, rund 2 pro Stunde) ist mit dem Supabase-Standardversand fest und erst mit eigenem SMTP änderbar (E-44).
3. **E-Mail-Einstellungen** (dieselbe Seite wie in 2.1 Schritt 4):
   - „Require current password when updating“: **an** (E-45).
   - Gültigkeit der E-Mail-Links („Email OTP Expiration“): 3600 s. Die Mails sagen „1 Stunde gültig“.
   - Mindestabstand zwischen zwei Mails an dieselbe Adresse („Minimum interval …“, lokal `max_frequency`): 60 s
     (Default). Nicht auf den lokalen Wert 1 s senken. Wird das Feld nicht angezeigt, gilt der Default.
4. **URL Configuration** (*Authentication → URL Configuration*): unverändert lassen.
   - Staging: Site-URL `https://teampanel-8i0.pages.dev`, Redirect-URLs wie in §3. Alle E-Mail-Links führen zur
     Site-URL, auch wenn die Anfrage aus einer Preview kam.
   - Production: Site-URL = eigene Domain (z. B. `https://app.<domain>`), als Redirect-URL nur diese Origin, keine
     Wildcards.
5. **E-Mail-Versand** (E-44): Staging nutzt den Standardversand von Supabase, SMTP-Einstellungen sind nicht nötig.
   - Mails gehen nur an Adressen von Mitgliedern des Supabase-Teams (*Organization → Team*). Für mehrere Testkonten
     +Label verwenden, z. B. `vorname+tp1@…`, `vorname+tp2@…`.
   - Rund 2 Mails pro Stunde für das ganze Projekt. Ist das Limit erreicht, zeigt die App trotzdem „Prüfe dein
     Postfach“, es kommt aber keine Mail. Das ist gewollt: Die Antwort verrät nie, ob es ein Konto gibt (E-45). Kommt
     keine Mail, rund eine Stunde warten. Die Ursache steht unter *Logs → Auth* (Status 429,
     `over_email_send_rate_limit`).
   - Production braucht vor echten Nutzern eigenes SMTP (Resend, Phase 4).
6. **Test nach dem Deployment** (Staging, nachdem *Deploy database* die Migrationen `profiles` und
   `clear_password_before_first_confirmation` eingespielt und Cloudflare `main` gebaut hat): mit Team-Adressen mit
   +Label, auf Handy und Desktop. Wegen der rund 2 Mails pro Stunde dauert der Durchlauf über eine Stunde.
   1. `/signup` mit Name und E-Mail (es gibt kein Passwortfeld) → „Prüfe dein Postfach“. Die Mail ist deutsch und hat
      den Betreff aus der Tabelle oben. Den Link öffnen (gern auf einem anderen Gerät) → „Weiter“ → „Passwort
      festlegen“. Ein Passwort zweimal eingeben → „Passwort speichern“ → Startseite „Hallo, ‹Name›!“ mit „Passwort
      festgelegt. …“. Erscheint stattdessen eine Fehlermeldung: Ergebnis an Claude melden.
   2. „Abmelden“ → `/login`. Den Link aus 1. noch einmal öffnen → „Weiter“ → „Link ungültig oder abgelaufen“.
   3. Mit Passwort anmelden → Startseite. Abmelden.
   4. **Nachweis E-46** (fremdes Passwort vor der Bestätigung) mit einer neuen +Label-Adresse. Die Registrierung läuft
      wie bei einem Angreifer direkt über die Auth-API und mit einem Passwort (mindestens 10 Zeichen, wird danach
      nicht mehr gebraucht), im Terminal (`curl`, `jq`). Das Passwort nie in Chats, Tickets oder Logs kopieren.

      ```bash
      URL=https://pwhvfshrqkrjmfbduesb.supabase.co
      KEY='<Publishable Key aus §3>'
      read -r -p 'E-Mail: ' EMAIL; read -r -s -p 'Passwort: ' PW; echo
      jq -n --arg email "$EMAIL" --arg password "$PW" '{$email, $password, data: {display_name: "Test E-46"}}' |
        curl -sS -o /dev/null -w '%{http_code}\n' "$URL/auth/v1/signup" -H "apikey: $KEY" \
          -H 'content-type: application/json' --data-binary @-
      unset PW
      ```

      Erwartet: `200`, danach kommt die Bestätigungs-E-Mail (`429`: Mail-Limit erreicht, rund eine Stunde warten und
      mit einer neuen +Label-Adresse wiederholen). Den Link aus der Mail öffnen → „Weiter“ → „Passwort festlegen“ →
      „Überspringen“ → Startseite „Hallo, Test E-46!“ (der Name aus der fremden Registrierung bleibt, akzeptiertes
      Restrisiko). Abmelden und mit dieser Adresse und dem Passwort von eben anmelden → „E-Mail-Adresse oder Passwort
      ist falsch.“ Gelingt die Anmeldung, ist Phase 1 nicht abnahmefähig: Ergebnis an Claude melden.

      Diesen Nachweis nach Updates von Supabase Auth im gehosteten Projekt wiederholen. Die Integrationstests in CI
      (`tests/integration/password-guard.test.ts`) prüfen nur das GoTrue, das die gepinnte Supabase CLI startet;
      gehostete Projekte aktualisiert Supabase unabhängig davon.
   5. „Passwort vergessen“ für die Adresse aus 4. → Mail → „Weiter“ → „Neues Passwort festlegen“ → speichern →
      Startseite mit „Dein Passwort wurde geändert …“. Erscheint stattdessen „Aus Sicherheitsgründen brauchst du
      einen neuen Link …“, ist Phase 1 nicht abnahmefähig: Ergebnis an Claude melden. Dieser Schritt gelingt mit und
      ohne „Require current password when updating“ (Sitzungen aus E-Mail-Links sind davon ausgenommen) und ist
      deshalb **kein** Nachweis für die Option.
   6. **Nachweis „Require current password when updating“** (E-45), im Terminal (`curl`, `jq`) mit dem Konto aus 1.
      Der Aufruf setzt als „neues“ Passwort das aktuelle, ändert also in keinem Fall etwas. Token und Passwort nie in
      Chats, Tickets oder Logs kopieren.

      ```bash
      URL=https://pwhvfshrqkrjmfbduesb.supabase.co
      KEY='<Publishable Key aus §3>'
      read -r -p 'E-Mail: ' EMAIL; read -r -s -p 'Passwort: ' PW; echo
      TOKEN=$(jq -n --arg email "$EMAIL" --arg password "$PW" '{$email, $password}' |
        curl -sS "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" \
          -H 'content-type: application/json' --data-binary @- | jq -r .access_token)
      jq -n --arg password "$PW" '{$password}' |
        curl -sS -X PUT "$URL/auth/v1/user" -H "apikey: $KEY" -H "authorization: Bearer $TOKEN" \
          -H 'content-type: application/json' --data-binary @- | jq -r '.error_code // .code'
      curl -sS -o /dev/null -X POST "$URL/auth/v1/logout?scope=local" -H "apikey: $KEY" \
        -H "authorization: Bearer $TOKEN"
      unset PW TOKEN
      ```

      Erwartet: `current_password_required` (Option an). Kommt `same_password`, ist die Option aus: in Schritt 3
      einschalten und wiederholen. Jede andere Ausgabe (z. B. `invalid_credentials`, `null`): Ergebnis an Claude
      melden.
   7. „Überall abmelden“ → `/login`.
   8. *Table Editor → profiles*: je Testkonto eine Zeile mit dem eingegebenen Namen. *Advisors → Security Advisor*:
      ohne Befund.

   Ergebnis in §3 eintragen.

### 2.5 Später (eigene Phasen)

| Dienst | Phase | Hinweis |
|---|---|---|
| Resend (E-Mail) | 4 | EU-Region, Domain verifizieren (SPF/DKIM), DPA; löst in Staging den Supabase-Standardversand ab (E-44) |
| Sentry (Error Tracking) | vor Pilot | EU-Datenregion, PII-Scrubbing |
| Stripe | 12 | getrennte Test-/Live-Keys; Stripe Tax; Webhook-Secret nur in Supabase Edge Function Secrets |

## 3. Aktueller Stand (2026-10-19)

| Was | Stand |
|---|---|
| GitHub | `main` Default + geschützt; Environment `staging` (nur `main`) mit 3 Secrets |
| Supabase Staging | Projekt `teampanel-staging`, Ref `pwhvfshrqkrjmfbduesb`, Region **eu-west-1 (Irland)** (E-41), Free-Plan; E-Mail-Auth-Einstellungen nach Stand Phase 0 gesetzt; Site-URL `https://teampanel-8i0.pages.dev`, Redirect-URLs `https://teampanel-8i0.pages.dev/**` und `https://*.teampanel-8i0.pages.dev/**`; Baseline-Migration per *Deploy database* eingespielt (Run #2), Security Advisor ohne Befund |
| Phase 1 (Auth) auf Staging | **noch nicht eingespielt**: Migrationen `profiles` und `clear_password_before_first_confirmation` ([E-46](entscheidungen-und-risiken.md#e-46--fremdes-passwort-in-einem-unbestätigten-konto)) per *Deploy database*, Vorlagen und Einstellungen aus §2.4, Test aus §2.4 Schritt 6 stehen aus |
| Supabase Production | noch nicht angelegt (vor dem Pilot, Region Frankfurt) |
| Cloudflare Pages | Projekt `teampanel`, Adresse `https://teampanel-8i0.pages.dev`; `main` baut vorerst **gegen Staging** (E-42); securityheaders.com: **A+** |
| Access Token | `github-actions-teampanel-v2`, nur `teampanel-staging`, läuft am 2027-10-18 ab |
| Offen | Production-Projekt + Environments `production-plan`/`production`; DPA mit Supabase/Cloudflare (E-17) |

Öffentliche Staging-Werte (dürfen ins Frontend): URL `https://pwhvfshrqkrjmfbduesb.supabase.co`, Publishable Key
`sb_publishable_PlelIBocPdu995Tikigp4g_gMSxQARg`.

## 4. Was wohin gehört

| Wert | Ort | Niemals |
|---|---|---|
| Publishable Key, Projekt-URL | Cloudflare-Env, `.env.local` | – (öffentlich by design) |
| Secret-/service_role-Key | nur Supabase Edge Function Secrets | Frontend, Repo, `VITE_*`-Variablen |
| DB-Passwort, Access Token | GitHub Environment Secrets | Repo, Logs |
| Stripe Secret / Webhook Secret | Supabase Edge Function Secrets | Frontend, Repo |
