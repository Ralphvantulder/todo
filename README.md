# To do

Webapp voor Ralph's to do's en notities, opgezet zoals het CRM.

- **To do's:** een bord met lijsten als kolommen, zoals de to do in Teams (Planner). Kaarten met labels (Prio, Wachten, zelf uit te breiden), een rondje om af te vinken, een checklist met teller, een einddatum en notities. Voltooide taken staan ingeklapt onderaan de lijst.
- **Notities:** per project een stapel notities. Typen wordt automatisch opgeslagen.

Vormgeving: het Moneybird-template van het CRM voor de schil (bovenbalk, zijbalk, dialogen), het bord zelf in de stijl van Teams.

## Hoe het werkt

- **Online:** GitHub Pages serveert `index.html` uit deze repository. De pagina bevat geen taken of notities.
- **Data:** Supabase. Tabellen `lists`, `labels`, `tasks`, `projects`, `notes`, elk met Row Level Security: alleen de ingelogde eigenaar ziet en wijzigt zijn eigen rijen. Schema: `todo-schema.sql`. Het schema mag in een eigen Supabase-project of in het project van het CRM; de tabelnamen botsen niet.
- **Inloggen:** e-mail en wachtwoord (Supabase Auth). De publishable key in `index.html` is bedoeld om openbaar te zijn; zonder inlog geeft hij geen toegang.
- **Database koppelen:** vul `SUPABASE_URL` en `SUPABASE_KEY` in bovenin `build.py` en bouw opnieuw. Zolang ze leeg zijn vraagt de app er bij het openen om en bewaart ze alleen in die browser.
- **Demo:** `index.html?demo` draait met verzonnen voorbeelddata in het geheugen, zonder database.

## Bediening

- **Taak toevoegen:** klik op *Taak toevoegen* boven een lijst, typ en druk op Enter. Het invoerveld blijft open voor de volgende taak; Esc sluit het.
- **Taak openen:** klik op de kaart. Daar staan lijst, labels, einddatum, notities en de checklist. Ctrl+Enter slaat op.
- **Afvinken:** klik op het rondje. De taak verhuist naar *Voltooide taken*; daar zet je hem met hetzelfde rondje terug.
- **Verplaatsen:** sleep een kaart naar een andere lijst of een andere plek, of gebruik de drie puntjes op de kaart (handig op de telefoon). Via dezelfde puntjes zet je snel een label aan of uit.
- **Lijsten:** *Nieuwe lijst* rechts van het bord; de drie puntjes naast de lijstnaam voor hernoemen, naar links of rechts schuiven en verwijderen.
- **Labels:** beheren onder Instellingen (naam en kleur). Boven het bord filter je op een label.
- **Zoeken:** het zoekveld bovenin (toets `/`) filtert de taken, of op de notitiepagina alle notities.
- **Notities:** links de projecten, in het midden de notities van het gekozen project, rechts de tekst. Een notitie kun je vastzetten of naar een ander project verplaatsen.

## Toegang voor Claude

Claude werkt met een eigen Supabase-gebruiker die via `todo-toegang-claude.sql` aan Ralph's account is gekoppeld (tabel `todo_toegang`, functie `todo_eigenaar()`). Die gebruiker ziet en bewerkt dezelfde rijen; alles wat hij toevoegt wordt van Ralph.

- Inloggen: `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` met header `apikey: {publishable key}` en body `{"email": "...", "password": "..."}`. Het antwoord bevat `access_token`.
- Lezen en schrijven: `{SUPABASE_URL}/rest/v1/<tabel>` met headers `apikey` en `Authorization: Bearer <access_token>`.
- `owner_id` niet meesturen: de database vult de eigenaar zelf in.
- `tasks`: `list_id` (verplicht), `title`, `notes`, `label_ids` (uuid's uit `labels`), `due_date`, `done` en `done_at`, `sort` (laag = bovenaan; nieuwe taak bovenaan = laagste `sort` van de lijst min 1), `checklist` (JSON-lijst van `{"id","text","done"}`).
- `notes`: `project_id` (verplicht), `title`, `body` (platte tekst), `pinned`. Zet bij een wijziging `updated_at` op nu, dan staat de notitie bovenaan.

## Bouwen

De bronbestanden staan in `src/`. `python3 build.py` voegt ze samen tot `index.html` (Supabase JS 2.119.0 zit erin, geen CDN). Het logo staat in `src/logo.svg` (en als symbool `i-logo` in `src/icons.svg`); `build.py` schrijft het naar `icon.svg`, daarna maakt `node mkicons.js .` de PNG-iconen opnieuw.

Gebruik op de laptop: Edge-snelkoppeling met `--app=<adres van de app>`. Op de telefoon: openen in de browser en "Zet op beginscherm".
