/*
 * Reproducible WinMix baseline runner.
 *
 * Default mode is read-only: it validates the sealed source and computes the
 * complete walk locally. `--publish` is deliberately opt-in: until the final
 * promotion RPC succeeds, a partially-uploaded run is invisible to the site.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import { getServiceConfig } from '../supabase/lib/config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const LEAGUES = ['angol', 'spanyol'];
const ENGINE_VERSION = 'winmix-local-baseline-1.0.0';
const INSERT_CHUNK_SIZE = 300;
const EPSILON = 1e-6;

function parseArgs(args) {
  const options = { version: 'baseline-v1', publish: false, selfTest: false, snapshot: null, league: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--publish') options.publish = true;
    else if (arg === '--self-test') options.selfTest = true;
    else if (arg === '--version') options.version = args[++index];
    else if (arg === '--snapshot') options.snapshot = args[++index];
    else if (arg === '--league') options.league = args[++index];
    else if (arg === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function help() {
  console.log(`WinMix baseline runner

  npm run baseline:run
  npm run baseline:run -- --version baseline-v1
  npm run baseline:run -- --snapshot <uuid>
  npm run baseline:run -- --league spanyol
  npm run baseline:run -- --publish

The default mode only reads and validates. --league is a read-only single-league
preview and cannot be published. --publish requires SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY and atomically promotes the run only after all output
has passed validation.`);
}

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function validateOutput({ sourceIds, features, predictions, teamSnapshots, calibrationRows, expected }) {
  if (sourceIds.size !== expected) throw new Error(`Source identity mismatch: ${sourceIds.size}/${expected}.`);
  if (features.length !== expected || predictions.length !== expected) {
    throw new Error(`Output coverage mismatch: features ${features.length}, predictions ${predictions.length}, expected ${expected}.`);
  }
  const featureIds = new Set();
  const sequenceNos = new Set();
  for (const feature of features) {
    if (!sourceIds.has(feature.match_id) || featureIds.has(feature.match_id)) throw new Error(`Invalid or duplicate feature match id: ${feature.match_id}`);
    featureIds.add(feature.match_id);
    if (!Number.isInteger(feature.sequence_no) || feature.sequence_no < 1 || feature.sequence_no > expected || sequenceNos.has(feature.sequence_no)) throw new Error(`Invalid or duplicate sequence number: ${feature.sequence_no}`);
    sequenceNos.add(feature.sequence_no);
    if (!feature.features || typeof feature.features !== 'object') throw new Error(`Missing features for ${feature.match_id}`);
    for (const [name, value] of Object.entries(feature.features)) finite(value, `feature ${name} (${feature.match_id})`);
  }
  if (sequenceNos.size !== expected) throw new Error('Sequence coverage has gaps.');
  const predictionIds = new Set();
  for (const prediction of predictions) {
    if (!sourceIds.has(prediction.match_id) || predictionIds.has(prediction.match_id)) throw new Error(`Invalid or duplicate prediction match id: ${prediction.match_id}`);
    predictionIds.add(prediction.match_id);
    const home = finite(prediction.outcome_home, `home probability (${prediction.match_id})`);
    const draw = finite(prediction.outcome_draw, `draw probability (${prediction.match_id})`);
    const away = finite(prediction.outcome_away, `away probability (${prediction.match_id})`);
    for (const probability of [home, draw, away]) if (probability < 0 || probability > 1) throw new Error(`Probability outside [0,1] for ${prediction.match_id}`);
    if (Math.abs(home + draw + away - 1) > EPSILON) throw new Error(`Probability sum is not one for ${prediction.match_id}`);
    if (prediction.lambda_home !== null) finite(prediction.lambda_home, `lambda_home (${prediction.match_id})`);
    if (prediction.lambda_away !== null) finite(prediction.lambda_away, `lambda_away (${prediction.match_id})`);
  }
  if (predictionIds.size !== expected || predictionIds.size !== featureIds.size) throw new Error('Feature/prediction coverage differs.');
  if (!teamSnapshots.length || !calibrationRows.length) throw new Error('Required team state or calibration output is missing.');
  return { featureCount: featureIds.size, predictionCount: predictionIds.size, teamStateCount: teamSnapshots.length, calibrationCount: calibrationRows.length };
}

function selfTest() {
  const sourceIds = new Set(['a']);
  const common = { sourceIds, expected: 1, features: [{ match_id: 'a', sequence_no: 1, features: { x: 1 } }], teamSnapshots: [{}], calibrationRows: [{}] };
  assert.equal(validateOutput({ ...common, predictions: [{ match_id: 'a', outcome_home: .4, outcome_draw: .3, outcome_away: .3, lambda_home: 1, lambda_away: 1 }] }).predictionCount, 1);
  assert.throws(() => validateOutput({ ...common, predictions: [{ match_id: 'a', outcome_home: .4, outcome_draw: .3, outcome_away: .4, lambda_home: 1, lambda_away: 1 }] }));
  assert.throws(() => validateOutput({ ...common, features: [{ match_id: 'a', sequence_no: 2, features: { x: 1 } }], predictions: [{ match_id: 'a', outcome_home: .4, outcome_draw: .3, outcome_away: .3, lambda_home: 1, lambda_away: 1 }] }));
  console.log('Baseline validation self-test passed.');
}

async function loadEngine() {
  const result = await build({ entryPoints: [path.join(root, 'src/engine-core/index.ts')], bundle: true, format: 'esm', platform: 'node', write: false, target: 'node20' });
  const encoded = Buffer.from(result.outputFiles[0].contents).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

async function fetchAllMatches(admin, dataVersionId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('winmix_matches').select(`
      id, season_id, league, match_no, source_file_id, row_index, kickoff_iso,
      match_date_raw, ht_home_score, ht_away_score, home_score, away_score,
      home:winmix_teams!winmix_matches_home_team_id_fkey(id, canonical_key, display_name),
      away:winmix_teams!winmix_matches_away_team_id_fkey(id, canonical_key, display_name),
      season:winmix_seasons!winmix_matches_season_id_fkey(id, league, season_index, name, file_name, content_hash, match_count, order_mode, created_at)
    `).eq('data_version_id', dataVersionId).order('league').order('season_id').order('match_no').range(from, from + 999);
    if (error) throw new Error(`Source match read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows.sort((a, b) => a.league.localeCompare(b.league) || a.season.season_index - b.season.season_index || a.match_no - b.match_no || a.id.localeCompare(b.id));
}

function buildSeasons(rows) {
  const bySeason = new Map();
  const matchIdByIdentity = new Map();
  for (const row of rows) {
    if (!row.season || !row.home?.display_name || !row.away?.display_name) throw new Error(`Invalid relational source row: ${row.id}`);
    let season = bySeason.get(row.season_id);
    if (!season) {
      season = { id: row.season.id, league: row.season.league, seasonIndex: row.season.season_index, name: row.season.name, fileName: row.season.file_name, createdAt: row.season.created_at, contentHash: row.season.content_hash, countWarning: row.season.match_count !== 240, actualMatchCount: row.season.match_count, orderMode: row.season.order_mode, datedMatchCount: 0, matches: [] };
      bySeason.set(row.season_id, season);
    }
    if (row.kickoff_iso) season.datedMatchCount += 1;
    season.matches.push({ match_no: row.match_no, date: row.match_date_raw ?? '', kickoffIso: row.kickoff_iso, rowIndex: row.row_index ?? undefined, sourceFileId: row.source_file_id ?? undefined, home_team: row.home.display_name, away_team: row.away.display_name, ht_home_score: row.ht_home_score, ht_away_score: row.ht_away_score, home_score: row.home_score, away_score: row.away_score, total_goals: row.home_score + row.away_score, btts: row.home_score > 0 && row.away_score > 0, outcome: row.home_score > row.away_score ? 'H' : row.home_score < row.away_score ? 'A' : 'D' });
    matchIdByIdentity.set(`${row.season_id}:${row.match_no}`, row.id);
  }
  return { seasons: [...bySeason.values()], matchIdByIdentity };
}

function outputsOf(result, matchIds, offset, featureSchemaVersion) {
  const features = [], predictions = []; let sequence = offset;
  for (const season of result.seasons) for (const match of season.matches) {
    const pipeline = match.pipeline;
    const matchId = matchIds.get(`${season.id}:${match.match_no}`);
    if (!pipeline || !matchId) throw new Error(`Missing pipeline output or identity for ${season.id}:${match.match_no}`);
    sequence += 1;
    features.push({ match_id: matchId, sequence_no: sequence, feature_schema_version: featureSchemaVersion, features: pipeline.features });
    // The canonical engine exposes confidence for display on a 0–100 scale;
    // the database contract stores normalized probabilities (0–1).
    const confidence = finite(pipeline.confidence, `confidence ${matchId}`) / 100;
    if (confidence < 0 || confidence > 1) throw new Error(`Confidence is outside the expected 0–100 engine scale for ${matchId}`);
    predictions.push({ match_id: matchId, outcome_home: pipeline.calibrated.home, outcome_draw: pipeline.calibrated.draw, outcome_away: pipeline.calibrated.away, lambda_home: finite(pipeline.lambdas?.home, `lambda home ${matchId}`), lambda_away: finite(pipeline.lambdas?.away, `lambda away ${matchId}`), confidence, recommendation: { code: pipeline.recommendation, decision: pipeline.decision, caveat: pipeline.caveat, confidenceLabel: pipeline.confidenceLabel }, markets: pipeline.secondary, model_output: { b0: pipeline.b0, b1: pipeline.b1, m1: pipeline.m1, ensRaw: pipeline.ensRaw, calibrated: pipeline.calibrated, calibratedT: pipeline.calibratedT, lambdas: pipeline.lambdas, context: pipeline.context, m1Source: pipeline.m1Source, ensembleWM1: pipeline.ensembleWM1, priorDivergence: pipeline.priorDivergence, reconciliation: pipeline.reconciliation } });
  }
  return { features, predictions, sequence };
}

function finalTeamSnapshots(rows, weights, runId, sequenceNo) {
  const teams = new Map();
  for (const row of rows) for (const [side, isHome] of [[row.home, true], [row.away, false]]) {
    const current = teams.get(side.id) ?? { run_id: runId, team_id: side.id, league: row.league, as_of_match_id: row.id, sequence_no: sequenceNo, state: { schemaVersion: 1, kind: 'final-run-summary', canonicalKey: side.canonical_key, displayName: side.display_name, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, homeMatches: 0, awayMatches: 0, weight: weights?.[row.league]?.[side.canonical_key] ?? 5 } };
    const gf = isHome ? row.home_score : row.away_score, ga = isHome ? row.away_score : row.home_score;
    current.state.matches += 1; current.state.goalsFor += gf; current.state.goalsAgainst += ga;
    if (isHome) current.state.homeMatches += 1; else current.state.awayMatches += 1;
    if (gf > ga) current.state.wins += 1; else if (gf === ga) current.state.draws += 1; else current.state.losses += 1;
    current.as_of_match_id = row.id; teams.set(side.id, current);
  }
  return [...teams.values()];
}

async function insertChunks(admin, table, rows) {
  for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
    const { error } = await admin.from(table).insert(rows.slice(index, index + INSERT_CHUNK_SIZE));
    if (error) throw new Error(`${table} upload failed: ${error.message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return help();
  if (options.selfTest) return selfTest();
  if (options.league && !LEAGUES.includes(options.league)) throw new Error(`Unknown league: ${options.league}. Use one of: ${LEAGUES.join(', ')}.`);
  if (options.league && options.publish) throw new Error('A single-league preview cannot be published. Run the complete baseline to publish.');
  const config = getServiceConfig();
  if (!config) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required. Put them in a local, untracked .env file; never use a VITE_ key.');
  const admin = createClient(config.url, config.key, { auth: { autoRefreshToken: false, persistSession: false } });
  const engine = await loadEngine();
  const { data: version, error: versionError } = await admin.from('winmix_data_versions').select('id, status, content_fingerprint, season_count, match_count, league_coverage').eq('version_key', options.version).single();
  if (versionError || !version || version.status !== 'sealed') throw new Error(`Sealed data version unavailable: ${versionError?.message ?? options.version}`);
  const { data: integrityResult, error: integrityError } = await admin.rpc('winmix_validate_data_version', { p_data_version_id: version.id });
  // PostgreSQL functions declared with RETURNS TABLE are returned by PostgREST
  // as an array, even when the function emits exactly one row.
  const integrity = Array.isArray(integrityResult) ? integrityResult[0] : integrityResult;
  if (integrityError || !integrity || integrity.match_count !== version.match_count || integrity.content_fingerprint !== version.content_fingerprint) throw new Error(`Source integrity validation failed: ${integrityError?.message ?? 'fingerprint mismatch'}`);
  let snapshotsQuery = admin.from('winmix_parameter_snapshots').select('id, data_version_id, model_version, feature_schema_version, pipeline_contract_version, history_scope, experiments, weights, parameters_fingerprint').eq('data_version_id', version.id).eq('model_version', engine.FORECAST_MODEL_VERSION).eq('feature_schema_version', engine.FEATURE_SCHEMA_VERSION).eq('pipeline_contract_version', engine.PIPELINE_CONTRACT_VERSION);
  if (options.snapshot) snapshotsQuery = snapshotsQuery.eq('id', options.snapshot);
  const { data: snapshots, error: snapshotError } = await snapshotsQuery;
  if (snapshotError || !snapshots?.length) throw new Error(`Compatible parameter snapshot unavailable: ${snapshotError?.message ?? 'none'}`);
  if (snapshots.length !== 1) throw new Error(`Multiple compatible snapshots found; rerun with --snapshot. Candidates: ${snapshots.map((s) => s.id).join(', ')}`);
  const snapshot = snapshots[0];
  const started = Date.now();
  const allSourceRows = await fetchAllMatches(admin, version.id);
  if (allSourceRows.length !== version.match_count) throw new Error(`Read ${allSourceRows.length} source rows; expected ${version.match_count}.`);
  const sourceRows = options.league ? allSourceRows.filter((row) => row.league === options.league) : allSourceRows;
  if (!sourceRows.length) throw new Error(`No source matches found for league ${options.league}.`);
  const { seasons, matchIdByIdentity } = buildSeasons(sourceRows);
  const features = [], predictions = [], calibrationRows = [], calibration = {}; let sequence = 0;
  for (const league of options.league ? [options.league] : LEAGUES) {
    const result = await engine.computeLeaguePipeline({ seasons, league, weights: snapshot.weights?.[league] ?? {}, historyScope: snapshot.history_scope, experiments: snapshot.experiments ?? { dixonColes: false, glicko2: false }, checkpoint: null, forceFullRebuild: true });
    const output = outputsOf(result, matchIdByIdentity, sequence, engine.FEATURE_SCHEMA_VERSION);
    sequence = output.sequence; features.push(...output.features); predictions.push(...output.predictions);
    for (const report of Object.values(result.calibration.markets ?? {})) calibrationRows.push({ league, market_code: report.market, sample_count: report.n, brier: report.brier, log_loss: report.logLoss, ece: report.ece, metrics: report });
    calibration[league] = { state: result.calibration, checkpoint: result.checkpoint };
  }
  const teamSnapshots = finalTeamSnapshots(sourceRows, snapshot.weights, 'RUN_ID_ASSIGNED_ON_PUBLISH', sequence);
  const counts = validateOutput({ sourceIds: new Set(sourceRows.map((row) => row.id)), features, predictions, teamSnapshots, calibrationRows, expected: sourceRows.length });
  const durationMs = Date.now() - started;
  const report = { mode: options.publish ? 'publish' : options.league ? 'league-preview' : 'dry-run', league: options.league, version: options.version, dataVersionId: version.id, parameterSnapshotId: snapshot.id, inputFingerprint: `${version.content_fingerprint}:${snapshot.parameters_fingerprint}`, durationMs, ...counts, generatedAt: new Date().toISOString() };
  await mkdir(path.join(root, 'outputs'), { recursive: true });
  await writeFile(path.join(root, 'outputs', 'baseline-validation-report.json'), JSON.stringify(report, null, 2));
  if (!options.publish) { console.log(JSON.stringify(report, null, 2)); return; }
  let runId = null;
  try {
    const { data: run, error } = await admin.from('winmix_engine_runs').insert({ data_version_id: version.id, parameter_snapshot_id: snapshot.id, engine_version: ENGINE_VERSION, status: 'running', input_fingerprint: report.inputFingerprint }).select('id').single();
    if (error || !run) throw new Error(`Run creation failed: ${error?.message ?? 'missing run'}`);
    runId = run.id;
    await insertChunks(admin, 'winmix_match_features', features.map((row) => ({ ...row, run_id: runId })));
    await insertChunks(admin, 'winmix_predictions', predictions.map((row) => ({ ...row, run_id: runId })));
    await insertChunks(admin, 'winmix_calibration_results', calibrationRows.map((row) => ({ ...row, run_id: runId })));
    await insertChunks(admin, 'winmix_team_state_snapshots', teamSnapshots.map((row) => ({ ...row, run_id: runId })));
    const { error: completeError } = await admin.from('winmix_engine_runs').update({ status: 'succeeded', finished_at: new Date().toISOString(), duration_ms: durationMs, result_summary: { sourceMatches: sourceRows.length, predictions: sequence, featureRows: sequence, teamStateRows: teamSnapshots.length, calibrationRows: calibrationRows.length, modelVersion: engine.FORECAST_MODEL_VERSION, featureSchemaVersion: engine.FEATURE_SCHEMA_VERSION, pipelineContractVersion: engine.PIPELINE_CONTRACT_VERSION, inputFingerprint: report.inputFingerprint, parameters: { historyScope: snapshot.history_scope, experiments: snapshot.experiments }, calibration } }).eq('id', runId);
    if (completeError) throw new Error(`Run completion failed: ${completeError.message}`);
    const { error: promotionError } = await admin.rpc('winmix_promote_engine_run', { p_run_id: runId });
    if (promotionError) throw new Error(`Atomic promotion failed: ${promotionError.message}`);
    console.log(JSON.stringify({ ...report, runId, published: true }, null, 2));
  } catch (error) {
    if (runId) await admin.from('winmix_engine_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_code: 'BASELINE_FAILURE', error_message: error instanceof Error ? error.message : String(error) }).eq('id', runId);
    throw error;
  }
}

main().catch((error) => { console.error(`Baseline failed: ${error.message}`); process.exitCode = 1; });
