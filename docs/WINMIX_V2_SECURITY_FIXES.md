# WinMix V2 — Biztonsági javítások és hiányzó táblák

Ez a fájl a 2026-09-25 adatbázis-audit alapján azonosított problémák javítását
tartalmazza. A szkripteket a Supabase SQL Editorban kell lefuttatni.

**Fontos:** A szkriptek idempotensek — biztonságosan újrafuttathatók.

---

## 1. RLS policy ütközések megszüntetése

A `winmix_seasons`, `winmix_matches` és `winmix_pipeline_checkpoints` táblákon
`USING (true)` permissive SELECT policy van, ami mindent láthatóvá tesz.
A `winmix_seasons` és `winmix_matches` táblákon emellett van egy verzió-szűrt
policy is, de mivel mindkettő permissive, az eredményük OR kapcsolatú — a `true`
policy miatt a korábbi/nem aktuális sorok is látszanak. A `winmix_pipeline_checkpoints`
táblán csak a `true` policy van, így a teljes pipeline konfiguráció (calibration_t,
ensemble weights, fit history) nyilvánosan olvasható.

**Megoldás:** A `USING (true)` policy-ket el kell távolítani. A `winmix_seasons`
és `winmix_matches` táblákon ezáltal csak a verzió-szűrt policy marad. A
`winmix_pipeline_checkpoints` táblán a `true` policy eltávolítása után csak a
service-role lesz képes olvasni — ez a megfelelő viselkedés, mivel a pipeline
konfiguráció belső adat, nem publikus.

```sql
-- =============================================================================
-- 1a. winmix_seasons: távolítsuk el a USING(true) policy-t
-- =============================================================================
DROP POLICY IF EXISTS winmix_seasons_read_all ON public.winmix_seasons;

-- =============================================================================
-- 1b. winmix_matches: távolítsuk el a USING(true) policy-t
-- =============================================================================
DROP POLICY IF EXISTS winmix_matches_read_all ON public.winmix_matches;

-- =============================================================================
-- 1c. winmix_pipeline_checkpoints: távolítsuk el a USING(true) policy-t
--     A pipeline konfiguráció (calibration_t, ensemble weights, fit history)
--     belső adat, nem kell publikusnak lennie.
-- =============================================================================
DROP POLICY IF EXISTS winmix_checkpoints_read_all ON public.winmix_pipeline_checkpoints;

NOTIFY pgrst, 'reload schema';
```

---

## 2. Veszélyes jogosultságok visszavonása (TRUNCATE, TRIGGER, REFERENCES)

Az audit során kiderült, hogy több WinMix táblán az `anon` és `authenticated`
szerepkörök `TRUNCATE`, `TRIGGER` és `REFERENCES` jogosultsággal rendelkeznek.
Az RLS nem védi a `TRUNCATE` műveletet, így ez kritikus biztonsági rés.

**Érintett táblák:** winmix_teams, winmix_seasons, winmix_matches,
winmix_fixture_prediction_cards, winmix_fixture_prediction_requests,
winmix_fixture_prediction_selections, winmix_current_engine_status (nézet).

```sql
-- =============================================================================
-- 2. Veszélyes jogosultságok visszavonása az anon és authenticated szerepköröktől
-- =============================================================================

-- Táblák: TRUNCATE, TRIGGER, REFERENCES visszavonása
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.winmix_teams FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.winmix_seasons FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.winmix_matches FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.winmix_fixture_prediction_cards FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.winmix_fixture_prediction_requests FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.winmix_fixture_prediction_selections FROM anon, authenticated;

-- Nézet: TRUNCATE, TRIGGER, REFERENCES visszavonása
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.winmix_current_engine_status FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
```

---

## 3. touch_updated_at trigger javítása

A `touch_updated_at()` függvény `NEW.updated_at` mezőt ír, de:
- A `winmix_seasons` táblának **nincs** `updated_at` oszlopa → a trigger hibát okoz.
- A `winmix_pipeline_checkpoints` táblában a mező neve `saved_at`, nem `updated_at`.

**Megoldás:** A triggereket eltávolítjuk az érintett táblákról, amíg a séma
nem kerül összehangolásra. A `winmix_teams` táblán a trigger helyes marad,
mivel ott létezik `updated_at` oszlop.

```sql
-- =============================================================================
-- 3a. winmix_seasons: trigger eltávolítása (nincs updated_at oszlop)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_touch_winmix_seasons_updated_at ON public.winmix_seasons;

-- =============================================================================
-- 3b. winmix_pipeline_checkpoints: trigger eltávolítása (saved_at, nem updated_at)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_touch_winmix_checkpoints_updated_at ON public.winmix_pipeline_checkpoints;

-- Megjegyzés: Ha a későbbiekben szükséges az updated_at mező a winmix_seasons
-- táblán, akkor azt külön migrációban kell hozzáadni:
--   ALTER TABLE public.winmix_seasons ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
-- Ekkor a trigger újra létrehozható.
```

---

## 4. Hiányzó V2 táblák létrehozása

Az adatbázisban már léteznek a következő V2 táblák:
- winmix_h2h_pairs ✓
- winmix_team_season_stats ✓
- winmix_round_standings ✓
- winmix_run_statistics ✓
- winmix_match_outcomes ✓

De **hiányoznak** a következő három tábla, amelyeket a V2 Master Prompt 5.
szekciója ír le:
- winmix_prediction_evaluations — predikció kiértékelések
- winmix_reliability_scores — csapat megbízhatósági pontszámok
- winmix_prediction_outcome_links — predikció ↔ eredmény kapcsolat

### Fontos eltérések az eredeti migrációs dokumentumhoz képest:

A `winmix_match_outcomes` tábla a live DB-ben már létezik, de **más sémával**,
mint amit az eredeti migrációs dokumentum ír:
- A live DB-ben a PK egy `id uuid` oszlop (nem `match_id`), és van `version`
  oszlop, valamint `UNIQUE(match_id, version)` constraint.
- Az eredeti dokumentum `match_id`-t tett PK-nak és nem volt `version` oszlop.
- Ezért a `prediction_outcome_links` tábla FK-ja `winmix_match_outcomes(match_id)`
  helyett `winmix_match_outcomes(id)` legyen, vagy `match_id`-re hivatkozzon
  a `UNIQUE(match_id, version)` indexen keresztül — de mivel a live DB
  `id`-t használ PK-nak, a legegyszerűbb megoldás az `id` oszlopra hivatkozni.

```sql
-- =============================================================================
-- 4a. winmix_prediction_evaluations — predikció kiértékelések
--    A kiértékelés az eredeti predikciót használja, nem az utolsó modell futását.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.winmix_prediction_evaluations (
  run_id            uuid NOT NULL REFERENCES public.winmix_engine_runs(id) ON DELETE CASCADE,
  match_id          uuid NOT NULL REFERENCES public.winmix_matches(id) ON DELETE RESTRICT,
  predicted_outcome text NOT NULL CHECK (predicted_outcome IN ('H', 'D', 'A')),
  actual_outcome    text NOT NULL CHECK (actual_outcome IN ('H', 'D', 'A')),
  hit               boolean NOT NULL,
  brier_score       numeric(8,4) CHECK (brier_score >= 0),
  log_loss          numeric(8,4) CHECK (log_loss >= 0),
  market_hits       jsonb NOT NULL DEFAULT '{}'::jsonb,
  eval_window       text NOT NULL DEFAULT 'full-season' CHECK (eval_window IN ('full-season', 'last-10', 'last-5')),
  evaluated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT winmix_prediction_evaluations_pkey PRIMARY KEY (run_id, match_id, eval_window)
);

CREATE INDEX IF NOT EXISTS winmix_pred_evals_run_idx
  ON public.winmix_prediction_evaluations (run_id, eval_window);

-- =============================================================================
-- 4b. winmix_reliability_scores — csapat megbízhatósági pontszámok
--    A V2 Master Prompt 5. szekciójában leírt büntetés/megbízhatóság tárolás.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.winmix_reliability_scores (
  run_id              uuid NOT NULL REFERENCES public.winmix_engine_runs(id) ON DELETE CASCADE,
  team_id             uuid NOT NULL REFERENCES public.winmix_teams(id) ON DELETE RESTRICT,
  league              text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  total_predictions   integer NOT NULL DEFAULT 0 CHECK (total_predictions >= 0),
  correct_predictions integer NOT NULL DEFAULT 0 CHECK (correct_predictions >= 0),
  accuracy            numeric(6,4) CHECK (accuracy >= 0 AND accuracy <= 1),
  avg_brier           numeric(8,4) CHECK (avg_brier >= 0),
  avg_confidence      numeric(6,4) CHECK (avg_confidence >= 0 AND avg_confidence <= 1),
  penalty_score       numeric(6,4) DEFAULT 0 CHECK (penalty_score >= 0 AND penalty_score <= 1),
  reliability_band    text CHECK (reliability_band IN ('high', 'medium', 'low', 'insufficient')),
  last_evaluated_at   timestamptz NOT NULL DEFAULT now(),
  metrics             jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT winmix_reliability_scores_pkey PRIMARY KEY (run_id, team_id),
  CONSTRAINT winmix_reliability_count_check CHECK (correct_predictions <= total_predictions)
);

CREATE INDEX IF NOT EXISTS winmix_reliability_run_league_idx
  ON public.winmix_reliability_scores (run_id, league, reliability_band);

-- =============================================================================
-- 4c. winmix_prediction_outcome_links — predikció ↔ eredmény kapcsolat
--    Immutable: egy predikció pontosan egy eredményhez köthető (ha már lejátszották)
--    A winmix_match_outcomes tábla a live DB-ben id uuid PK-t használ,
--    ezért a FK az id oszlopra mutat.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.winmix_prediction_outcome_links (
  prediction_run_id  uuid NOT NULL REFERENCES public.winmix_engine_runs(id) ON DELETE CASCADE,
  match_id          uuid NOT NULL REFERENCES public.winmix_matches(id) ON DELETE RESTRICT,
  outcome_id        uuid NOT NULL REFERENCES public.winmix_match_outcomes(id) ON DELETE RESTRICT,
  linked_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT winmix_prediction_outcome_links_pkey PRIMARY KEY (prediction_run_id, match_id)
);

CREATE INDEX IF NOT EXISTS winmix_pred_outcome_links_run_idx
  ON public.winmix_prediction_outcome_links (prediction_run_id);

-- =============================================================================
-- 4d. RLS a három új táblán
-- =============================================================================

-- winmix_prediction_evaluations: csak current + succeeded run
ALTER TABLE public.winmix_prediction_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.winmix_prediction_evaluations FROM anon, authenticated;
GRANT SELECT ON public.winmix_prediction_evaluations TO anon, authenticated;

DROP POLICY IF EXISTS winmix_pred_evals_current_read ON public.winmix_prediction_evaluations;
CREATE POLICY winmix_pred_evals_current_read ON public.winmix_prediction_evaluations
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.winmix_engine_runs r
            WHERE r.id = run_id AND r.is_current AND r.status = 'succeeded')
  );

-- winmix_reliability_scores: csak current + succeeded run
ALTER TABLE public.winmix_reliability_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.winmix_reliability_scores FROM anon, authenticated;
GRANT SELECT ON public.winmix_reliability_scores TO anon, authenticated;

DROP POLICY IF EXISTS winmix_reliability_current_read ON public.winmix_reliability_scores;
CREATE POLICY winmix_reliability_current_read ON public.winmix_reliability_scores
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.winmix_engine_runs r
            WHERE r.id = run_id AND r.is_current AND r.status = 'succeeded')
  );

-- winmix_prediction_outcome_links: csak current + succeeded run
ALTER TABLE public.winmix_prediction_outcome_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.winmix_prediction_outcome_links FROM anon, authenticated;
GRANT SELECT ON public.winmix_prediction_outcome_links TO anon, authenticated;

DROP POLICY IF EXISTS winmix_pred_outcome_links_current_read ON public.winmix_prediction_outcome_links;
CREATE POLICY winmix_pred_outcome_links_current_read ON public.winmix_prediction_outcome_links
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.winmix_engine_runs r
            WHERE r.id = prediction_run_id AND r.is_current AND r.status = 'succeeded')
  );

NOTIFY pgrst, 'reload schema';
```

---

## 5. Ellenőrző lekérdezések

A javítások futtatása után ellenőrizd az eredményeket:

```sql
-- 5a. RLS policy-k ellenőrzése (nem szabad USING(true) policy-t látni
--     a winmix_seasons, winmix_matches és winmix_pipeline_checkpoints táblákon)
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('winmix_seasons', 'winmix_matches', 'winmix_pipeline_checkpoints')
ORDER BY tablename, policyname;

-- 5b. Veszélyes jogosultságok ellenőrzése (nem szabad TRUNCATE/TRIGGER/REFERENCES
--     jogot látni az anon/authenticated szerepkörökön)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
ORDER BY grantee, table_name, privilege_type;

-- 5c. Új táblák létezésének ellenőrzése
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'winmix_prediction_evaluations',
    'winmix_reliability_scores',
    'winmix_prediction_outcome_links'
  )
ORDER BY tablename;

-- 5d. RLS engedélyezett állapot ellenőrzése
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'winmix_%'
ORDER BY tablename;

-- 5e. Trigger állapot ellenőrzése (a seasons és checkpoints táblákon
--      nem szabad trigger-t látni)
SELECT event_object_table, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('winmix_seasons', 'winmix_pipeline_checkpoints')
ORDER BY event_object_table, trigger_name;
```

---

## Futtatási sorrend

1. **1. szkript** — RLS policy ütközések megszüntetése (azonnal, kritikus)
2. **2. szkript** — Veszélyes jogosultságok visszavonása (azonnal, kritikus)
3. **3. szkript** — Trigger javítások (biztonságos, de fontos)
4. **4. szkript** — Hiányzó V2 táblák létrehozása
5. **5. szkript** — Ellenőrző lekérdezések lefuttatása

## Megjegyzések

- Az 1. és 2. szkript **kritikus biztonsági javítások** — ezeket minél hamarabb
  le kell futtatni.
- A 3. szkript a `touch_updated_at` trigger hibáját oldja meg. Ha később
  hozzáadják az `updated_at` oszlopot a `winmix_seasons` táblához, a trigger
  újra létrehozható.
- A 4. szkript három új táblát hoz létre, amelyek a V2 kiértékelési és
  megbízhatósági funkciókhoz szükségesek.
- A `winmix_match_outcomes` tábla már létezik a live DB-ben, de eltérő sémával
  (`id` PK + `version` oszlop), mint amit az eredeti migrációs dokumentum írt.
  A `prediction_outcome_links` tábla FK-ja ezért az `id` oszlopra mutat.
