import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { computeLeaguePipeline } from '../utils/pipeline';
import { FEATURE_SCHEMA_VERSION, PIPELINE_CONTRACT_VERSION } from '../utils/constants';
import { FORECAST_MODEL_VERSION } from '../utils/forecastCore';
import { canon } from '../utils/teams';
import { loadPublishedRun } from '../utils/publishedRun';
import { computeLeagueBenchmark } from '../utils/leagueStats';
import { ingestSeasonsToCloud } from '../utils/supabaseTier';
import type { Season } from '../types/winmix';

vi.mock('../utils/cloudConfig', () => ({ readCloudEnv: () => ({ url: 'https://winmix.test', anonKey: 'sb_publishable_test' }) }));
const runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const versionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const leagues = ['angol', 'spanyol'] as const;
const seasons: Season[] = leagues.map((league, i) => ({
  id: `season-${league}`, league, seasonIndex: 1, name: league, fileName: league + '.csv',
  createdAt: '2026-01-01', contentHash: 'fixture-' + league, countWarning: true, actualMatchCount: 2,
  orderMode: 'chronological', matches: [1, 2].map(n => ({
    match_no: n, date: `2026-01-0${n}`, kickoffIso: `2026-01-0${n}T12:00:00Z`,
    home_team: i === 0 ? 'Arsenal' : 'Barcelona', away_team: i === 0 ? 'Chelsea' : 'Real Madrid',
    ht_home_score: 1, ht_away_score: 0, home_score: n, away_score: 1,
    total_goals: n + 1, btts: true, outcome: n === 1 ? 'D' : 'H',
  })),
}));
let tables: Record<string, any[]>;
let pipelines: unknown[];
beforeAll(async () => {
  const summary: any = {
    modelVersion: FORECAST_MODEL_VERSION, featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    pipelineContractVersion: PIPELINE_CONTRACT_VERSION, predictions: 4, featureRows: 4, sourceMatches: 4,
    inputFingerprint: 'fixture', parameters: { historyScope: 'season-only', experiments: { dixonColes: false, glicko2: false } }, calibration: {},
  };
  tables = {
    winmix_current_engine_status: [{ run_id: runId, data_version_id: versionId, version_key: 'test', content_fingerprint: 'fixture',
      computed_at: '2026-01-03', match_count: 4, season_count: 2, league_coverage: { angol: { matches: 2, seasons: 1 }, spanyol: { matches: 2, seasons: 1 } }, result_summary: summary }],
    winmix_matches: [], winmix_predictions: [], winmix_match_features: [], winmix_team_state_snapshots: [],
  };
  pipelines = [];
  let sequence = 0;
  for (const league of leagues) {
    const result = await computeLeaguePipeline({ seasons: structuredClone(seasons), league, weights: {}, historyScope: 'season-only', experiments: { dixonColes: false, glicko2: false }, checkpoint: null, forceFullRebuild: true });
    summary.calibration[league] = { state: result.calibration };
    for (const s of result.seasons) for (const m of s.matches) {
      const p = m.pipeline!;
      const id = `${s.id}-${m.match_no}`;
      const team = (name: string) => ({ id: canon(name), canonical_key: canon(name), display_name: name });
      tables.winmix_matches.push({ id, data_version_id: versionId, season_id: s.id, league, match_no: m.match_no,
        row_index: null, source_file_id: null, kickoff_iso: m.kickoffIso, match_date_raw: m.date,
        home_score: m.home_score, away_score: m.away_score, ht_home_score: m.ht_home_score, ht_away_score: m.ht_away_score,
        home: team(m.home_team), away: team(m.away_team), season: { id: s.id, league, season_index: 1, name: s.name, file_name: s.fileName, created_at: s.createdAt, content_hash: s.contentHash, match_count: 2, order_mode: 'chronological' } });
      tables.winmix_predictions.push({ match_id: id, run_id: runId, outcome_home: p.calibrated.home, outcome_draw: p.calibrated.draw, outcome_away: p.calibrated.away, lambda_home: p.lambdas!.home, lambda_away: p.lambdas!.away, confidence: p.confidence,
        recommendation: { code: p.recommendation, decision: p.decision, caveat: p.caveat, confidenceLabel: p.confidenceLabel }, markets: p.secondary, model_output: p });
      tables.winmix_match_features.push({ match_id: id, run_id: runId, sequence_no: ++sequence, feature_schema_version: FEATURE_SCHEMA_VERSION, features: p.features });
      pipelines.push(p);
    }
    for (const name of [seasons.find(s => s.league === league)!.matches[0].home_team, seasons.find(s => s.league === league)!.matches[0].away_team]) {
      tables.winmix_team_state_snapshots.push({ run_id: runId, league, state: { canonicalKey: canon(name), displayName: name, weight: 5 } });
    }
  }
});
afterEach(() => vi.unstubAllGlobals());
function serve(data = structuredClone(tables), transform?: (table: string, rows: any[], offset: number) => any[]) {
  const mock = vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input), table = url.pathname.split('/').pop()!;
    expect(init.method ?? 'GET').toBe('GET');
    if (table !== 'winmix_current_engine_status') expect(url.searchParams.get(table === 'winmix_matches' ? 'data_version_id' : 'run_id')).toBe('eq.' + (table === 'winmix_matches' ? versionId : runId));
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const rows = data[table].slice(offset, offset + (table === 'winmix_current_engine_status' ? 2 : 1));
    return { ok: true, json: async () => transform ? transform(table, rows, offset) : rows } as Response;
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
describe('published run loading', () => {
  it('does not issue browser write requests in production mode', async () => {
    const fetch = serve();
    const result = await ingestSeasonsToCloud({ seasons: [] });
    expect(result.success).toBe(false); expect(fetch).not.toHaveBeenCalled();
  });
  it('loads both leagues with server-capped pages, preserving canonical numerical outputs', async () => {
    serve();
    const result = (await loadPublishedRun())!;
    expect(result.seasons.flatMap(s => s.matches.map(m => m.pipeline))).toEqual(pipelines);
    expect(result.seasons.map(s => s.league)).toEqual(['angol', 'spanyol']);
    expect(computeLeagueBenchmark(result.seasons).totalMatches).toBe(4);
  });
  it('stops before downloading raw history when there is no successful run', async () => {
    const copy = structuredClone(tables); copy.winmix_current_engine_status = [];
    const fetch = serve(copy);
    expect(await loadPublishedRun()).toBeNull(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects missing output rows', async () => {
    const copy = structuredClone(tables); copy.winmix_predictions.pop(); serve(copy);
    await expect(loadPublishedRun()).rejects.toThrow('Hiányos');
  });
  it('rejects foreign-run outputs', async () => {
    const copy = structuredClone(tables); copy.winmix_predictions[0].run_id = 'other'; serve(copy);
    await expect(loadPublishedRun()).rejects.toThrow('Eltérő');
  });
  it('rejects mismatched probability projections', async () => {
    const copy = structuredClone(tables); copy.winmix_predictions[0].outcome_home = 0; serve(copy);
    await expect(loadPublishedRun()).rejects.toThrow('eltérnek');
  });
  it('rejects a version change during pagination', async () => {
    let reads = 0;
    serve(undefined, (table, rows) => table === 'winmix_current_engine_status' && ++reads === 2 ? [{run_id: 'new'}] : rows);
    await expect(loadPublishedRun()).rejects.toThrow('Új eredmény');
  });
  it('rejects incompatible pipeline contracts before downloading history', async () => {
    const copy = structuredClone(tables); copy.winmix_current_engine_status[0].result_summary.pipelineContractVersion = 5;
    const fetch = serve(copy); await expect(loadPublishedRun()).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(1);
  });
});
