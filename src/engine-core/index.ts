/**
 * Canonical WinMix computation boundary.
 *
 * Browser workers and the Supabase Edge Function consume this one entry point.
 * Do not add React, storage, network or Worker APIs below this boundary.
 */
export { computeLeaguePipeline } from '../utils/pipeline';
// Future-fixture inference uses the same H2H, forecast and pattern path as
// the historical pipeline. Export it here so server workers never re-create
// a second, browser-only prediction implementation.
export { analyzeFixture, buildLeagueContext } from '../utils/roundAnalysis';
export { buildSlipDraft } from '../utils/slip';
export { FEATURE_SCHEMA_VERSION, PIPELINE_CONTRACT_VERSION } from '../utils/constants';
export { FORECAST_MODEL_VERSION } from '../utils/forecastCore';
export type { PipelineParams, PipelineResult } from '../utils/pipeline';
export type {
  CalibrationState,
  ExperimentSettings,
  HistoryScope,
  League,
  MatchPipeline,
  MatchRow,
  Season
} from '../types/winmix';
