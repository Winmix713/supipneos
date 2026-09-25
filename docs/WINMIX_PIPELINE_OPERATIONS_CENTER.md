# WinMix Pipeline Operations Center

### A Premium Engineering Blueprint for Supabase-Driven Match Intelligence

**Version 1.1 · September 25, 2026 · Confidential**

**Revision notes (v1.1):** Refined against the live DDL schema dump. Four corrections: (1) the feedback model is now split into an immutable prediction-snapshot record plus an outcome join via `winmix_match_outcomes`, rather than storing `actual_result` as an updatable column; (2) the `home_team_id <> away_team_id` CHECK constraint is explicitly required on the H2H table since the DDL does not show it; (3) the `winmix_predictions.confidence` field is `numeric(0–1)`, so the `Confidence ≥ 56` threshold must be interpreted as a percentage-scale value derived from the model, not the raw column; (4) the `predicted_yes` extraction from the `markets` jsonb field needs an explicit market-code-to-yes/no mapping specification.

---

## 0. Executive Summary

This document is the single source of truth for the WinMix Pipeline Operations Center — the server-side control room that governs data ingestion, model execution, prediction publication, evaluation, and feedback-driven penalty management. It maps the current state of the Supabase database against the target architecture, identifies what belongs on the server versus what remains in the browser, and provides a concrete implementation roadmap with observations and recommendations throughout.

The fundamental principle: **the browser never processes raw match data.** All statistical computation happens server-side. The browser only reads pre-computed, indexed results and presents them to the user.

---

## 1. Current Database State — What Exists Today

### 1.1 Table Inventory

The Supabase database contains **23 WinMix tables** across two families:

#### Family 1 — Core Engine Tables (Versioned, RLS-Protected)

| Table | Purpose | RLS | Public Read Scope |
|-------|---------|-----|-------------------|
| `winmix_teams` | Teams (league-bound, not version-bound) | Enabled | All rows (`USING (true)`) |
| `winmix_seasons` | Seasons (version-bound) | Enabled | Current + sealed version only |
| `winmix_matches` | Matches (generated columns: total_goals, btts, outcome) | Enabled | Current + sealed version only |
| `winmix_data_versions` | Data version registry (draft/sealed/superseded/rejected) | Enabled | `is_current AND status = 'sealed'` |
| `winmix_parameter_snapshots` | Model parameters (weights, experiments, settings) | Enabled | No public access |
| `winmix_engine_jobs` | Job queue (queued/running/succeeded/failed/cancelled) | Enabled | No public access |
| `winmix_engine_runs` | Engine run records (is_current, status, fingerprints) | Enabled | `is_current AND status = 'succeeded'` |
| `winmix_match_features` | Per-match feature vectors (jsonb) | Enabled | Current run only |
| `winmix_team_state_snapshots` | Team state per match sequence | Enabled | Current run only |
| `winmix_predictions` | Predictions (outcome probs, lambdas, markets) | Enabled | Current run only |
| `winmix_calibration_results` | Calibration metrics (Brier, log loss, ECE) per league/market | Enabled | Current run only |
| `winmix_pipeline_checkpoints` | Diagnostic archive (PK = league, not run-scoped) | Enabled | No public access (policy dropped) |

#### Family 2 — Fixture Prediction Pipeline

| Table | Purpose | RLS | Public Read Scope |
|-------|---------|-----|-------------------|
| `winmix_fixture_prediction_requests` | Fixture prediction requests (queued → published) | Enabled | `status = 'published'` only |
| `winmix_fixture_prediction_cards` | Per-fixture prediction cards (16 per request) | Enabled | Published requests only |
| `winmix_fixture_prediction_selections` | Core/Joker slot assignments (3+3) | Enabled | Published requests only |

#### Family 3 — Aggregation Tables (Pre-computed)

| Table | Purpose | RLS | Public Read Scope |
|-------|---------|-----|-------------------|
| `winmix_h2h_pairs` | Directed H2H aggregates (home/away ordered) | Enabled | Current run only |
| `winmix_team_season_stats` | Team-season statistics (PPG, BTTS%, form, position) | Enabled | Current run only |
| `winmix_round_standings` | Round-by-round league standings | Enabled | Current run only |
| `winmix_run_statistics` | Quality metrics (Brier, log loss, ECE, skill CI) | Enabled | Current run only |

#### Family 4 — Outcome & Evaluation

| Table | Purpose | RLS | Public Read Scope |
|-------|---------|-----|-------------------|
| `winmix_match_outcomes` | Match results (append-only, immutable) | Enabled | All rows (`USING (true)`) — public results |
| `winmatch_prediction_evaluations` | Prediction evaluations (hit/miss, Brier, log loss) | Enabled | Current run only |
| `winmix_reliability_scores` | Team reliability bands (penalty, accuracy) | Enabled | Current run only |
| `winmix_prediction_outcome_links` | Prediction ↔ outcome immutable link | Enabled | Current run only |
| `winmix_import_batches` | Import audit log | Enabled | No public access |

### 1.2 What Is Working

1. **Versioned data pipeline** — `winmix_data_versions` tracks sealed/current versions with content fingerprints. The engine always runs against a known, sealed version.
2. **Concurrency-safe job queue** — `FOR UPDATE SKIP LOCKED` with 1800s lease ensures exactly-once job execution. Expired jobs are automatically requeued.
3. **Parameter snapshotting** — Every engine run captures its full parameter set (weights, experiments, settings) in `winmix_parameter_snapshots`, enabling reproducibility.
4. **Current-run gating** — Most engine output tables are only visible when `is_current = true AND status = 'succeeded'`, preventing half-baked results from reaching the browser.
5. **Directed H2H pairs** — The `winmix_h2h_pairs` table stores pairs in directed order (separate `home_team_id` and `away_team_id` columns, composite PK), preventing the Fulham→Chelsea / Chelsea→Fulham mixing problem. **Caveat:** the live DDL does not show a `CHECK (home_team_id <> away_team_id)` constraint — this must be added explicitly (see §3.1.1).
6. **Append-only outcomes** — The `winmix_match_outcomes` table has a `version` column and `UNIQUE(match_id, version)` constraint, plus triggers that block UPDATE and DELETE, ensuring result history is immutable. Corrections are new rows with `source = 'correction'` and an incremented `version`.
7. **Fixture prediction pipeline** — The request → card → selection chain is schema-complete, with idempotency keys and input hashes preventing duplicates.

### 1.3 What Is Not Yet Working

1. **Fixture prediction Edge Function is not deployed** — The `winmix-fixture-request` function source exists on disk, but the function is not live. The tables are empty. The browser cannot submit fixture prediction requests yet.
2. **No feedback loop** — The `winmix_prediction_feedback` and `winmix_pair_penalty` tables proposed in the architecture prompt do not exist in the database. The system has no memory of past prediction failures. This is the single biggest gap.
3. **No Core decisions audit log** — The `winmix_core_decisions` table proposed in the architecture prompt does not exist. There is no server-side record of why each Core/Joker selection was made.
4. **No H2H stats with Kish ESS** — The existing `winmix_h2h_pairs` table has basic aggregates (counts, rates) but lacks Kish Effective Sample Size, recency-weighted versions, HT→FT distributions, and odd/even goal splits proposed in the architecture prompt.
5. **Browser still computes everything** — The 25,000-match dataset is loaded into browser memory. All O(N²) algorithms (position history, prequential refits, bootstrap CI) run client-side on the main thread.
6. **Calibration bands are empty** — Every calibration band shows n=0/20. The feedback loop that would populate these bands does not exist.
7. **`winmix_pipeline_checkpoints` is not run-scoped** — Its primary key is `league`, not `run_id`. It cannot be used to reproduce a specific prediction. Reproducibility relies on the `source_run_id + data_version_id + parameter_snapshot_id` triple in fixture prediction requests.

---

## 2. The Pipeline Operations Center — Target Architecture

### 2.1 Concept

The Pipeline Operations Center is the server-side command layer that replaces the current browser-heavy architecture. It consists of:

- **Data ingestion** — CSV/JSON upload, validation, version sealing
- **Engine execution** — Job queue, pipeline computation, result persistence
- **Fixture prediction** — Round assembly (8+8), Core/Joker selection, card publication
- **Evaluation** — Outcome recording, prediction evaluation, calibration band population
- **Feedback & penalty** — Pair-level penalty accumulation, suppression management
- **AI Conductor** — Qualitative assessment of round selections (advisory only)

### 2.2 Server vs. Browser Responsibility Split

| Responsibility | Server (Supabase + Edge Functions) | Browser (UI) |
|----------------|-------------------------------------|-------------- |
| Raw match data storage & retrieval | Yes — paginated, indexed, RLS-gated | No — never loads 25,000 rows |
| H2H statistics computation | Yes — pre-computed in `winmix_h2h_stats` | No — reads pre-computed rows |
| Team season statistics | Yes — pre-computed in `winmix_team_season_stats` | No — reads ~20 rows per league |
| Round standings | Yes — pre-computed in `winmix_round_standings` | No — single SELECT per round |
| Pipeline execution (M1, ensemble, calibration) | Yes — Edge Function or worker | No — only triggers and monitors |
| Calibration metrics (Brier, log loss, ECE, skill CI) | Yes — stored in `winmix_run_statistics` | No — reads single value |
| Bootstrap confidence intervals | Yes — computed server-side | No — reads stored CI bounds |
| Core/Joker selection logic | Yes — Edge Function with audit log | No — reads published selections |
| Penalty & suppression management | Yes — `winmix_pair_penalty` table | No — reads suppression state |
| Prediction feedback recording | Yes — append-only `winmix_prediction_feedback` | No — submits result via API |
| AI Conductor assessment | Yes — Claude API call from Edge Function | No — receives qualitative verdict |
| Fixture round assembly (8+8) | Yes — validated server-side | Submits fixture list |
| Result entry (HT/FT scores) | Yes — immutable `winmix_match_outcomes` | Enters scores in UI form |
| Team weight index (0.0–10.0) | Yes — stored in `winmix_teams.weight_index` | Adjusts via UI, saved to server |
| Calibration temperature display | Yes — stored in pipeline checkpoints | Reads and displays |
| Market calibration bands | Yes — stored in `winmix_calibration_results` | Reads and renders chart |
| L4 evaluation panels (Brier, ECE, skill) | Yes — all metrics pre-computed | Reads and displays only |

### 2.3 What Stays in the Browser

The browser becomes a **thin client** with three jobs:

1. **Display** — Render pre-computed metrics, charts, tables, and prediction cards from Supabase queries
2. **Submit** — Send fixture prediction requests, match results, and team weight adjustments to Edge Functions
3. **Navigate** — Switch between the six main pages (Fixture Predictor, League Analyzer, H2H, Data Studio, Pipeline Audit, Prediction Ledger)

The L4 evaluation layer described in the Pipeline Operations Center text — Brier Score, LogLoss, ECE, Skill vs B1 baseline, reliability diagrams, calibration bands — becomes **read-only display surfaces**. The browser queries `winmix_run_statistics` and `winmix_calibration_results` and renders charts. No computation.

---

## 3. Target Database Schema — What Needs to Be Built

### 3.1 New Tables Required

Four tables from the architecture prompt are missing and must be created:

#### 3.1.1 Extend `winmix_h2h_pairs` — Enhanced Directed H2H Statistics

The existing `winmix_h2h_pairs` table has basic counts and rates (meetings, wins, draws, goals, BTTS count, Over 2.5 count, and their percentages). The architecture prompt proposes richer fields: Kish ESS, recency-weighted versions, HT→FT distributions, and odd/even goal splits. Rather than creating a parallel `winmix_h2h_stats` table, the existing `winmix_h2h_pairs` should be **extended** with additional columns via a migration:

| New Column | Type | Purpose |
|------------|------|---------|
| `kish_ess` | `numeric(8,2)` | Kish Effective Sample Size — statistical reliability |
| `over15_count` / `over15_pct` | `integer` / `numeric(6,4)` | Over 1.5 goals market |
| `over35_count` / `over35_pct` | `integer` / `numeric(6,4)` | Over 3.5 goals market |
| `odd_goals_count` / `odd_goals_pct` | `integer` / `numeric(6,4)` | Odd total goals market |
| `even_goals_count` / `even_goals_pct` | `integer` / `numeric(6,4)` | Even total goals market |
| `recent_btts_pct` | `numeric(6,4)` | Recency-weighted BTTS (exponential decay, half-life = 20) |
| `recent_over25_pct` | `numeric(6,4)` | Recency-weighted Over 2.5 |
| `recent_avg_goals` | `numeric(6,3)` | Recency-weighted average goals |
| `htft_distribution` | `jsonb` | Half-time → full-time transition distribution |

**Missing constraint (must add in migration):**

The live DDL for `winmix_h2h_pairs` does **not** include a `CHECK (home_team_id <> away_team_id)` constraint. The composite primary key `(run_id, league, home_team_id, away_team_id)` prevents duplicate rows but does not prevent `home_team_id = away_team_id` (a team playing itself). This must be added at the database level:

```sql
ALTER TABLE public.winmix_h2h_pairs
  ADD CONSTRAINT winmix_h2h_pairs_distinct_teams
  CHECK (home_team_id <> away_team_id);
```

**Observation:** Adding columns to the existing table is safer than creating a parallel `winmix_h2h_stats` table. Two tables with overlapping data will drift. The existing table already has the right primary key, constraints, and RLS policy. Extending it avoids a data migration and keeps the schema coherent.

**Observation on the DDL vs. live data distinction:** The schema dump (DDL) shows the table structure, not the actual row counts. The fact that the `winmix_h2h_pairs` table exists in the schema does not mean it has been populated — the H2H compute function has not been deployed, and the table is expected to be empty until step 5 of the implementation roadmap is completed.

#### 3.1.2 `winmix_prediction_feedback` — Immutable Prediction Snapshot + Outcome Join

This is the **most critical missing table**. Without it, the system has no memory of past failures. The penalty engine cannot function. Calibration bands stay empty.

**Refined design (v1.1):** The original v1.0 design stored `actual_result` as an updatable column within the feedback record. This creates a problem: the record is supposed to be immutable, but `actual_result` must be filled later when the match is played. This means the record is updated after creation, breaking the immutability guarantee.

The refined design splits the concern:
1. **Prediction snapshot** — `winmix_prediction_feedback` stores only what was predicted, at prediction time. It is truly immutable: write-once, never updated.
2. **Outcome join** — The actual result is read from `winmix_match_outcomes`, which is already append-only and versioned. The join is performed at query time, not stored in the feedback record.
3. **Evaluation result** — `prediction_correct` is computed at query time from the join, not stored as a generated column. This avoids the need to update the feedback record when the outcome arrives.

```sql
CREATE TABLE public.winmix_prediction_feedback (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                      uuid NOT NULL REFERENCES public.winmix_engine_runs(id),
  home_team_id                uuid NOT NULL REFERENCES public.winmix_teams(id),
  away_team_id                uuid NOT NULL REFERENCES public.winmix_teams(id),
  league                      text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  market_code                 text NOT NULL,
  predicted_pct               numeric(6,4) NOT NULL,
  predicted_yes               boolean NOT NULL,
  core_slot                   text,
  kish_ess_at_prediction      numeric(8,2),
  penalty_score_at_prediction numeric(6,2),
  match_id                    uuid REFERENCES public.winmix_matches(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  fixture_date                date
);
```

**Evaluation query (computed at read time, not stored):**

```sql
SELECT
  pf.*,
  mo.home_score,
  mo.away_score,
  mo.btts       AS actual_btts,
  mo.outcome    AS actual_outcome,
  CASE
    WHEN mo.id IS NULL THEN NULL           -- match not yet played
    WHEN pf.predicted_yes = (
      CASE pf.market_code
        WHEN 'BTTS'      THEN mo.btts
        WHEN 'OVER_25'   THEN (mo.total_goals > 2)
        WHEN 'OVER_15'   THEN (mo.total_goals > 1)
        WHEN 'OVER_35'   THEN (mo.total_goals > 3)
        WHEN 'HOME_BTTS' THEN (mo.home_score > 0)
        WHEN 'AWAY_BTTS' THEN (mo.away_score > 0)
        WHEN 'HOME_O05'  THEN (mo.home_score > 0)
        WHEN 'AWAY_O05'  THEN (mo.away_score > 0)
        WHEN 'HOME_U05'  THEN (mo.home_score = 0)
        WHEN 'AWAY_U05'  THEN (mo.away_score = 0)
        ELSE NULL
      END
    ) THEN true
    ELSE false
  END AS prediction_correct
FROM public.winmix_prediction_feedback pf
LEFT JOIN public.winmix_match_outcomes mo ON mo.match_id = pf.match_id
  AND mo.version = (
    SELECT MAX(mo2.version) FROM public.winmix_match_outcomes mo2
    WHERE mo2.match_id = pf.match_id
  );
```

**Key design decisions (v1.1):**
- **Truly immutable** — the feedback record is write-once. No `actual_result` column, no `result_recorded_at`, no `prediction_correct` generated column. Nothing is ever updated.
- **Outcome via join** — the actual result is read from `winmix_match_outcomes` at query time. If the outcome has a correction (version 2, 3, ...), the latest version is used automatically.
- **`match_id` link** — the feedback record stores `match_id` to join with `winmix_match_outcomes`. This is the only column that enables the outcome lookup.
- **Market-code-to-yes/no mapping** — the `predicted_yes` boolean is set at prediction time. The evaluation query maps `market_code` to the corresponding outcome field (see the CASE expression above). This mapping must be maintained as market codes are added.
- `core_slot` records which slot (CORE_1/2/3 or JOKER_1/2/3) the prediction occupied, enabling per-slot accuracy analysis.
- `kish_ess_at_prediction` and `penalty_score_at_prediction` snapshot the values at prediction time, so changes to ESS or penalty after the fact do not retroactively justify a bad call.

**Observation on the `predicted_yes` extraction from `markets` jsonb:** The `winmix_predictions` table stores market probabilities in a `markets` jsonb column. The structure of this jsonb is not documented in the DDL. Before the feedback table can be populated, the `winmix-core-select` Edge Function must extract `predicted_yes` and `predicted_pct` for each market code from the jsonb and write them as explicit columns in the feedback record. The extraction logic must be defined in the Edge Function, not inferred from the jsonb at query time, to ensure the snapshot is deterministic and immutable.

#### 3.1.3 `winmix_pair_penalty` — Live Penalty State

This table is the **suppression engine**. It accumulates penalty points for directed pair + market combinations that repeatedly fail.

```sql
CREATE TABLE public.winmix_pair_penalty (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id          uuid NOT NULL REFERENCES public.winmix_teams(id),
  away_team_id          uuid NOT NULL REFERENCES public.winmix_teams(id),
  league                text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  market_code           text NOT NULL,
  penalty_score         numeric(8,2) NOT NULL DEFAULT 0,
  consecutive_failures  integer NOT NULL DEFAULT 0,
  total_predictions     integer NOT NULL DEFAULT 0,
  total_correct         integer NOT NULL DEFAULT 0,
  accuracy_pct          numeric(6,4),
  is_suppressed         boolean NOT NULL DEFAULT false,
  suppressed_until      date,
  suppression_reason    text,
  last_failure_at       timestamptz,
  last_success_at       timestamptz,
  last_updated          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (home_team_id, away_team_id, market_code)
);
```

**Penalty accumulation rules:**
- **Failure:** +10–15 points (higher if `predicted_pct > 0.65`)
- **Consecutive failure multiplier:** `1.5^(failures-1)` — 1st failure = 10pts, 2nd = 15pts, 3rd = 22.5pts
- **Suppression trigger:** 3 consecutive failures OR penalty > 60
- **Suppression duration:** 14 days (cooling period)
- **Success:** -5 points, reset consecutive failures to 0

**Observation:** The penalty score range (0–100) and suppression threshold (>60) are well-calibrated. A pair that fails 3 times consecutively with high confidence accumulates ~47.5 points — not yet suppressed. But 4 consecutive failures push it to ~71 points, triggering suppression. This gives pairs a reasonable chance to recover while preventing chronically wrong pairs from polluting Core selections.

#### 3.1.4 `winmix_core_decisions` — Decision Audit Log

Every Core/Joker selection decision recorded with full reasoning trace. This enables post-hoc analysis of why each recommendation was made.

```sql
CREATE TABLE public.winmix_core_decisions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                  uuid NOT NULL REFERENCES public.winmix_engine_runs(id),
  fixture_request_id      uuid REFERENCES public.winmix_fixture_prediction_requests(id),
  home_team_id            uuid NOT NULL REFERENCES public.winmix_teams(id),
  away_team_id            uuid NOT NULL REFERENCES public.winmix_teams(id),
  league                  text NOT NULL,
  market_code             text NOT NULL,
  core_slot               text,
  decision_score          numeric(8,4),
  selected                boolean NOT NULL DEFAULT false,
  h2h_pct                 numeric(6,4),
  kish_ess                numeric(8,2),
  penalty_score           numeric(6,2),
  model_prob              numeric(6,4),
  recency_weight          numeric(6,4),
  ess_weight              numeric(6,4),
  penalty_multiplier      numeric(6,4),
  gate_quadrant_passed    boolean,
  gate_ess_passed         boolean,
  gate_stability_passed   boolean,
  gate_penalty_passed     boolean,
  gate_failed_reason      text,
  decision_trace          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);
```

**Observation:** This table is essential for debugging and improving the selection algorithm. Without it, you cannot answer "why was this pair selected over that one?" The `decision_trace` jsonb field should contain the full scoring breakdown so it can be replayed without re-running the engine.

### 3.2 RLS Policies for New Tables

All four new tables follow the deny-by-default pattern:

| Table | SELECT Policy | Write |
|-------|---------------|-------|
| `winmix_h2h_pairs` (extended) | Current run only (existing policy) | service_role only |
| `winmix_prediction_feedback` | `authenticated` only — all history | service_role only |
| `winmix_pair_penalty` | `authenticated` only — all pairs | service_role only |
| `winmix_core_decisions` | `authenticated` only — all decisions | service_role only |

**Observation:** The architecture prompt proposes `USING (true)` for feedback, penalty, and decisions policies with `TO authenticated` only. This means any logged-in user can see all feedback history and penalty state. This is appropriate for an operator-facing tool, but if the app ever has non-operator authenticated users, these policies need tightening. For now, since the app has no auth, these tables will be service-role only in practice — `authenticated` is a placeholder for future operator accounts.

---

## 4. Edge Function Architecture

### 4.1 Current State

Three Edge Functions exist on disk:

| Function | Deployed | Purpose |
|----------|----------|---------|
| `winmix-ingest` | Yes | CSV/JSON upload, idempotent upsert |
| `winmix-engine` | Yes | Job queue processing, pipeline execution |
| `winmix-fixture-request` | **No** | Fixture prediction request intake |

### 4.2 Required New Edge Functions

#### 4.2.1 `winmix-h2h-compute`

Runs after every successful engine run. Computes directed H2H statistics for all pairs in the current data version and upserts into `winmix_h2h_pairs` (extended).

**Trigger:** Post-success webhook from `winmix-engine` or cron schedule.

**Key logic:**
- Fetch all directed pairs from `winmix_matches` for the current data version
- For each pair, compute: BTTS%, Over 1.5/2.5/3.5%, odd/even goals, avg goals, Kish ESS, recency-weighted versions (exponential decay, half-life = 20 matches), HT→FT distribution
- Upsert with `onConflict: 'run_id, league, home_team_id, away_team_id'`

**Critical rule:** `home_team_id` and `away_team_id` define direction. Fulham(H)–Chelsea(A) and Chelsea(H)–Fulham(A) produce two separate rows. They are never merged.

#### 4.2.2 `winmix-core-select`

The Core selection logic. Given 16 fixtures (8 English + 8 Spanish), selects the best 3 Core + 3 Joker recommendations.

**Trigger:** Fixture prediction request submission.

**Four sequential gates:**

1. **Gate 1 — ESS minimum:** Kish ESS < 6 → automatic exclusion
2. **Gate 2 — Quadrant:** Both H2H% (≥58% for goal markets, ≥50% for 1X2) AND Confidence (≥56) must pass. Volatile entries are EXCLUDED — no exceptions.

   **Confidence scale note:** The `winmix_predictions.confidence` column is `numeric` with range `0–1`. The `Confidence ≥ 56` threshold is on a **percentage scale** (0–100). The Edge Function must multiply the stored confidence by 100 before comparing to the threshold: `confidence_pct = confidence * 100`. This normalization must be applied consistently across all gates and scoring formulas.
3. **Gate 3 — Penalty suppression:** If `winmix_pair_penalty.is_suppressed = true` → excluded
4. **Gate 4 — Recency divergence:** If `|recent_pct - historical_pct| > 0.15` AND `match_count < 30` → 0.85× penalty to final score

**Scoring formula:**

```
finalScore = h2h_pct
  × essWeight(kish_ess)        // tanh(ESS / 15), range 0..1
  × penaltyMultiplier           // 1.0 - (penalty_score / 200), floor 0.3
  × recencyAgreementBonus       // 1.0 if |recent - historical| < 0.10, else 0.85
  × modelAgreementBonus         // 1.05 if model direction agrees, else 0.95
```

**ESS weight examples:**
- ESS = 5 → tanh(5/15) = 0.32 → heavily discounted
- ESS = 15 → tanh(15/15) = 0.76 → moderate trust
- ESS = 50 → tanh(50/15) = 0.98 → near-full trust

**Ranking:** Sort descending by `finalScore`. One fixture per Core slot (no fixture appears in two slots). Top 3 = Core, next 3 = Joker.

**Observation:** The ESS weight using `tanh(ESS/15)` is well-chosen. It creates a smooth trust curve that heavily penalizes small samples without hard-cutting at an arbitrary threshold. A pair with ESS=5 and H2H%=77% gets `finalScore ≈ 0.247`, while a pair with ESS=50 and H2H%=65% gets `finalScore ≈ 0.637`. The larger sample wins. This directly fixes the ESS ranking position flaw identified in the architecture prompt.

**Observation on volatile exclusion:** The current system allows volatile quadrant entries as "secondary core" — a loophole that produced the Madrid Piros–Villarreal trace bug (C=41, below the 56 minimum). The new system correctly excludes all volatile entries from Core. This is the right call. A volatile entry by definition has insufficient confidence; allowing it as "secondary core" undermines the quality gate's purpose.

#### 4.2.3 `winmix-feedback-update`

Called when a match result is recorded in `winmix_match_outcomes`. Joins the outcome to existing `winmix_prediction_feedback` records (by `match_id`), evaluates each prediction's correctness, and updates `winmix_pair_penalty` for the affected pair + market combinations.

**Refined flow (v1.1):**

1. Match result is inserted into `winmix_match_outcomes` (append-only, versioned)
2. `winmix-feedback-update` queries `winmix_prediction_feedback` for all records where `match_id = <this match>` and `actual_result IS NULL` (not yet evaluated)
3. For each feedback record, the function computes `prediction_correct` using the market-code-to-outcome mapping (see §4.2.4)
4. The penalty table is updated based on the correctness result
5. The feedback record itself is **not modified** — it remains immutable. The evaluation result is derived at query time from the outcome join.

**Penalty accumulation:**

| Outcome | Effect |
|---------|--------|
| Success | Penalty -5 (floor 0), reset consecutive failures, re-evaluate suppression |
| Failure (predicted_pct ≤ 0.65) | +10 points × 1.5^(consecutive_failures - 1) |
| Failure (predicted_pct > 0.65) | +15 points × 1.5^(consecutive_failures - 1) |
| 3 consecutive failures | Suppress for 14 days |
| Penalty > 60 | Suppress for 14 days |

**Observation:** The exponential consecutive-failure multiplier (`1.5^(n-1)`) is aggressive but appropriate. A pair that fails 3 times in a row accumulates ~47.5 points (10 + 15 + 22.5). A 4th failure pushes it to ~71, triggering suppression. This means a "lying" pair — one that consistently underperforms its H2H% — is suppressed within 3–4 failures, typically 2–3 rounds. The Barcelona–Valencia example (BTTS% 67–68%, actual 2–0, repeated) would be suppressed after 3 such failures.

#### 4.2.4 Market-Code-to-Outcome Mapping

The `winmix_predictions.markets` jsonb field stores per-market probabilities. The `winmix_prediction_feedback` table extracts `predicted_yes` and `predicted_pct` for each market code at prediction time. The evaluation query maps each market code to the corresponding boolean outcome field in `winmix_match_outcomes`:

| Market Code | `predicted_yes = true` means... | Outcome Field | Evaluation |
|-------------|----------------------------------|---------------|------------|
| `BTTS` | Both teams will score | `mo.btts` | `predicted_yes = mo.btts` |
| `OVER_25` | Total goals > 2 | `mo.total_goals > 2` | `predicted_yes = (mo.total_goals > 2)` |
| `OVER_15` | Total goals > 1 | `mo.total_goals > 1` | `predicted_yes = (mo.total_goals > 1)` |
| `OVER_35` | Total goals > 3 | `mo.total_goals > 3` | `predicted_yes = (mo.total_goals > 3)` |
| `HOME_BTTS` | Home team will score | `mo.home_score > 0` | `predicted_yes = (mo.home_score > 0)` |
| `AWAY_BTTS` | Away team will score | `mo.away_score > 0` | `predicted_yes = (mo.away_score > 0)` |
| `HOME_O05` | Home team scores ≥ 1 | `mo.home_score > 0` | `predicted_yes = (mo.home_score > 0)` |
| `AWAY_O05` | Away team scores ≥ 1 | `mo.away_score > 0` | `predicted_yes = (mo.away_score > 0)` |
| `HOME_U05` | Home team scores 0 | `mo.home_score = 0` | `predicted_yes = (mo.home_score = 0)` |
| `AWAY_U05` | Away team scores 0 | `mo.away_score = 0` | `predicted_yes = (mo.away_score = 0)` |
| `ODD_GOALS` | Total goals is odd | `mo.total_goals % 2 = 1` | `predicted_yes = (mo.total_goals % 2 = 1)` |
| `EVEN_GOALS` | Total goals is even | `mo.total_goals % 2 = 0` | `predicted_yes = (mo.total_goals % 2 = 0)` |

**Observation:** This mapping must be maintained as a single source of truth, shared between the `winmix-core-select` function (which writes `predicted_yes` into feedback) and the `winmix-feedback-update` function (which evaluates correctness). If the mapping drifts between the two functions, the penalty engine will produce incorrect results. The mapping should be defined in a shared `_shared/market-mapping.ts` module imported by both Edge Functions.

---

## 5. The AI Conductor Layer

### 5.1 Concept

The AI Conductor is a Claude API call that receives a structured summary of the current round's Core decisions and returns a qualitative assessment. It does not override the mathematical selection — it reads the output and signals whether the "music sounds good or bad."

### 5.2 Input

```json
{
  "round": "2026-09-24",
  "core_selections": [...],
  "suppressed_pairs": [...],
  "system_health": {
    "total_predictions_last_30_days": 48,
    "accuracy_last_30_days": 0.54,
    "avg_penalty_score_active_pairs": 12.4,
    "suppressed_pairs_count": 3
  }
}
```

### 5.3 Output

A brief qualitative verdict: `GOOD` / `CAUTION` / `POOR` with a 2–3 sentence explanation. The Conductor also flags arbitrage contradictions (e.g., BTTS=NO and Over 2.5=YES on the same fixture).

**Observation:** The Conductor is advisory only — it never overrides the mathematical selection. This is the correct design. An LLM should not be in the decision path for a statistical system. Its value is in catching contradictions and systemic degradation that the math cannot self-assess. The current `aiConductor.ts` in the codebase is not an LLM call — it is a deterministic BTTS drift monitor with Hungarian-language explanation generation. The real Conductor would replace this with a Claude API call from the Edge Function, keeping the LLM server-side where API keys are safe.

**Recommendation:** Do not build the Conductor until steps 1–8 of the implementation order are complete. The Conductor needs real data (selections, suppressed pairs, system health) to produce useful assessments. With empty feedback tables, it would have nothing to evaluate.

---

## 6. The L4 Evaluation Layer — What Belongs Where

The Pipeline Operations Center text describes an L4 evaluation and calibration layer with these components:

| Component | Currently | Should Be |
|-----------|-----------|-----------|
| 100-match rolling Brier Score | Computed in browser from 25k rows | Read from `winmix_run_statistics` (single value) |
| LogLoss (ensemble vs B1) | Computed in browser | Read from `winmix_run_statistics` |
| Skill vs B1 baseline | Bootstrap CI in browser (1000×N, main thread) | Read from `winmix_run_statistics.skill_ci_low/high` |
| ECE (calibration error) | Computed in browser | Read from `winmix_run_statistics.ece` |
| Active calibration temperature | Read from pipeline checkpoint | Read from `winmix_pipeline_checkpoints.calibration_t` (already correct) |
| Empirical calibration band table (1X2) | Computed in browser | Read from `winmix_calibration_results` (per league/market) |
| Market-specific calibration (out-of-sample) | Computed in browser | Read from `winmix_calibration_results` (per league/market) |
| Reliability diagram (5 bands) | Computed in browser | Read from `winmix_calibration_results.metrics` jsonb |
| Outcome distribution (H/D/A) | Computed in browser | Read from `winmix_run_statistics.metrics` jsonb |
| Market feedback (closed loop) | Computed in browser from ledger | Read from `winmix_prediction_feedback` + `winmix_pair_penalty` |
| M1 coefficients | Computed in browser | Read from `winmix_pipeline_checkpoints.m1_fit` jsonb |
| Ensemble weight (M1) | Computed in browser | Read from `winmix_pipeline_checkpoints.ensemble_w_m1` |
| Decision matrix (Actionable/Volatile/Flat/Reject) | Computed in browser | Read from `winmix_core_decisions` (per fixture) |
| Prequential calibration history (T refits) | Computed in browser | Read from `winmix_pipeline_checkpoints.fit_history` jsonb |

**The principle is simple:** the L4 layer is a **measurement surface only**. The text itself says: "Ez a lap kizárólag mérési felület — az újraszámítás, a teljes újraépítés és a beállítások a Pipeline Üzemeltetés képernyőn érhetők el." (This page is purely a measurement surface — recalculation, full rebuild, and settings are available on the Pipeline Operations screen.)

This means:
- The L4 page **reads** metrics from Supabase tables
- The Pipeline Operations page **triggers** recalculation via Edge Functions
- The browser **never** computes Brier, log loss, ECE, skill CI, or calibration bands

---

## 7. The Forduló Prediktor (Fixture Predictor) — Top 3+3 Flow

### 7.1 Current Flow (Browser-Heavy)

1. User assembles 8 English + 8 Spanish fixtures in the browser
2. Browser loads 25,000 matches into memory
3. Browser mines patterns from the cumulative H2H database (client-side)
4. Browser assigns 6 slots: 3 Core + 3 Joker
5. Core strategy: one-click, defaults to profile-safe BTTS
6. Market selection per card on advanced panel
7. Results entered in Tipp Napló (Prediction Ledger)

### 7.2 Target Flow (Server-Driven)

1. User assembles 8+8 fixtures in the browser → submits to `winmix-fixture-request` Edge Function
2. Edge Function validates fixtures, creates idempotent request, queues for processing
3. `winmix-core-select` Edge Function runs the four-gate selection:
   - Reads pre-computed H2H stats from `winmix_h2h_pairs` (extended with Kish ESS)
   - Reads penalty state from `winmix_pair_penalty`
   - Reads model predictions from `winmix_predictions`
   - Applies gates, computes finalScore, ranks candidates
   - Writes all decisions to `winmix_core_decisions`
   - Writes selected slots to `winmix_fixture_prediction_selections`
4. Request status transitions: `queued → running → sealed → ready → published`
5. Browser reads published cards and selections (RLS: `status = 'published'` only)
6. User enters results in Tipp Napló → submitted to `winmix-feedback-update` Edge Function
7. Feedback updates penalty scores → affects next round's Core selection

### 7.3 What Remains Browser-Side

- **Fixture assembly UI** — selecting which 8+8 matches to include
- **Core strategy selector** — one-click BTTS profile (sends strategy to server, server applies gates)
- **Market pool editor** — per-card market selection (advanced panel)
- **Slip display** — rendering the 3+3 slots from published selection data
- **Result entry form** — HT/FT scores (submitted to server, not computed locally)
- **Prediction Ledger** — rendering closed slips and their evaluation status

---

## 8. Implementation Roadmap

### 8.1 Priority Order

| Step | Task | Dependency | Priority |
|------|------|------------|----------|
| 1 | Extend `winmix_h2h_pairs` with Kish ESS, recency, HT→FT columns | None | CRITICAL |
| 2 | Create `winmix_prediction_feedback` table | None | CRITICAL |
| 3 | Create `winmix_pair_penalty` table | None | CRITICAL |
| 4 | Create `winmix_core_decisions` table | None | CRITICAL |
| 5 | Deploy `winmix-h2h-compute` Edge Function | Step 1 | CRITICAL |
| 6 | Backfill H2H stats for existing data | Step 5 | CRITICAL |
| 7 | Deploy `winmix-core-select` Edge Function | Steps 1–4 | CRITICAL |
| 8 | Deploy `winmix-feedback-update` Edge Function | Steps 2–3 | HIGH |
| 9 | Deploy `winmix-fixture-request` Edge Function | Step 7 | HIGH |
| 10 | Build result entry UI (manual feedback input) | Step 8 | HIGH |
| 11 | Backfill historical feedback if available | Step 8 | MEDIUM |
| 12 | Integrate AI Conductor API call | Step 7 | MEDIUM |
| 13 | Migrate L4 evaluation panels to read from Supabase | Steps 5–8 | MEDIUM |
| 14 | Remove client-side 25k match loading | Step 13 | LOW |

### 8.2 Migration Strategy

All schema changes should be applied via `apply_migration` MCP tool (not raw SQL execution). The migration files should be placed in `supabase/migrations/` following the existing naming convention: `YYYYMMDDHHMMSS_description.sql`.

**Suggested migration files:**
1. `20260925100000_winmix_h2h_stats_enhanced.sql` — extend `winmix_h2h_pairs`
2. `20260925100100_winmix_feedback_and_penalty.sql` — create feedback + penalty tables
3. `20260925100200_winmix_core_decisions.sql` — create decisions audit log

Each migration must:
- Enable RLS on every new table
- Write 4 separate policies (SELECT/INSERT/UPDATE/DELETE) — never `FOR ALL`
- Revoke dangerous privileges (TRUNCATE, TRIGGER, REFERENCES) from anon/authenticated
- Include `NOTIFY pgrst, 'reload schema'` at the end

---

## 9. Observations and Recommendations

### 9.1 Architecture Observations

**Observation 1 — The feedback loop is the highest-impact missing piece.** Without `winmix_prediction_feedback` and `winmix_pair_penalty`, the system cannot learn from its mistakes. The Barcelona–Valencia example (BTTS% 67–68%, actual 2–0, repeated) would be caught by the penalty engine within 3 failures. Today, the system has no mechanism to remember this. Every calibration band shows n=0/20 because no feedback has ever been recorded. This is not a nice-to-have — it is the difference between a system that improves and one that doesn't.

**Observation 2 — The existing `winmix_h2h_pairs` table should be extended, not duplicated.** The architecture prompt proposes a separate `winmix_h2h_stats` table with richer columns. But the existing table already has the right structure (directed pairs, counts, rates), constraints, and RLS. Creating a parallel table would mean two sources of truth for H2H data, which will inevitably drift. The right approach is a single `ALTER TABLE` migration adding the missing columns.

**Observation 3 — The `winmix_pipeline_checkpoints` table needs to become run-scoped.** Today its PK is `league`, meaning there is one checkpoint per league with no history. The `m1_fit`, `calib_history`, and `fit_history` jsonb fields are overwritten on every pipeline run. This means the prequential calibration history (T refit sequence) is lost each time. The architecture prompt's reproducibility model relies on the `source_run_id + data_version_id + parameter_snapshot_id` triple in fixture prediction requests, which is correct — but the checkpoints table itself should eventually be extended with a `run_id` column to store per-run state.

**Observation 4 — The ESS weight formula is well-designed but needs calibration data.** The `tanh(ESS/15)` formula is sound, but it only matters when Kish ESS is actually computed and stored. Today, `winmix_h2h_pairs` has no ESS column. Until step 1 (extending the table) and step 5 (deploying the compute function) are done, the ESS gate and ESS weight cannot function.

**Observation 5 — The volatile exclusion fix is correct and overdue.** The current system allows volatile entries (H2H% passes but Confidence fails) as "secondary core." This is a loophole that produced the Madrid Piros–Villarreal bug (C=41, below the 56 minimum). The new system's hard exclusion of volatile entries from Core is the right design. A volatile entry has insufficient confidence by definition — allowing it undermines the gate's purpose.

### 9.2 Security Observations

**Observation 6 — The SECURITY DEFINER functions need explicit EXECUTE revocation.** The `winmix_claim_next_engine_job`, `winmix_promote_engine_run`, `winmix_validate_data_version`, and `winmix_requeue_expired_engine_jobs` functions are `SECURITY DEFINER` (they run with elevated privileges). The migration only revoked EXECUTE from `public` but not explicitly from `anon` and `authenticated`. Since Postgres grants EXECUTE to PUBLIC by default, anyone with the anon key could call these functions. This is documented in the security fixes doc (section 6) and must be applied.

**Observation 7 — The `winmix_teams` table has `USING (true)` which is acceptable.** Teams are not version-bound and are public reference data (team names, leagues). The `USING (true)` policy is intentional here — all teams should be visible. This is the one case where `USING (true)` is correct.

**Observation 8 — The `winmix_match_outcomes` table has `USING (true)` which is acceptable.** Match results (scores, BTTS, outcome) are public information — they are the actual results of played matches. There is no sensitivity in sharing them. The append-only trigger ensures they cannot be tampered with.

**Observation 8b — The append-only nature of `winmix_match_outcomes` must be verified at the trigger level, not assumed from the schema.** The DDL shows the table structure (columns, constraints, primary key) but does not show the trigger definitions. The `winmix_prevent_outcome_mutation()` function and its `BEFORE UPDATE` / `BEFORE DELETE` triggers are defined in the migration SQL file (`WINMIX_V2_SQL_MIGRATIONS.md`, section 2) but their presence in the live database must be confirmed by querying `pg_trigger`. The `version` column and `UNIQUE(match_id, version)` constraint allow correction rows (new version, `source = 'correction'`) without modifying the original — this is the correct append-only correction model.

### 9.3 Performance Recommendations

**Recommendation 1 — Move bootstrap CI to the server immediately.** The `bootstrapSkillCI` function runs 1000 × N resamples synchronously on the main thread. With 25,000 matches, that is ~25 million operations blocking the UI. The result is a single pair of numbers (skill_ci_low, skill_ci_high) that should be stored in `winmix_run_statistics`. This is the easiest win: one Edge Function call, one table read.

**Recommendation 2 — Pre-compute position history in `winmix_round_standings`.** The `computePositionHistory` function is O(N²) — for every round, it re-filters all matches and recomputes standings. With 25,000 matches and ~100 rounds per season, this is the dominant performance bottleneck. The `winmix_round_standings` table already exists but is empty. Populating it during the pipeline run eliminates this computation entirely.

**Recommendation 3 — Replace client-side prequential refits with stored results.** The `refitM1`, `refitTemperature`, and `refitEnsemble` functions run O(N²/K) iterations over the full dataset. The temperature grid search alone is 23 × 25,000 = 575,000 operations per refit, with ~500 refits per season. The results (calibration_t, ensemble_w_m1, fit_history) should be computed once on the server and stored in `winmix_pipeline_checkpoints`. The browser reads a single row.

**Recommendation 4 — Implement paginated match lists.** The `MatchesPanel` currently holds all matches in memory. With server-side pagination (`range(offset, offset + pageSize - 1)`), the browser loads 50–100 matches at a time. This is a straightforward change that dramatically reduces memory usage.

### 9.4 Process Recommendations

**Recommendation 5 — Do not build the AI Conductor until the feedback loop is live.** The Conductor needs real data (selections, suppressed pairs, system health metrics) to produce useful assessments. With empty feedback and penalty tables, it would be evaluating nothing. Build steps 1–8 first, accumulate 2–3 rounds of feedback, then activate the Conductor.

**Recommendation 6 — Backfill historical feedback from the Tipp Napló.** If the Prediction Ledger has historical slip records with results, these should be imported into `winmix_prediction_feedback` as step 11. This gives the penalty engine immediate data to work with, rather than starting from zero. The backfill should record `source = 'import'` and `result_recorded_by = 'backfill'` to distinguish from live feedback.

**Recommendation 7 — The L4 evaluation page should be the first browser-side migration target.** It is purely a read surface — no computation, no submission. Migrating it to read from `winmix_run_statistics` and `winmix_calibration_results` is low-risk and immediately demonstrates the value of server-side pre-computation. It also validates the RLS policies on these tables before the more complex fixture prediction flow depends on them.

**Recommendation 8 — Keep the offline-first fallback.** The current architecture has an IndexedDB pipeline cache that enables instant restore on reload. This is a valuable resilience feature. Even after migrating to server-side computation, the browser should cache the latest pre-computed results locally. If Supabase is unreachable, the UI can render from cache with a "data may be stale" indicator. The Cloud Tier State Machine (Unconfigured → Probing → Online → Degraded) already models this correctly.

---

## 10. Hard Rules — Never Violate

1. **NEVER** mix Fulham→Chelsea with Chelsea→Fulham in any statistic. Always filter by `(home_team_id, away_team_id)` separately. Direction is sacred.

2. **NEVER** allow a volatile quadrant entry into Core. Both H2H% and Confidence must exceed their thresholds. No exceptions, no "secondary core" loophole.

3. **NEVER** let the browser compute H2H statistics. It reads pre-computed rows from `winmix_h2h_pairs` only.

4. **NEVER** use ESS < 6 as a Core recommendation. Small samples produce noise, not signal.

5. **NEVER** ignore consecutive failures. After 3 failures on the same pair+market, suppress for minimum 14 days.

6. **NEVER** trust a high H2H% alone. `finalScore = H2H% × ESS_weight × penalty_multiplier`. All three factors matter.

7. **NEVER** let the browser compute Brier Score, log loss, ECE, or bootstrap skill CI. These are pre-computed server-side and stored in `winmix_run_statistics`.

8. **NEVER** allow UPDATE or DELETE on `winmix_match_outcomes`. Results are append-only. Corrections are new rows with `source = 'correction'` and an incremented `version`. The original row is never modified.

8a. **NEVER** update a `winmix_prediction_feedback` record after creation. The prediction snapshot is write-once. The actual result is derived at query time from the `winmix_match_outcomes` join — it is not stored in the feedback record.

9. **NEVER** expose the service-role key to the browser. All privileged operations go through Edge Functions that read the key from their own Deno environment.

10. **NEVER** let the AI Conductor override the mathematical selection. It advises only — `GOOD` / `CAUTION` / `POOR` with explanation.

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **Directed pair** | A match where team A is home and team B is away. Fulham(H)–Chelsea(A) is a different directed pair from Chelsea(H)–Fulham(A). |
| **Kish ESS** | Effective Sample Size. Measures statistical reliability. ESS < 6 = insufficient. ESS > 30 = reliable. Weighted by `tanh(ESS/15)`. |
| **BTTS** | Both Teams To Score. Market: will both teams score at least one goal? |
| **Penalty score** | Accumulated deduction for a pair+market based on prediction failures. Range 0–100. Above 60 = suppressed. |
| **Suppression** | A pair+market is excluded from Core selection for a cooling period (default 14 days). |
| **Quadrant** | Two-axis quality gate: H2H% (signal strength) vs Confidence (statistical reliability). Both must pass. |
| **Volatile** | Quadrant state: H2H% passes but Confidence fails. In the new system, volatile entries are EXCLUDED from Core. |
| **Conductor** | AI layer (Claude API) that evaluates the holistic quality of a round's Core selections. Advisory only. |
| **Arbitrage** | Conflicting market signals on the same fixture (e.g., BTTS=NO and Over2.5=YES simultaneously). |
| **Recency weight** | Exponential decay weighting recent matches more heavily. Half-life = 20 matches. |
| **Prequential** | Online learning approach where each prediction is evaluated before the next observation is seen. |
| **L4 layer** | The evaluation and calibration measurement surface — Brier, log loss, ECE, skill CI, reliability diagrams. Read-only display. |
| **Core slot** | One of 3 high-confidence recommendation slots (CORE_1, CORE_2, CORE_3). Must pass all four gates. |
| **Joker slot** | One of 3 secondary recommendation slots (JOKER_1, JOKER_2, JOKER_3). Lower confidence, higher risk. |
| **Profile-safe BTTS** | Default Core strategy: only pairs with stable two-sided goal profiles that pass the strict gate. Leaves the card empty if no such pair exists. |
| **Market-code mapping** | The deterministic mapping from a market code (e.g., `BTTS`, `OVER_25`) to the corresponding boolean outcome field in `winmix_match_outcomes`. Defined in a shared module to prevent drift between selection and evaluation functions. |
| **Confidence scale** | The `winmix_predictions.confidence` column stores values in the 0–1 range. The `Confidence ≥ 56` gate threshold is on a percentage scale (0–100). The Edge Function must multiply by 100 before comparing. |

---

*WinMix Pipeline Operations Center — Premium Engineering Blueprint — v1.1 — September 25, 2026*
