# WinMix ↔ Supabase Architektúra Dokumentáció

> **Dátum:** 2026-09-23 (utolsó revízió: 2026-09-24)
> **Cél:** A WinMix rendszer és a Supabase közötti kapcsolatok teljes körű dokumentálása, a jelenlegi architektúra teljesítményproblémáinak elemzése, és konkrét optimalizálási javaslatok.
>
> **Revíziós megjegyzések (2026-09-23):**
> - A teljes történeti pipeline helyi vagy tartós workerben fut, NEM Edge Function-ben. Az Edge Function kérésbefogadásra, rövid adminműveletre és státuszkezelésre való.
> - Az előre számított H2H/liga/tabella/kalibrációs aggregációk a Forduló Prediktor után következnek — nem blokkolják az első működő átadást.
> - A fixture-predikciós táblák és a winmix-fixture-request forrása elkészült, de az Edge Function nincs deployolva — nem kész funkció, amíg a worker és a felület össze nincs kötve.
>
> **Revíziós megjegyzések (2026-09-24) — séma- és RLS-korrekciók a tényleges adatbázis-kép alapján:**
> - Az RLS nyitottabb, mint a korábbi dokumentum állította: `winmix_seasons`, `winmix_matches`, `winmix_teams` és `winmix_pipeline_checkpoints` táblákon `USING (true)` permissive SELECT policy van, amely felülírja a current+sealed verziószűrést.
> - A `winmix_pipeline_checkpoints` tábla **nem run-scoped**: elsődleges kulcsa `league`, nincs `data_version_id`, `run_id` vagy `parameter_snapshot_id` oszlopa. A reprodukálhatóságot a `winmix_fixture_prediction_requests` tábla `source_run_id + data_version_id + parameter_snapshot_id` hármas rögzítése biztosítja.
> - A `winmix_teams` tábla **ligához kötődik**, nem adatverzióhoz — nincs `data_version_id` oszlopa.
> - Több tábla oszlopneve és sémája eltér a korábbi dokumentációtól (lásd 8. szakasz korrekcióit).
> - A policy-lista önmagában nem bizonyítja a tényleges anon/authenticated olvasási hozzáférést — ehhez a GRANT SELECT és az RLS engedélyezettsége is ellenőrizendő.

---

## 1. Vezetői összefoglaló

A WinMix egy offline-first futballmeccs-elemző és predikciós alkalmazás, amely Supabase-t használ olvasási tanácsadó rétegként (advisory tier) és szerveroldali motor futtatására. A rendszer 25 000 mérkőzés adatait dolgozza fel.

**A jelenlegi architektúra fő problémája nem a Supabase lassúsága**, hanem az, hogy az elemzési logika szinte teljes egészében a böngészőben fut:
- Az összes (~25 000) rekord egyidejűleg bekerül a böngésző memóriájába
- Az elemzések kliensoldalon iterálnak végig ezen az adathalmazon
- Több helyen O(N²) vagy O(N²/K) algoritmusok futnak szinkron módon
- Nincs szerveroldali aggregáció vagy előre számított összesítés

A Supabase megfelelő választás maradhat, de az elemzési architektúrát át kell alakítani.

---

## 2. Architektúra áttekintés

### 2.1. A két tábla-család

A rendszer két párhuzamos sémát tartalmaz:

**1. Generikus ML táblák** (kezdeti migráció): `matches`, `teams`, `leagues`, `predictions`, `market_odds`, `value_bets`, `crowd_wisdom`, `detected_patterns`, stb. Ezek a generikus SDK klienssel működnek.

**2. WinMix motor táblák** (későbbi migrációk): A valódi production rendszer. Verziózott, integrity-védett, szigorú RLS-szabályokkal.

### 2.2. Adatáramlási diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ADATFORRÁSOK                                 │
│  GitHub raw CSVs          Supabase cloud tier (read-only)           │
│  (remoteSeasons.ts)       (supabaseTier.ts → view_team_ratings)     │
└──────────┬───────────────────────────┬──────────────────────────────┘
           │                           │
           ▼                           ▼
    ┌─────────────────────────────────────────┐
    │          importFiles()                   │
    │  CSV/JSON → parse → dedup → liga-detekt  │
    │  → pipeline recompute                    │
    └──────────────┬──────────────────────────┘
                   │
                   ▼
    ┌─────────────────────────────────────────┐
    │   WinmixContext (böngésző memória)       │
    │   seasons[] = ~25 000 mérkőzés           │
    │   + localStorage persistence             │
    └──────────────┬──────────────────────────┘
                   │
          ┌────────┼────────┬────────┬────────┐
          ▼        ▼        ▼        ▼        ▼
    LeagueAna.  Fixture  H2H  DataStudio  PipelineAudit
    lizer       Predict       (useLeague   (useLeague
    (O(N²))     (useRound     Forecast     Forecast
                Analysis)     Stats)       Stats)
```

### 2.3. Supabase adatáramlások (5 különálló flow)

#### Flow 1 — Böngésző olvasási tanácsadás (read-only)
- `useCloudTier` mount-kor → `probeCloudTier()` → `view_team_ratings?select=canonical_key&limit=1` (4s timeout)
- `loadRatings(league)` → `view_team_ratings?league=eq.<league>` → Zod validáció → UI diff a lokálisan számított `computeAutoTeamWeights()` ellen
- `fetchCloudSeasonData` — egy teljes szezon (~240 meccs) letöltése, CSV rekonstrukció, modul-szintű cache
- **Ezek az értékek sosem kerülnek be a pipelineba** — tisztán tanácsadó jellegűek

#### Flow 2 — Böngésző → cloud feltöltés (edge functionen keresztül)
- `syncSeasonsToCloud()` → POST `/functions/v1/winmix-ingest`
- A böngésző csak anon/publishable kulcsot küld; az edge function a service-role kulcsot saját Deno env-ből olvassa
- Idempotent upsertok (`onConflict` megadással)
- Szerveroldali pontszám-validáció

#### Flow 3 — Szerver scheduler → motor számítás (böngésző nem vesz részt)
- Scheduler POST → `winmix-engine` edge function
- 1. Lejáró jobok requeue-elése (`winmix_requeue_expired_engine_jobs`, 1800s lease)
- 2. Atomikus job claim (`FOR UPDATE SKIP LOCKED`)
- 3. Paraméter-pillanatkép és adatverzió validáció
- 4. `fetchAllMatches()` — **paginált 1000/oldal**, minden `winmix_matches` adata verziószámozva
- 5. `computeLeaguePipeline()` — ML számítás ligánként
- 6. Eredmények bulk insertje 400-as chunkokban
- 7. `winmix_promote_engine_run` — hardened promotion kimenet-ellenőrzéssel

#### Flow 4 — Autentikált operátor → fixture predikció kérés
- `winmix-fixture-request` edge function
- Hívó autentikációja (`caller.auth.getUser()`)
- Validáció: liga, UUID-k, fixture-szám, duplikáció-ellenőrzés
- Service-role admin klienssel: SHA-256 hash, idempotent insert
- Böngésző csak `status = 'published'` állapotú sorokat lát (RLS)

#### Flow 5 — Auth session brokering (preview felületek)
- `previewAuthStorage.ts` — Lovable preview iframe-ből editorba postMessage
- Szigorú origin-validáció, csak megbízható editor originok
- `localStorage` fallback ha nem iframe-ben van

---

## 3. Adatbázis séma és RLS

### 3.1. WinMix motor táblák

| Tábla | Cél | Böngésző hozzáférés |
|-------|-----|---------------------|
| `winmix_teams` | Csapatok (ligához kötött, nincs data_version_id) | SELECT (read_all, using=true) |
| `winmix_seasons` | Szezonok (verzióhoz kötött) | SELECT (current+sealed **és** read_all, using=true) |
| `winmix_matches` | Mérkőzések (generated columns: total_goals, btts, outcome) | SELECT (current+sealed **és** read_all, using=true) |
| `winmix_pipeline_checkpoints` | Diagnosztikai archívum (PK=league, nem run-scoped) | SELECT (read_all, using=true) — **biztonsági kockázat** |
| `winmix_data_versions` | Adatverziók (draft/sealed/superseded/rejected) | SELECT (is_current + sealed) |
| `winmix_parameter_snapshots` | Paraméter-pillanatképek (model verzió, súlyok) | **Nincs hozzáférés** |
| `winmix_engine_jobs` | Job queue (queued/running/succeeded/failed) | **Nincs hozzáférés** |
| `winmix_engine_runs` | Motor futások (is_current, status) | SELECT (is_current + succeeded) |
| `winmix_match_features` | Meccs featureök (jsonb) | SELECT (current run) |
| `winmix_team_state_snapshots` | Csapat állapot pillanatképek | SELECT (current run) |
| `winmix_predictions` | Predikciók (prob. sum = 1.0 constraint) | SELECT (current run) |
| `winmix_calibration_results` | Kalibrációs eredmények | SELECT (current run) |
| `winmix_import_batches` | Import napló | **Nincs hozzáférés** |
| `winmix_fixture_prediction_requests` | Fixture predikció kérések | SELECT (published only) |
| `winmix_fixture_prediction_cards` | Predikciós kártyák | SELECT (published only) |
| `winmix_fixture_prediction_selections` | Kártya kiválasztások | SELECT (published only) |

### 3.2. RLS architektúra

**Alapelv:** deny-by-default, service-role az egyetlen író — de a gyakorlatban az RLS nyitottabb, mint ez az elv sugallja.

- Minden új táblán engedélyezve van az RLS
- **Nincsenek INSERT/UPDATE/DELETE policy-k** anon/authenticated szerepkörökre — a service_role (RLS bypass) az egyetlen író
- **A `winmix_seasons` és `winmix_matches` táblákon KÉT permissive SELECT policy van:** egy `current_version_read` (current+sealed szűrés) **és** egy `read_all` (`using=true`). Mivel a permissive policy-k OR kapcsolatban érvényesülnek, a `read_all` felülírja a verziószűrést — minden szezon és meccs olvasható.
- **A `winmix_teams` táblán `winmix_teams_read_all` (`using=true`)** — a csapatok nincsenek verziószűrésre korlátozva (nem is lehetnek, mert a táblának nincs `data_version_id` oszlopa).
- **A `winmix_pipeline_checkpoints` táblán `winmix_checkpoints_read_all` (`using=true`)** — a korábbi állítással ellentétben a checkpointok **publikusan olvashatóak**, nem revoked. Ez biztonsági kockázat, mert a tábla belső modellállapotot tartalmaz (`m1_fit`, `calib_history`, `fit_history` jsonb mezők). Nem blokkolja a Prediktort, de később le kell zárni.
- A `winmix_parameter_snapshots`, `winmix_engine_jobs`, `winmix_import_batches` táblákon nincs SELECT policy a policy-listában — ezekre valóban nincs publikus olvasási hozzáférés.
- `view_team_ratings` — `security_invoker = true`, így a base tábla RLS érvényesül
- SECURITY DEFINER függvények: `winmix_claim_next_engine_job`, `winmix_promote_engine_run`, `winmix_validate_data_version`, `winmix_requeue_expired_engine_jobs` — mind csak `service_role` számára

> **Jogosultsági megjegyzés:** A policy-lista önmagában nem bizonyítja a tényleges anon/authenticated olvasási hozzáférést. Ehhez ellenőrizni kell, hogy az RLS engedélyezve van-e, és hogy az adott szerepkörnek van-e táblaszintű `GRANT SELECT` jogosultsága. RLS korlátozza a sorokat, de a GRANT szabályozza, hogy a szerepkör egyáltalán hozzáférhet-e a táblához.

### 3.3. Integrity védelem

- **Generated columns:** `total_goals`, `btts`, `outcome` — a séma alapján jelen vannak, de a tényleges generated column definíciók ellenőrzendő
- **Constraints:** `ht_le_ft` (félidő ≤ teljes idő), `home_team_id <> away_team_id`, pontszám ≤ 20 — a sémarészletből a CHECK constraint nevek nem igazolhatók, csak az oszlopszintű feltételek látszanak
- `winmix_prediction_probability_sum`: `abs((outcome_home+outcome_draw+outcome_away) - 1.0) <= 0.000001` — a constraint neve és pontos definíciója ellenőrzendő
- `winmix_current_run_must_succeed`: sikertelen futás sosem lehet `is_current` — ellenőrzendő
- `winmix_one_current_data_version`: pontosan egy current verzió — ellenőrzendő
- `winmix_one_current_engine_run`: pontosan egy current run — ellenőrzendő
- **Content fingerprint:** md5 a kanonikus sorrendű match sorokon — verzió integritás

> **Megjegyzés (2026-09-24):** A rendelkezésre álló séma- és RLS-adatokból az oszlopok, típusok és policyk ellenőrizhetők, de a CHECK constraint-ek definíciói és nevei nem. Ezeket csak a tényleges constraint-definíciók ellenőrzése után szabad tényként feltüntetni.

### 3.4. Concurrency-safe job queue

- `FOR UPDATE SKIP LOCKED LIMIT 1` — atomikus job claim
- Lease-based requeue: 1800s múlva a nem fejezett job visszakerül `queued` státuszba
- Partial unique index: egy aktív job per input (duplikáció megelőzés)

---

## 4. Edge Functions

### 4.1. winmix-ingest
- **Cél:** CSV/JSON adatok feltöltése a cloud tier-be
- **Autentikáció:** anon/publishable kulcs a kérésben, service-role a Deno env-ből
- **Működés:** idempotent upsert, szerveroldali validáció (véges, egész, nem-negatív, ≤20, HT ≤ FT)
- **CORS:** teljes header készlet minden válaszban

### 4.2. winmix-engine
- **Cél:** A teljes ML pipeline szerveroldali futtatása
- **Autentikáció:** service-role only (scheduler indítja)
- **Működés:**
  1. Lejáró jobok requeue-elése
  2. Job claim (`FOR UPDATE SKIP LOCKED`)
  3. Paraméter + adatverzió validáció (fingerprint ellenőrzés)
  4. `fetchAllMatches()` — paginált 1000/oldal
  5. `computeLeaguePipeline()` — ML per liga
  6. Bulk insert 400-as chunkokban (features, predictions, calibration, team states)
  7. `winmix_promote_engine_run` — kimenet-ellenőrzéssel

### 4.3. winmix-fixture-request
- **Cél:** Jövőbeli fixture predikció kérés fogadása
- **Autentikáció:** authenticated user (hívó JWT-je)
- **Működés:** payload validáció, SHA-256 hash, idempotent insert (idempotency_key)
- **Publikálás:** csak `status = 'published'` sorok láthatók
- **ÁLLAPOT (2026-09-23):** A forráskód és a táblák elkészültek, de az Edge Function **nincs deployolva**. A worker és a felület nincs össze kötve. **Nem kezelendő kész funkcióként**, amíg a deploy + integráció be nem fejeződik.

---

## 5. Teljesítményproblémák elemzése

### 5.1. A fő probléma: minden kliensoldalon fut

A 25 000 rekord **egységesen bekerül a böngésző memóriájába** (`seasons[]` a `WinmixContext`-ben), és minden analitikai oldal kliensoldalon iterál végig rajta. **Nincsenek szerveroldali aggregációk, nincs lapozás, nincsenek előre számított összesítések.**

### 5.2. Számítási szűk keresztmetszetek (súlyosság sorrendjében)

| # | Hely | Probléma | Komplexitás | Hatás |
|---|------|----------|-------------|-------|
| **1** | `leagueStats.ts` → `computePositionHistory` | Minden fordulónál az összes meccset újra szűri és `computeStandings` fut | **O(N²)** | A legsúlyosabb szűk keresztmetszet; 25 000 meccsel száz fordulónál ez a domináns tényező |
| **2** | `pipeline.ts` → prequential refits (`refitM1`, `refitTemperature`, `refitEnsemble`) | Minden refit-nél az összes eddigi mintán végigiterál | **O(N²/K)** | K≈50 refit intervalnél ~500 refit, mindegyik max 25 000 mintán |
| **3** | `stats.ts` → `fitTemperature` grid search | 23 lépéses grid search, minden lépésben teljes minta iteráció | **O(23 × N)** per refit | Összesen ~500 × 23 × 25 000 = ~288M művelet |
| **4** | `bootstrap.ts` → `bootstrapSkillCI` | 1000 iteráció × N resample + sort, **szinkron módon** `useMemo`-ban | **O(N × 1000)** | 25 000 meccsel ~25M művelet a main thread-en; UI jank |
| **5** | `pipeline.ts` → `prefixSignatureOf` | FNV-1a hash karakterenként az összes soron | **O(N)** per hívás, 2× hívva | Karakterenkénti hashing 25 000 soron |
| **6** | `h2h.ts` → `computeH2HPairs` | Minden irányított H2H pár az összes szezon meccsein | **O(teams² × matches)** | 16 csapat → 240 irányított pár |
| **7** | `useLeagueForecastStats` | 5+ független iteráció `scored` felett | **O(5N)** | Egyesíthető lenne egyetlen iterációvá |
| **8** | `FixturePredictor` → `auditCoverage` | Minden meccs minden szezonból csak `pipeline`-flag számlálásra | **O(N)** | Teljes scan minden `seasons` változáskor |
| **9** | `LeagueAnalyzer` → `buildLeagueAnalyzerData` | Az összes liga `seasons` tömbjét megkapja, nem csak a kiválasztottat | Over-scan | Más ligák adatait is feldolgozza |

### 5.3. Mi NEM probléma

- **"AI végzi az elemzést"** — Az `aiConductor.ts` név ellenére **nincs LLM hívás, nincs API hívás, nincs nyers adat küldése**. Ez egy determinisztikus felügyeleti réteg: BTTS drift monitor + magyar nyelvű magyarázat generátor (string összekonkatenálás).
- **Nincsenek N+1 adatbázis lekérdezések** — Az elemzési rétegben nincsenek adatbázis lekérdezések; minden in-memory tömbökön fut.
- **Supabase lassúság** — A Supabase nem szerepel a kritikus útvonalon rendereléskor; csak ingest-kor és cloud cross-check-kor.

### 5.4. Kiváló meglévő mechanizmusok

| Mechanizmus | Mit csinál | Korlát |
|-------------|-----------|--------|
| `MutableForecastHistoryIndex` | O(1) csapat/helyszín/H2H lookup a walk loop-ban | Csak a walk loop-ot segíti |
| Web Worker pool (max 4) | Számítás a main thread-ről | Nem csökkenti a wall-clock time-ot |
| IndexedDB pipeline cache | Teljes szezon+predikció cache, instant restore | Csak reload-t segít; sémaváltozás = full recompute |
| Checkpoint resume | már scoreolt prefix átugrása | Kikapcsol experiment flag-eknél |
| `yieldToMain()` | Kooperatív yielding minden N meccs után | Csak blocking-ot előzi meg |
| `contextCache` (useRoundAnalysis) | Liga-szintű kontextus cache | Adatváltozáskor invalidálódik |
| sessionStorage (useRoundAnalysis) | Eredmény cache signature alapján | Bármilyen adatszerkesztés invalidálja |

---

## 6. Javaslatok az architektúra átalakítására

### 6.1. Elv: szerveroldali aggregáció + előre számított eredmények

A cél: a böngésző soha ne dolgozzon fel 25 000 nyers rekordot. Ehelyett a Supabase-ben előre számított aggregációkat és indexelt lekérdezéseket használjon.

> **FONTOS ARCHITEKTÚRA DÖNTÉS (revízió 2026-09-23):**
> A teljes 25 000-es történeti pipeline számítás **nem kerül vissza az Edge Function-be**. A teljesítményprobléma megoldása nem a számítás Edge-be mozgatásával történik, hanem:
> 1. A történeti pipeline helyi vagy tartós workerben fut (ahogy most is, de optimalizált algoritmusokkal).
> 2. Az Edge Function kérésbefogadásra, rövid adminműveletre és státuszkezelésre való — nem 25 000 rekord számítására.
> 3. Az elemző oldalak aggregációi és lapozása a Prediktor utáni fázisban készülnek (6.2 javaslatok).
>
> **Implementációs sorrend:**
> 1. 1–16 kiválasztott párosítás szerveres kiértékelése
> 2. Egy közös Core 1–3 és Joker 1–3 döntés
> 3. Mentett, visszatölthető kiadás
> 4. Eredményrögzítés és kiértékelés
> 5. Elemző oldalak szerveroldali aggregációi és lapozása

### 6.2. Konkrét javaslatok

> **FÁZIS-REND: Az alábbi javaslatok (1–8) a Forduló Prediktor első működő átadása UTÁN következnek.** Nem blokkolják a Prediktor átadást. A Prediktor prioritása: 1–16 párosítás kiértékelése → Core/Joker döntés → mentett kiadás → eredményrögzítés.

#### Javaslat 1: Előre számított ligánként/csapatonkénti összesítések

Hozzunk létre materialized view-kat vagy táblákat, amelyeket az edge function a pipeline futás végén feltölt:

```sql
-- Példa: csapat szezon statisztikák
CREATE TABLE winmix_team_season_stats (
  run_id uuid REFERENCES winmix_engine_runs(id),
  team_id uuid REFERENCES winmix_teams(id),
  season_id uuid REFERENCES winmix_seasons(id),
  league text NOT NULL,
  -- előre számított mezők
  ppg numeric(4,2),
  goals_for int,
  goals_against int,
  btts_rate numeric(4,2),
  over25_rate numeric(4,2),
  form_last5 text,
  position int,
  home_record text,
  away_record text,
  PRIMARY KEY (run_id, team_id, season_id)
);
```

A böngésző ezekből a táblákból csak a kiválasztott liga/szezon sorait kéri le (~16-20 sor), nem 25 000 meccset.

#### Javaslat 2: Pozíciótörténet előre számítása

A `computePositionHistory` O(N²) problémáját úgy oldjuk meg, hogy az edge function a pipeline végén minden fordulóra kiszámolja az állást és beteszi egy táblába:

```sql
CREATE TABLE winmix_round_standings (
  run_id uuid REFERENCES winmix_engine_runs(id),
  season_id uuid,
  round_no int,
  team_id uuid,
  position int,
  points int,
  goals_for int,
  goals_against int,
  PRIMARY KEY (run_id, season_id, round_no, team_id)
);
```

A böngésző egyetlen `SELECT` lekérdezéssel megkapja bármelyik forduló állását.

#### Javaslat 3: Kalibrációs és statisztikai aggregációk táblája

A `useLeagueForecastStats` által kliensoldalon számított 5+ iterációt szerveroldalon előre számoljuk:

```sql
CREATE TABLE winmix_run_statistics (
  run_id uuid,
  league text,
  -- brier, log loss, ECE, accuracy
  brier_score numeric(6,4),
  log_loss numeric(6,4),
  ece numeric(6,4),
  actionable_correct int,
  actionable_total int,
  argmax_correct int,
  argmax_total int,
  -- bootstrap CI (szerveroldalon számítva)
  skill_ci_low numeric(6,4),
  skill_ci_high numeric(6,4),
  PRIMARY KEY (run_id, league)
);
```

#### Javaslat 4: H2H előre számított párok

> **Megjegyzés:** Az H2H aggregáció a Prediktor utáni fázisban készül. A Prediktor saját H2H számításait nem befolyásolja.

A `computeH2HPairs` O(teams² × matches) problémáját előre számolt táblával oldjuk meg:

```sql
CREATE TABLE winmix_h2h_pairs (
  run_id uuid,
  league text,
  home_team_id uuid,
  away_team_id uuid,
  meetings int,
  home_wins int,
  draws int,
  away_wins int,
  home_goals int,
  away_goals int,
  btts_rate numeric(4,2),
  avg_goals numeric(4,2),
  PRIMARY KEY (run_id, league, home_team_id, away_team_id)
);
```

#### Javaslat 5: Lapozás és szűrés a meccs listához

A meccs lista (MatchesPanel) jelenleg az összes meccset memóriában tartja. Ehelyett használjunk szerveroldali lapozást:

```typescript
// Jelenleg: seasons.flatMap(s => s.matches) — minden a memóriában
// Javasolt: paginated query
const { data, count } = await supabase
  .from('winmix_matches')
  .select('*', { count: 'exact' })
  .eq('data_version_id', currentVersionId)
  .eq('league', selectedLeague)
  .range(offset, offset + pageSize - 1)
  .order('match_no', { ascending: false });
```

#### Javaslat 6: Prequential refit optimalizálása

A `refitM1`/`refitTemperature`/`refitEnsemble` O(N²/K) problémáját inkrementális frissítéssel oldjuk meg:
- Az eddigi minták `map`-je helyett csak az új mintákat adjuk hozzá (online tanulás)
- A `fitTemperature` grid search-ét előre számolt lookup table-lal helyettesítsük
- Vagy: a teljes refit logikát az edge functionbe mozgassuk, és csak az eredményt tároljuk

#### Javaslat 7: Bootstrap CI szerveroldali számítása

A `bootstrapSkillCI` 1000 × N resample szinkron futása a main thread-en:
- Mozgassuk az edge functionbe a pipeline futás végén
- Tároljuk az eredményt a `winmix_run_statistics` táblában
- A böngésző csak egyetlen értéket olvas ki

#### Javaslat 8: Liga-szintű adatok lekérdezése szerveroldalról

A `buildLeagueAnalyzerData` jelenleg az összes liga `seasons` tömbjét megkapja. Ehelyett:
- A `WinmixContext` csak a kiválasztott liga adatait töltse be
- Vagy: a statisztikákat szerveroldalon előre számoljuk, és csak azokat kérjük le

### 6.3. Javasolt jövőbeli architektúra

```
┌──────────────────────────────────────────────────────────────┐
│  TÖRTÉNETI PIPELINE (helyi / tartós worker)                   │
│                                                               │
│  - 25 000 meccs feldolgozása optimalizált algoritmusokkal     │
│  - NEM Edge Function-ben — túl erőforrás-igényes              │
│  - Helyi worker vagy szerveren futó batch folyamat            │
│  - Eredmények → Supabase táblák (engine runs, predictions)    │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION (kérésbefogadás, admin, státusz)                │
│                                                               │
│  - winmix-ingest: adatfeltöltés (rövid művelet)               │
│  - winmix-fixture-request: kérés befogadás (rövid művelet)    │
│  - winmix-engine: job queue + státusz (NEM 25k számítás)      │
│  - Státusz és promotion (winmix_promote_engine_run)            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼  (Prediktor utáni fázis)
┌──────────────────────────────────────────────────────────────┐
│  ELŐRE SZÁMÍTOTT AGGREGÁCIÓK (fázis 5)                         │
│                                                               │
│  - winmix_team_season_stats (csapat statok)                   │
│  - winmix_round_standings (forduló állások)                   │
│  - winmix_run_statistics (Brier, log loss, ECE, CI)           │
│  - winmix_h2h_pairs (H2H párok)                               │
│  - Ezek a pipeline VÉGÉN számítódnak, nem a böngészőben       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  BÖNGÉSZŐ (lapos kliens)                                      │
│                                                               │
│  - Olvas az előre számított táblákból (SELECT, RLS-gate)      │
│  - Lapozott meccs lista szerveroldalról                       │
│  - Csak a kiválasztott liga/szezon adatai                     │
│  - Pipeline csak fixture predikcióhoz (jövőbeli meccsek)      │
│  - Lokális pipeline csak offline módban                      │
└──────────────────────────────────────────────────────────────┘
```

> **Kulcskülönbség a korábbi javaslatattól:** A 25 000-es pipeline számítás NEM az Edge Function-ben fut. Az Edge Function csak kérésbefogadásra, rövid adminműveletre és státuszkezelésre szolgál. A történeti pipeline helyi vagy tartós workerben fut.

### 6.4. Index javaslatok

A meglévő migrációkban nincsenek explicit indexek a gyakori lekérdezési mintákra. Javasolt:

```sql
-- Meccs lekérdezés liga + szezon + forduló szerint
CREATE INDEX idx_matches_league_season_round
  ON winmix_matches(data_version_id, league, season_id, match_no);

-- Csapat statisztikák lekérdezése
CREATE INDEX idx_team_stats_run_league
  ON winmix_team_season_stats(run_id, league, season_id);

-- H2H párok lekérdezése
CREATE INDEX idx_h2h_run_league
  ON winmix_h2h_pairs(run_id, league, home_team_id, away_team_id);

-- Predikciók lekérdezése meccs szerint
CREATE INDEX idx_predictions_run_match
  ON winmix_predictions(run_id, match_id);
```

---

## 7. Biztonsági architektúra értékelése

### 7.1. Erősségek

1. **Szigorú read-only public surface** — minden publikus táblán csak SELECT policy; nincsenek INSERT/UPDATE/DELETE policy-k
2. **Current-run gating** — a motor kimenetek csak `is_current + succeeded` után láthatók — **de** a `winmix_seasons`, `winmix_matches`, `winmix_teams` és `winmix_pipeline_checkpoints` táblákon `USING (true)` permissive policy is van, amely felülírja a verziószűrést (lásd 3.2)
3. **Integrity-by-construction** — generated columns és constraint-ek megakadályozzák az inkonzisztens adatokat
4. **Concurrency-safe job queue** — `FOR UPDATE SKIP LOCKED` + lease
5. **Single promotion point** — `winmix_promote_engine_run` az egyetlen hely az `is_current` váltásra
6. **Service-role kulcs sosem a böngészőben** — az edge function a saját env-ből olvassa
7. **Zod validáció a kliens boundary-n** — minden cloud válasz validálva
8. **Opaque-key kezelés** — `sb_publishable_` kulcsok nem `Bearer`-ként küldve

### 7.2. Figyelmet igénylő területek

1. **`previewAuthStorage.ts` postMessage** — origin validáció van, de érdemes rendszeresen ellenőrizni a megbízható originok listáját
2. **Edge function CORS** — `Access-Control-Allow-Origin: *` megfelelő a jelenlegi architektúrában, de ha később érzékeny adatok is mennek, érdemes szűkíteni
3. **Bucket `winmix-incoming`** — 50MB limit, CSV/JSON only — megfelelő, de érdemes monitorozni a feltöltési gyakoriságot

---

## 8. Részletes táblák leírása

### 8.1. Cloud Tier táblák (Family 1)

#### winmix_teams
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| id | uuid PK | Egyedi azonosító |
| league | text | Liga (angol/spanyol) |
| canonical_key | text | Kanonikus kulcs |
| display_name | text | Megjelenítendő név |
| weight_index | numeric | Súlyindex (0-10, default 5.0) |
| weight_source | text | Súlyforrás (auto/manual) |
| updated_at | timestamptz | Frissítés időpontja |

> **Korrekció (2026-09-24):** A `data_version_id` oszlop **nem létezik** a tényleges sémában. A csapatok ligához kötődnek, nem adatverzióhoz.

#### winmix_seasons
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| id | uuid PK | Egyedi azonosító |
| league | text | Liga |
| season_index | int | Szezon sorszáma |
| name | text | Szezon neve |
| file_name | text | Fájlnév |
| content_hash | text | Tartalmi hash |
| match_count | int | Meccsek száma |
| order_mode | text | Rendezési mód |
| data_version_id | uuid | Verzió kötés |

#### winmix_matches
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| id | uuid PK | Egyedi azonosító |
| season_id | uuid FK | Szezon |
| league | text | Liga |
| match_no | int | Meccs sorszáma |
| source_file_id | text (nullable) | Forrásfájl azonosító |
| row_index | int (nullable) | Sor index |
| kickoff_iso | timestamptz (nullable) | Kezdés időpontja (ISO) |
| match_date_raw | text (nullable) | Nyers dátum szöveg |
| home_team_id | uuid FK | Hazai csapat |
| away_team_id | uuid FK | Vendég csapat |
| ht_home_score | int (nullable) | Félidő hazai |
| ht_away_score | int (nullable) | Félidő vendég |
| home_score | int | Hazai gólok |
| away_score | int | Vendég gólok |
| total_goals | int (nullable) | Összes gól |
| btts | bool (nullable) | Mindkét csapat szerzett |
| outcome | text (nullable) | Eredmény (H/A/D) |
| created_at | timestamptz | Létrehozás időpontja |
| data_version_id | uuid | Verzió kötés |

> **Korrekció (2026-09-24):** `kickoff` helyett `kickoff_iso timestamptz` + `match_date_raw text`. Új oszlopok: `source_file_id`, `row_index`, `created_at`.

#### view_team_ratings
- SQL tükör a `computeAutoTeamWeights()` logikának
- `security_invoker = true` — base tábla RLS érvényesül
- Súly: `raw_score = 0.55*net_home + 0.45*net_away + 0.33*ppg`, standardizálva [0,10]

### 8.2. Engine táblák (Family 2)

#### winmix_pipeline_checkpoints

> **Korrekció (2026-09-24):** A tábla **nem run-scoped**. Elsődleges kulcsa `league`, nincs `data_version_id`, `run_id` vagy `parameter_snapshot_id` oszlopa. Ezért önmagában nem reprodukálható jövőbeli predikció forrása. A reprodukálhatóságot a `winmix_fixture_prediction_requests` tábla `source_run_id + data_version_id + parameter_snapshot_id` hármas rögzítése biztosítja. A checkpointot később run-szintűvé kell bővíteni (új migráció).

| Oszlop | Típus | Leírás |
|--------|-------|--------|
| league | text PK | Liga (elsődleges kulcs) |
| feature_schema_version | int | Feature séma verzió |
| processed_match_count | int | Feldolgozott meccsek száma |
| prefix_signature | text | Prefix aláírás |
| weights_signature | text | Súly aláírás |
| experiments_key | text | Kísérlet kulcs |
| history_scope | text | season-only / league-cumulative |
| calibration_t | numeric (nullable) | Kalibrációs hőmérséklet |
| ensemble_w_m1 | numeric (nullable) | Ensemble M1 súly |
| ensemble_tuned | bool (nullable) | Ensemble hangolva |
| m1_fit | jsonb (nullable) | M1 illesztés (belső modellállapot) |
| calib_history | jsonb (nullable) | Kalibrációs történet (belső modellállapot) |
| fit_history | jsonb (nullable) | Illesztési történet (belső modellállapot) |
| saved_at | timestamptz | Mentés időpontja |

> **Biztonsági megjegyzés:** A `m1_fit`, `calib_history` és `fit_history` jsonb mezők belső modellállapotot tartalmaznak. A `winmix_checkpoints_read_all` (`using=true`) policy miatt ezek publikusan olvashatóak. Nem blokkolja a Prediktort, de később le kell zárni.

#### winmix_data_versions
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| id | uuid PK | Egyedi azonosító |
| version_key | text unique | Verzió kulcs |
| status | text | draft/sealed/superseded/rejected |
| is_current | bool | Jelenlegi verzió |
| expected_matches_per_season | int | Várt meccsek/szezon (default 240) |
| league_coverage | jsonb | Liga lefedettség |
| season_count | int | Szezonok száma |
| match_count | int | Meccsek száma |
| content_fingerprint | text (nullable) | Tartalmi ujjlenyomat |
| source_description | text (nullable) | Forrás leírás |
| sealed_at | timestamptz (nullable) | Lezárás időpontja |
| created_at | timestamptz | Létrehozás időpontja |
| updated_at | timestamptz | Frissítés időpontja |

#### winmix_parameter_snapshots
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| id | uuid PK | Egyedi azonosító |
| data_version_id | uuid FK | Verzió kötés |
| model_version | text | Modell verzió |
| feature_schema_version | int | Feature séma verzió |
| pipeline_contract_version | int | Pipeline contract verzió |
| history_scope | text | season-only / league-cumulative |
| experiments | jsonb | Kísérletek |
| weights | jsonb | Súlyok |
| manual_weight_overrides | jsonb | Kézi súly-felülbírálások |
| settings | jsonb | Beállítások |
| parameters_fingerprint | text (nullable, generated md5) | Paraméter ujjlenyomat |
| created_at | timestamptz | Létrehozás időpontja |

#### winmix_engine_jobs
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| id | uuid PK | Egyedi azonosító |
| data_version_id | uuid FK | Verzió |
| parameter_snapshot_id | uuid FK | Paraméter |
| status | text | queued/running/succeeded/failed/cancelled |
| attempt_count | int | Próbálkozások |
| claimed_at | timestamptz | Claim időpontja |
| claimed_by | text | Claimelő |
| last_error_code | text | Utolsó hiba kód |
| last_error_message | text | Utolsó hiba üzenet |

#### winmix_engine_runs
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| id | uuid PK | Egyedi azonosító |
| job_id | uuid FK (nullable, unique) | Job |
| data_version_id | uuid FK | Adatverzió kötés |
| parameter_snapshot_id | uuid FK | Paraméter-pillanatkép kötés |
| engine_version | text | Motor verzió |
| status | text | running/succeeded/failed/cancelled |
| is_current | bool | Jelenlegi futás |
| input_fingerprint | text | Bemenet ujjlenyomat |
| started_at | timestamptz | Indítás időpontja |
| finished_at | timestamptz (nullable) | Befejezés időpontja |
| duration_ms | bigint (nullable) | Futás idő (ms) |
| result_summary | jsonb | Eredmény összesítés |
| error_code | text (nullable) | Hibakód |
| error_message | text (nullable) | Hibaüzenet |

#### winmix_match_features
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| run_id | uuid FK | Futás |
| match_id | uuid FK | Meccs |
| sequence_no | int | Sorszám |
| feature_schema_version | int | Feature séma verzió |
| features | jsonb | Feature vektor |
| created_at | timestamptz | Létrehozás időpontja |
| PK: (run_id, match_id) | | |

#### winmix_predictions
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| run_id | uuid FK | Futás |
| match_id | uuid FK | Meccs |
| outcome_home | numeric | Hazai győzelem valószínűség |
| outcome_draw | numeric | Döntetlen valószínűség |
| outcome_away | numeric | Vendég győzelem valószínűség |
| lambda_home | numeric (nullable) | Hazai gólvárható |
| lambda_away | numeric (nullable) | Vendég gólvárható |
| confidence | numeric (nullable) | Konfidencia |
| recommendation | jsonb | Ajánlás |
| markets | jsonb | Piaci opciók |
| model_output | jsonb | Modell kimenet |
| created_at | timestamptz | Létrehozás időpontja |
| Constraint: probabilities sum to 1.0 | | |

> **Korrekció (2026-09-24):** Az oszlopok nevei `outcome_home`, `outcome_draw`, `outcome_away` — NEM `home_prob`, `draw_prob`, `away_prob`.

#### winmix_calibration_results
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| run_id | uuid FK | Futás |
| league | text | Liga |
| market_code | text | Piaci kód |
| sample_count | int | Mintaméret |
| brier | numeric (nullable) | Brier score |
| log_loss | numeric (nullable) | Log loss |
| ece | numeric (nullable) | Expected Calibration Error |
| metrics | jsonb | További metrikák |
| created_at | timestamptz | Létrehozás időpontja |
| PK: (run_id, league, market_code) | | |

### 8.3. Fixture predikció táblák

#### winmix_fixture_prediction_requests
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| id | uuid PK | Egyedi azonosító |
| idempotency_key | uuid unique | Idempotens kulcs |
| input_hash | text unique | Bemenet hash |
| league | text | Liga |
| cutoff_at | timestamptz (nullable) | Cutoff időpont |
| source_run_id | uuid FK | Forrás futás |
| data_version_id | uuid FK | Adatverzió kötés |
| parameter_snapshot_id | uuid FK | Paraméter-pillanatkép kötés |
| request_payload | jsonb | Kérés payload |
| status | text | queued/running/sealed/ready/published/failed/cancelled |
| claimed_at | timestamptz (nullable) | Claim időpontja |
| claimed_by | text (nullable) | Claimelő |
| published_at | timestamptz (nullable) | Publikálás időpontja |
| error_code | text (nullable) | Hibakód |
| error_message | text (nullable) | Hibaüzenet |
| created_at | timestamptz | Létrehozás időpontja |
| updated_at | timestamptz | Frissítés időpontja |

> **Korrekció (2026-09-24):** A `source_run_id` mellett `data_version_id` és `parameter_snapshot_id` is szerepel. Ez a hármás biztosítja a reprodukálhatóságot — a worker nem egyetlen „aktuális checkpointot" használ vakon, hanem minden 1–16 párosítási kérésnél rögzíti a konkrét forrás-run-t, adatverziót és paraméter-snapshotot.

#### winmix_fixture_prediction_cards
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| request_id | uuid FK | Kérés |
| fixture_no | int | Fixture sorszám (1-16) |
| home_team_id | uuid FK | Hazai csapat |
| away_team_id | uuid FK | Vendég csapat |
| card | jsonb | Predikciós kártya |
| decision_trace | jsonb | Döntési nyom |
| Unique: (request_id, fixture_no) | | |

#### winmix_fixture_prediction_selections
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| request_id | uuid FK | Kérés |
| selection_kind | text | core/joker |
| slot_no | int | Hely sorszám (1-3) |
| card_id | uuid (nullable) | Kártya |
| market_key | text (nullable) | Piaci kulcs |
| selection_trace | jsonb | Kiválasztási nyom |
| created_at | timestamptz | Létrehozás időpontja |
| PK: (request_id, selection_kind, slot_no) | | |

---

## 9. Migrációk időrendje

| Dátum | Migráció | Tartalom |
|-------|----------|---------|
| 2026-09-02 | `501e0710...` | Kezdeti generikus ML séma + triggerek |
| 2026-09-04 | `winmix_cloud_tier_schema` | Cloud tier táblák + view_team_ratings + RLS |
| 2026-09-04 | `revoke_view_write_privileges` | View írási jogok visszavonása |
| 2026-09-21 | `winmix_central_engine_v1` | Engine pipeline + verziózás + job queue + promotion |
| 2026-09-21 | `winmix_engine_contract_hardening` | Hardened promotion + contract v6 + lease requeue |
| 2026-09-22 | `reseal_baseline_fingerprint` | Baseline fingerprint javítás |
| 2026-09-22 | `winmix_fixture_prediction_releases` | Fixture predikció pipeline |

---

## 10. Összefoglalás

A WinMix-Supabase architektúra **biztonsági szempontból kiválóan felépített** — szigorú RLS, integrity-by-construction, concurrency-safe job queue, és a service-role kulcs sosem éri el a böngészőt.

A **teljesítményprobléma gyökere** nem a Supabase-ben van, hanem az alkalmazás elemzési architektúrájában:
- 25 000 rekord egyidejű betöltése a böngészőbe
- O(N²) és O(N²/K) algoritmusok kliensoldali futtatása
- Bootstrap resampling szinkron módon a main thread-en
- Nincsenek előre számított aggregációk

**A javasolt irány (revideálva):**
- A teljes 25 000-es történeti pipeline **helyi vagy tartós workerben** fut, optimalizált algoritmusokkal — NEM Edge Function-ben.
- Az Edge Function kérésbefogadásra, rövid adminműveletre és státuszkezelésre való.
- A Prediktor első működő átadása (1–16 párosítás → Core/Joker döntés → mentett kiadás → eredményrögzítés) **prioritást élvez** az aggregációs javaslatok előtt.
- Az elemző oldalak szerveroldali aggregációi és lapozása a Prediktor utáni fázisban (5. lépés) készülnek.
- A fixture-predikciós Edge Function **nincs deployolva** — nem kész funkció, amíg a worker és a felület össze nincs kötve.

A Supabase maradhat; a Neonra váltás nem oldaná meg a problémát, mert ugyanazok a nem hatékony algoritmusok ott is lassúak lennének.
