# WinMix V2 — SQL Migrációk a Supabase SQL Editorhoz

Ez a fájl két SQL szkriptet tartalmaz, amelyeket a Supabase SQL Editorban kell
lefuttatni sorrendben. A szkriptek a WINMIX_V2_MASTER_PROMPT.md és a
WINMIX_SUPABASE_ARCHITECTURE.md dokumentumokban leírt sémát implementálják.

**Fontos:** A szkriptek idempotensek — biztonságosan újrafuttathatók.
Ha egy tábla már létezik, a `CREATE TABLE IF NOT EXISTS` átugorja.

---

## 1. Migráció: Előre számított aggregációs táblák

Ez a szkript 4 új táblát hoz létre a dokumentáció 6.2 szekciójában leírtak szerint.
Célja, hogy a böngésző ~20 sort olvasson ligánként ahelyett, hogy 25 000 meccset
töltene le és O(N²) számításokat végezne kliensoldalon.

### Új táblák:
- **winmix_h2h_pairs** — Irányított H2H aggregáció (hazai/vendég sorrend megőrizve)
- **winmix_team_season_stats** — Csapat-szezón statisztikák (PPG, BTTS%, Over%, stb.)
- **winmix_round_standings** — Liga állás fordulónként
- **winmix_run_statistics** — Minőségi metrikák (Brier, log loss, ECE, CI)

### Biztonság:
- RLS engedélyezve mind a 4 táblán
- Csak `is_current = true` AND `status = 'succeeded'` run adatai láthatók
- Írás csak service-role a worker-en keresztül (nincs INSERT/UPDATE/DELETE policy)

```sql
-- =============================================================================
-- 1. winmix_h2h_pairs — irányított H2H aggregáció
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.winmix_h2h_pairs (
  run_id          uuid NOT NULL REFERENCES public.winmix_engine_runs(id) ON DELETE CASCADE,
  league          text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  home_team_id    uuid NOT NULL REFERENCES public.winmix_teams(id) ON DELETE RESTRICT,
  away_team_id    uuid NOT NULL REFERENCES public.winmix_teams(id) ON DELETE RESTRICT,
  meetings        integer NOT NULL DEFAULT 0 CHECK (meetings >= 0),
  home_wins       integer NOT NULL DEFAULT 0 CHECK (home_wins >= 0),
  draws           integer NOT NULL DEFAULT 0 CHECK (draws >= 0),
  away_wins       integer NOT NULL DEFAULT 0 CHECK (away_wins >= 0),
  home_goals      integer NOT NULL DEFAULT 0 CHECK (home_goals >= 0),
  away_goals      integer NOT NULL DEFAULT 0 CHECK (away_goals >= 0),
  btts_count      integer NOT NULL DEFAULT 0 CHECK (btts_count >= 0),
  over25_count    integer NOT NULL DEFAULT 0 CHECK (over25_count >= 0),
  home_win_pct    numeric(6,4) CHECK (home_win_pct >= 0 AND home_win_pct <= 1),
  draw_pct        numeric(6,4) CHECK (draw_pct >= 0 AND draw_pct <= 1),
  away_win_pct    numeric(6,4) CHECK (away_win_pct >= 0 AND away_win_pct <= 1),
  btts_rate       numeric(6,4) CHECK (btts_rate >= 0 AND btts_rate <= 1),
  over25_rate     numeric(6,4) CHECK (over25_rate >= 0 AND over25_rate <= 1),
  avg_goals       numeric(6,2) CHECK (avg_goals >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT winmix_h2h_pairs_pkey PRIMARY KEY (run_id, league, home_team_id, away_team_id),
  CONSTRAINT winmix_h2h_pairs_count_sum CHECK (home_wins + draws + away_wins = meetings),
  CONSTRAINT winmix_h2h_pairs_distinct_teams CHECK (home_team_id <> away_team_id)
);

CREATE INDEX IF NOT EXISTS winmix_h2h_pairs_run_league_idx
  ON public.winmix_h2h_pairs (run_id, league, home_team_id, away_team_id);

-- =============================================================================
-- 2. winmix_team_season_stats — előre számított csapat statisztikák
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.winmix_team_season_stats (
  run_id          uuid NOT NULL REFERENCES public.winmix_engine_runs(id) ON DELETE CASCADE,
  team_id         uuid NOT NULL REFERENCES public.winmix_teams(id) ON DELETE RESTRICT,
  season_id       uuid NOT NULL REFERENCES public.winmix_seasons(id) ON DELETE RESTRICT,
  league          text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  played          integer NOT NULL DEFAULT 0 CHECK (played >= 0),
  wins            integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  draws           integer NOT NULL DEFAULT 0 CHECK (draws >= 0),
  losses          integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  goals_for       integer NOT NULL DEFAULT 0 CHECK (goals_for >= 0),
  goals_against   integer NOT NULL DEFAULT 0 CHECK (goals_against >= 0),
  points          integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  ppg             numeric(6,2) CHECK (ppg >= 0),
  btts_rate       numeric(6,4) CHECK (btts_rate >= 0 AND btts_rate <= 1),
  over25_rate     numeric(6,4) CHECK (over25_rate >= 0 AND over25_rate <= 1),
  clean_sheet_rate numeric(6,4) CHECK (clean_sheet_rate >= 0 AND clean_sheet_rate <= 1),
  failed_to_score_rate numeric(6,4) CHECK (failed_to_score_rate >= 0 AND failed_to_score_rate <= 1),
  form_last5      text,
  position        integer CHECK (position > 0),
  home_played     integer NOT NULL DEFAULT 0 CHECK (home_played >= 0),
  home_wins       integer NOT NULL DEFAULT 0 CHECK (home_wins >= 0),
  home_draws      integer NOT NULL DEFAULT 0 CHECK (home_draws >= 0),
  home_losses     integer NOT NULL DEFAULT 0 CHECK (home_losses >= 0),
  home_gf         integer NOT NULL DEFAULT 0 CHECK (home_gf >= 0),
  home_ga         integer NOT NULL DEFAULT 0 CHECK (home_ga >= 0),
  away_played     integer NOT NULL DEFAULT 0 CHECK (away_played >= 0),
  away_wins       integer NOT NULL DEFAULT 0 CHECK (away_wins >= 0),
  away_draws      integer NOT NULL DEFAULT 0 CHECK (away_draws >= 0),
  away_losses     integer NOT NULL DEFAULT 0 CHECK (away_losses >= 0),
  away_gf         integer NOT NULL DEFAULT 0 CHECK (away_gf >= 0),
  away_ga         integer NOT NULL DEFAULT 0 CHECK (away_ga >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT winmix_team_season_stats_pkey PRIMARY KEY (run_id, team_id, season_id),
  CONSTRAINT winmix_team_stats_count_sum CHECK (wins + draws + losses = played),
  CONSTRAINT winmix_team_stats_home_count_sum CHECK (home_wins + home_draws + home_losses = home_played),
  CONSTRAINT winmix_team_stats_away_count_sum CHECK (away_wins + away_draws + away_losses = away_played),
  CONSTRAINT winmix_team_stats_goals_check CHECK (goals_for >= home_gf + away_gf)
);

CREATE INDEX IF NOT EXISTS winmix_team_stats_run_league_idx
  ON public.winmix_team_season_stats (run_id, league, season_id);

-- =============================================================================
-- 3. winmix_round_standings — előre számított állás fordulónként
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.winmix_round_standings (
  run_id      uuid NOT NULL REFERENCES public.winmix_engine_runs(id) ON DELETE CASCADE,
  season_id   uuid NOT NULL REFERENCES public.winmix_seasons(id) ON DELETE RESTRICT,
  league      text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  round_no    integer NOT NULL CHECK (round_no > 0),
  team_id     uuid NOT NULL REFERENCES public.winmix_teams(id) ON DELETE RESTRICT,
  position    integer NOT NULL CHECK (position > 0),
  points      integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  played      integer NOT NULL DEFAULT 0 CHECK (played >= 0),
  goals_for   integer NOT NULL DEFAULT 0 CHECK (goals_for >= 0),
  goals_against integer NOT NULL DEFAULT 0 CHECK (goals_against >= 0),
  goal_diff   integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT winmix_round_standings_pkey PRIMARY KEY (run_id, season_id, round_no, team_id)
);

CREATE INDEX IF NOT EXISTS winmix_round_standings_run_season_round_idx
  ON public.winmix_round_standings (run_id, season_id, round_no);

-- =============================================================================
-- 4. winmix_run_statistics — előre számított minőségi metrikák
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.winmix_run_statistics (
  run_id              uuid NOT NULL REFERENCES public.winmix_engine_runs(id) ON DELETE CASCADE,
  league              text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  sample_count        integer NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  brier_score         numeric(8,4) CHECK (brier_score >= 0),
  log_loss            numeric(8,4) CHECK (log_loss >= 0),
  ece                 numeric(8,4) CHECK (ece >= 0),
  actionable_correct  integer NOT NULL DEFAULT 0 CHECK (actionable_correct >= 0),
  actionable_total    integer NOT NULL DEFAULT 0 CHECK (actionable_total >= 0),
  argmax_correct      integer NOT NULL DEFAULT 0 CHECK (argmax_correct >= 0),
  argmax_total        integer NOT NULL DEFAULT 0 CHECK (argmax_total >= 0),
  skill_ci_low        numeric(8,4),
  skill_ci_high       numeric(8,4),
  metrics             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT winmix_run_statistics_pkey PRIMARY KEY (run_id, league)
);

-- =============================================================================
-- 5. RLS — deny by default, csak current + succeeded run látható
-- =============================================================================
ALTER TABLE public.winmix_h2h_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winmix_team_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winmix_round_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winmix_run_statistics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.winmix_h2h_pairs, public.winmix_team_season_stats,
  public.winmix_round_standings, public.winmix_run_statistics
FROM anon, authenticated;

GRANT SELECT ON public.winmix_h2h_pairs, public.winmix_team_season_stats,
  public.winmix_round_standings, public.winmix_run_statistics
TO anon, authenticated;

DROP POLICY IF EXISTS winmix_h2h_pairs_current_read ON public.winmix_h2h_pairs;
CREATE POLICY winmix_h2h_pairs_current_read ON public.winmix_h2h_pairs
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.winmix_engine_runs r
            WHERE r.id = run_id AND r.is_current AND r.status = 'succeeded')
  );

DROP POLICY IF EXISTS winmix_team_stats_current_read ON public.winmix_team_season_stats;
CREATE POLICY winmix_team_stats_current_read ON public.winmix_team_season_stats
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.winmix_engine_runs r
            WHERE r.id = run_id AND r.is_current AND r.status = 'succeeded')
  );

DROP POLICY IF EXISTS winmix_round_standings_current_read ON public.winmix_round_standings;
CREATE POLICY winmix_round_standings_current_read ON public.winmix_round_standings
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.winmix_engine_runs r
            WHERE r.id = run_id AND r.is_current AND r.status = 'succeeded')
  );

DROP POLICY IF EXISTS winmix_run_statistics_current_read ON public.winmix_run_statistics;
CREATE POLICY winmix_run_statistics_current_read ON public.winmix_run_statistics
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.winmix_engine_runs r
            WHERE r.id = run_id AND r.is_current AND r.status = 'succeeded')
  );

NOTIFY pgrst, 'reload schema';
```

---

## 2. Migráció: Eredményrögzítés és kiértékelés (megváltoztathatatlan predikciós történet)

Ez a szkript a V2 Master Prompt 5. szekciójában leírt megváltoztathatatlan
predikciós történetet és eredményrögzítést implementálja.

### Új táblák:
- **winmix_match_outcomes** — Meccs eredmények append-only (nem felülírható)
- **winmix_prediction_evaluations** — Predikció kiértékelések (Brier, log loss, hit/miss)
- **winmix_reliability_scores** — Megbízhatósági pontszámok csapatonként
- **winmix_prediction_outcome_links** — Predikció ↔ eredmény kapcsolat (immutable)

### Biztonság:
- RLS engedélyezve mind a 4 táblán
- winmix_match_outcomes: publikusan olvasható (eredmények nyilvánosak)
- winmix_prediction_evaluations: csak current + succeeded run
- winmix_reliability_scores: csak current + succeeded run
- winmix_prediction_outcome_links: csak current + succeeded run
- Minden írás service-role only (nincs INSERT/UPDATE/DELETE policy a publikus szerepköröknek)
- Append-only kikényszerítve: trigger akadályozza az UPDATE/DELETE-et az outcomes táblán

```sql
-- =============================================================================
-- 1. winmix_match_outcomes — meccs eredmények (append-only, immutable)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.winmix_match_outcomes (
  match_id        uuid NOT NULL REFERENCES public.winmix_matches(id) ON DELETE RESTRICT,
  home_score      integer NOT NULL CHECK (home_score >= 0),
  away_score      integer NOT NULL CHECK (away_score >= 0),
  total_goals     integer NOT NULL CHECK (total_goals >= 0),
  btts            boolean NOT NULL,
  outcome         text NOT NULL CHECK (outcome IN ('H', 'D', 'A')),
  ht_home_score   integer CHECK (ht_home_score IS NULL OR ht_home_score >= 0),
  ht_away_score   integer CHECK (ht_away_score IS NULL OR ht_away_score >= 0),
  source          text NOT NULL DEFAULT 'import' CHECK (source IN ('import', 'manual', 'correction')),
  correction_note text,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  recorded_by     text,
  CONSTRAINT winmix_match_outcomes_pkey PRIMARY KEY (match_id),
  CONSTRAINT winmix_match_outcomes_total CHECK (total_goals = home_score + away_score),
  CONSTRAINT winmix_match_outcomes_btts CHECK (
    btts = (home_score > 0 AND away_score > 0)
  ),
  CONSTRAINT winmix_match_outcomes_outcome_check CHECK (
    (outcome = 'H' AND home_score > away_score) OR
    (outcome = 'A' AND away_score > home_score) OR
    (outcome = 'D' AND home_score = away_score)
  )
);

CREATE INDEX IF NOT EXISTS winmix_match_outcomes_league_idx
  ON public.winmix_match_outcomes (match_id);

-- Append-only trigger: megakadályozza az UPDATE és DELETE műveleteket
CREATE OR REPLACE FUNCTION public.winmix_prevent_outcome_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'winmix_match_outcomes is append-only. UPDATE and DELETE are not permitted. Use a correction insert instead.'
    USING ERRCODE = 'raisingexception';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS winmix_no_update_outcomes ON public.winmix_match_outcomes;
CREATE TRIGGER winmix_no_update_outcomes
  BEFORE UPDATE ON public.winmix_match_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.winmix_prevent_outcome_mutation();

DROP TRIGGER IF EXISTS winmix_no_delete_outcomes ON public.winmix_match_outcomes;
CREATE TRIGGER winmix_no_delete_outcomes
  BEFORE DELETE ON public.winmix_match_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.winmix_prevent_outcome_mutation();

REVOKE ALL ON FUNCTION public.winmix_prevent_outcome_mutation() FROM public, anon, authenticated;

-- =============================================================================
-- 2. winmix_prediction_outcome_links — predikció ↔ eredmény kapcsolat
--    Immutable: egy predikció pontosan egy eredményhez köthető (ha már lejátszották)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.winmix_prediction_outcome_links (
  prediction_run_id  uuid NOT NULL REFERENCES public.winmix_engine_runs(id) ON DELETE CASCADE,
  match_id          uuid NOT NULL REFERENCES public.winmix_matches(id) ON DELETE RESTRICT,
  outcome_match_id  uuid NOT NULL REFERENCES public.winmix_match_outcomes(match_id) ON DELETE RESTRICT,
  linked_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT winmix_prediction_outcome_links_pkey PRIMARY KEY (prediction_run_id, match_id)
);

CREATE INDEX IF NOT EXISTS winmix_pred_outcome_links_run_idx
  ON public.winmix_prediction_outcome_links (prediction_run_id);

-- =============================================================================
-- 3. winmix_prediction_evaluations — predikció kiértékelések
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
-- 4. winmix_reliability_scores — csapat megbízhatósági pontszámok
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
-- 5. RLS — deny by default
-- =============================================================================

-- winmix_match_outcomes: publikusan olvasható (eredmények nyilvánosak)
ALTER TABLE public.winmix_match_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.winmix_match_outcomes FROM anon, authenticated;
GRANT SELECT ON public.winmix_match_outcomes TO anon, authenticated;

DROP POLICY IF EXISTS winmix_outcomes_read ON public.winmix_match_outcomes;
CREATE POLICY winmix_outcomes_read ON public.winmix_match_outcomes
  FOR SELECT TO anon, authenticated USING (true);

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

NOTIFY pgrst, 'reload schema';
```

---

## Használati utasítások

1. Nyisd meg a Supabase projekt SQL Editorát.
2. Másold be az **1. migráció** teljes SQL kódját és futtasd le.
3. Ellenőrizd, hogy a 4 tábla létrejött-e: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'winmix_%' ORDER BY tablename;`
4. Másold be a **2. migráció** teljes SQL kódját és futtasd le.
5. Ellenőrizd az összes új táblát ugyanazzal a lekérdezéssel.
6. Futtasd a biztonsági ellenőrzést: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'winmix_%' ORDER BY tablename;` — minden új táblánál `rowsecurity` = `true` kell legyen.

## Fontos megjegyzések

- A szkriptek **nem módosítják** a meglévő táblákat — csak új táblákat hoznak létre.
- A `winmix_match_outcomes` tábla **append-only**: trigger akadályozza az UPDATE és DELETE műveleteket.
- Az eredmények `source` mezője megkülönbözteti az importált (`import`), manuális (`manual`) és javított (`correction`) forrásokat.
- A kiértékelések az **eredeti** predikciót használják, nem egy későbbi modell futását.
- Minden új tábla RLS-sel van védve — a böngésző csak olvashatja a `is_current + succeeded` run adatait (kivéve az eredményeket, amelyek publikusak).
