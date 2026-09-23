import { z } from 'zod';
import { readCloudEnv } from './cloudConfig';
import { FEATURE_SCHEMA_VERSION, PIPELINE_CONTRACT_VERSION } from './constants';
import { FORECAST_MODEL_VERSION } from './forecastCore';
import { emptyAliases, emptyCalibration, emptyCounters, emptyWeights } from './storage';
import type { CalibrationState, MatchPipeline, Season } from '../types/winmix';

/** Legacy imports/recomputation require an explicit diagnostic build. */
export const PUBLISHED_RUN_MODE = import.meta.env.VITE_WINMIX_DATA_MODE !== 'local';

const finite = z.number().finite();
const count = finite.int().nonnegative();
const probability = finite.min(0).max(1);
const league = z.enum(['angol', 'spanyol']);
const probs = z.object({ home: probability, draw: probability, away: probability })
  .refine(p => Math.abs(p.home + p.draw + p.away - 1) < 0.00001, 'Invalid probability sum');
const coverage = z.object({ seasons: count, matches: count });
const parameters = z.object({
  historyScope: z.enum(['season-only', 'league-cumulative']),
  experiments: z.object({ dixonColes: z.boolean(), glicko2: z.boolean() }),
});
const calibration = z.object({
  T: finite.positive(), history: z.array(z.object({ fittedAtMatchIndex: count, T: finite.positive(), ece: finite, sampleSize: count }).passthrough()),
  ece: finite.nullable(), lastComputedAt: z.string().nullable(),
}).passthrough();
export const PublishedManifestSchema = z.object({
  run_id: z.string().uuid(), data_version_id: z.string().uuid(), version_key: z.string(),
  content_fingerprint: z.string().min(1), computed_at: z.string(),
  match_count: count.positive(), season_count: count.positive(),
  league_coverage: z.object({ angol: coverage, spanyol: coverage }),
  result_summary: z.object({
    modelVersion: z.literal(FORECAST_MODEL_VERSION),
    featureSchemaVersion: z.literal(FEATURE_SCHEMA_VERSION),
    pipelineContractVersion: z.literal(PIPELINE_CONTRACT_VERSION),
    predictions: count, featureRows: count, sourceMatches: count,
    inputFingerprint: z.string().min(1), parameters,
    calibration: z.object({
      angol: z.object({ state: calibration }), spanyol: z.object({ state: calibration }),
    }),
  }),
});
export type PublishedManifest = z.infer<typeof PublishedManifestSchema>;

const team = z.object({ id: z.string(), canonical_key: z.string(), display_name: z.string().min(1) });
const sourceSchema = z.object({
  id: z.string(), data_version_id: z.string(), season_id: z.string(), league,
  match_no: count.positive(), row_index: count.nullable(), source_file_id: z.string().nullable(),
  kickoff_iso: z.string().nullable(), match_date_raw: z.string().nullable(),
  home_score: count, away_score: count, ht_home_score: count.nullable(), ht_away_score: count.nullable(),
  home: team, away: team,
  season: z.object({
    id: z.string(), league, season_index: count, name: z.string(), file_name: z.string(),
    created_at: z.string(), content_hash: z.string().nullable(), match_count: count,
    order_mode: z.enum(['chronological', 'source-order']),
  }),
}).refine(r => r.ht_home_score === null || r.ht_home_score <= r.home_score)
  .refine(r => r.ht_away_score === null || r.ht_away_score <= r.away_score);
const featureSchema = z.object({
  match_id: z.string(), run_id: z.string(), sequence_no: count.positive(),
  feature_schema_version: z.literal(FEATURE_SCHEMA_VERSION),
  features: z.object(Object.fromEntries([
    'home_weight_index', 'away_weight_index', 'weight_diff', 'home_att_home', 'home_def_home',
    'away_att_away', 'away_def_away', 'league_home_gpm', 'league_away_gpm', 'home_form_5', 'away_form_5',
    'home_gd_form_5', 'away_gd_form_5', 'h2h_home_ppg', 'htGoalRate5', 'htLeadConversionHome',
    'htLeadConversionAway', 'secondHalfGoalRatio', 'prevMatchTotalGoalsHome', 'prevMatchTotalGoalsAway',
  ].map(key => [key, finite]))).strict(),
});
const pipelineSchema = z.object({
  b0: probs, b1: probs, m1: probs, ensRaw: probs, calibrated: probs,
  calibratedT: finite.positive(), lambdas: z.object({ home: finite.nonnegative(), away: finite.nonnegative() }),
  context: z.object({ homePlayed: count, awayPlayed: count, dataSufficiency: z.enum(['hot', 'warm', 'cold']) }),
  m1Source: z.enum(['fitted', 'manual']), ensembleWM1: probability, priorDivergence: finite,
  reconciliation: z.object({ brierB1: finite, brierEns: finite, logLossB1: finite, logLossEns: finite, isCorrect: z.boolean() }),
}).passthrough();
const predictionSchema = z.object({
  match_id: z.string(), run_id: z.string(), outcome_home: probability, outcome_draw: probability,
  outcome_away: probability, lambda_home: finite.nonnegative(), lambda_away: finite.nonnegative(), confidence: finite,
  recommendation: z.object({
    code: z.enum(['HOME_WIN', 'DRAW', 'AWAY_WIN', 'NO_CLEAR_EDGE']),
    decision: z.enum(['actionable', 'volatile', 'flat', 'ignore']), caveat: z.string().nullable(),
    confidenceLabel: z.enum(['High', 'Good', 'Moderate', 'Low']),
  }),
  markets: z.object({ over25: probability, btts: probability, mostLikelyScore: z.string() }).passthrough(),
  model_output: pipelineSchema,
});
const teamStateSchema = z.object({
  run_id: z.string(), league,
  state: z.object({ canonicalKey: z.string(), displayName: z.string(), weight: finite }),
});

const SOURCE_SELECT = 'id,data_version_id,season_id,league,match_no,row_index,source_file_id,kickoff_iso,match_date_raw,home_score,away_score,ht_home_score,ht_away_score,home:winmix_teams!winmix_matches_home_team_id_fkey(id,canonical_key,display_name),away:winmix_teams!winmix_matches_away_team_id_fkey(id,canonical_key,display_name),season:winmix_seasons!winmix_matches_season_id_fkey(id,league,season_index,name,file_name,created_at,content_hash,match_count,order_mode)';

/** Read only. Every page is pinned to one immutable run/data version. */
export async function loadPublishedRun(signal?: AbortSignal) {
  const config = readCloudEnv();
  if (!config) throw new Error('A központi adatkapcsolat nincs beállítva.');
  async function read(path: string): Promise<unknown[]> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, 30_000);
    try {
      const headers: Record<string, string> = { apikey: config!.anonKey };
      if (!config!.anonKey.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${config!.anonKey}`;
      const response = await fetch(`${config!.url}/rest/v1/${path}`, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`A központi eredmény betöltése sikertelen (HTTP ${response.status}).`);
      return z.array(z.unknown()).parse(await response.json());
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  async function all(path: string, expected?: number) {
    const rows: unknown[] = [];
    for (;;) {
      const page = await read(`${path}&limit=1000&offset=${rows.length}`);
      rows.push(...page);
      if (page.length === 0 || (expected !== undefined && rows.length >= expected)) break;
    }
    if (expected !== undefined && rows.length !== expected) throw new Error('Hiányos szervereredmény; a korábbi állapot marad érvényben.');
    return rows;
  }
  const status = await read('winmix_current_engine_status?select=*&limit=2');
  if (status.length === 0) return null;
  if (status.length !== 1) throw new Error('Több aktuális motorfutás található.');
  const manifest = PublishedManifestSchema.parse(status[0]);
  const { run_id: runId, data_version_id: versionId, match_count: total } = manifest;
  const summary = manifest.result_summary;
  if ([summary.predictions, summary.featureRows, summary.sourceMatches].some(n => n !== total)) {
    throw new Error('A publikált futás lefedettsége hibás.');
  }
  const [rawMatches, rawPredictions, rawFeatures, rawTeams] = await Promise.all([
    all(`winmix_matches?select=${SOURCE_SELECT}&data_version_id=eq.${versionId}&order=season_id,match_no`, total),
    all(`winmix_predictions?select=*&run_id=eq.${runId}&order=match_id`, total),
    all(`winmix_match_features?select=*&run_id=eq.${runId}&order=sequence_no`, total),
    all(`winmix_team_state_snapshots?select=run_id,league,state&run_id=eq.${runId}&order=team_id`),
  ]);
  const predictions = new Map(z.array(predictionSchema).parse(rawPredictions).map(p => [p.match_id, p]));
  const features = new Map(z.array(featureSchema).parse(rawFeatures).map(f => [f.match_id, f]));
  if (predictions.size !== total || features.size !== total) throw new Error('Ismétlődő eredménysorok.');
  const seasons = new Map<string, Season>();
  const aliases = emptyAliases(), weights = emptyWeights(), counters = emptyCounters();
  const seen = new Set<string>(), sequences = new Set<number>();
  for (const row of z.array(sourceSchema).parse(rawMatches)) {
    const p = predictions.get(row.id), f = features.get(row.id), s = row.season;
    if (seen.has(row.id) || row.data_version_id !== versionId || !p || !f || p.run_id !== runId || f.run_id !== runId || s.id !== row.season_id || s.league !== row.league) {
      throw new Error('Eltérő verzióhoz tartozó vagy hiányos mérkőzésadat.');
    }
    if (sequences.has(f.sequence_no) || f.sequence_no > total) throw new Error('Hibás eredménysorrend.');
    seen.add(row.id); sequences.add(f.sequence_no);
    if (Math.abs(p.outcome_home - p.model_output.calibrated.home) > 1e-9 || Math.abs(p.outcome_draw - p.model_output.calibrated.draw) > 1e-9 || Math.abs(p.outcome_away - p.model_output.calibrated.away) > 1e-9 || p.lambda_home !== p.model_output.lambdas.home || p.lambda_away !== p.model_output.lambdas.away) {
      throw new Error('A predikció tárolt értékei eltérnek a modell eredményétől.');
    }
    if (!seasons.has(s.id)) seasons.set(s.id, {
      id: s.id, league: s.league, seasonIndex: s.season_index, name: s.name, fileName: s.file_name,
      createdAt: s.created_at, contentHash: s.content_hash, countWarning: s.match_count !== 240,
      actualMatchCount: s.match_count, orderMode: s.order_mode, datedMatchCount: 0, matches: [],
    });
    const season = seasons.get(s.id)!;
    if (season.matches.some(m => m.match_no === row.match_no)) throw new Error('Ismétlődő mérkőzéssorszám.');
    const pipeline = {
      ...p.model_output, features: f.features, secondary: p.markets, confidence: p.confidence,
      recommendation: p.recommendation.code, decision: p.recommendation.decision,
      caveat: p.recommendation.caveat, confidenceLabel: p.recommendation.confidenceLabel,
    } as unknown as MatchPipeline;
    season.matches.push({
      match_no: row.match_no, date: row.match_date_raw ?? '', kickoffIso: row.kickoff_iso,
      rowIndex: row.row_index ?? undefined, sourceFileId: row.source_file_id,
      home_team: row.home.display_name, away_team: row.away.display_name,
      ht_home_score: row.ht_home_score, ht_away_score: row.ht_away_score,
      home_score: row.home_score, away_score: row.away_score, total_goals: row.home_score + row.away_score,
      btts: row.home_score > 0 && row.away_score > 0,
      outcome: row.home_score > row.away_score ? 'H' : row.home_score < row.away_score ? 'A' : 'D', pipeline,
    });
    if (row.kickoff_iso) season.datedMatchCount! += 1;
    aliases[row.league][row.home.canonical_key] = row.home.display_name;
    aliases[row.league][row.away.canonical_key] = row.away.display_name;
    counters[row.league] = Math.max(counters[row.league], s.season_index);
  }
  for (const t of z.array(teamStateSchema).parse(rawTeams)) {
    if (t.run_id !== runId || weights[t.league][t.state.canonicalKey] !== undefined) throw new Error('Hibás csapatállapot.');
    weights[t.league][t.state.canonicalKey] = t.state.weight;
  }
  const result = [...seasons.values()].sort((a, b) => a.league.localeCompare(b.league) || a.seasonIndex - b.seasonIndex);
  if (result.length !== manifest.season_count || result.some(s => s.matches.length !== s.actualMatchCount)) throw new Error('Hiányos szezonadatok.');
  for (const l of ['angol', 'spanyol'] as const) {
    const subset = result.filter(s => s.league === l), expected = manifest.league_coverage[l];
    if (subset.length !== expected.seasons || subset.reduce((n, s) => n + s.matches.length, 0) !== expected.matches || Object.keys(aliases[l]).some(k => weights[l][k] === undefined)) throw new Error(`Hiányos ${l} ligaeredmény.`);
  }
  // A promotion during pagination can hide old rows through RLS. Never commit a mixed run.
  const latest = await read('winmix_current_engine_status?select=run_id&limit=2');
  if (latest.length !== 1 || (latest[0] as { run_id?: string }).run_id !== runId) throw new Error('Új eredmény jelent meg betöltés közben. Frissítsd az adatokat.');
  const calibrationMap = emptyCalibration();
  for (const l of ['angol', 'spanyol'] as const) calibrationMap[l] = summary.calibration[l].state as CalibrationState;
  return { manifest, seasons: result, teamWeights: weights, teamAliasMap: aliases, seasonCounters: counters, calibration: calibrationMap, parameters: summary.parameters };
}
