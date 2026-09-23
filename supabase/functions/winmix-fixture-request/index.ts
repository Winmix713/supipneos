import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LEAGUES = new Set(['angol', 'spanyol']);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

type IncomingFixture = { fixtureNo: number; homeTeamId: string; awayTeamId: string };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function hash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'POST required.' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
  if (!url || !publishableKey || !serviceRoleKey) return response({ error: 'Missing Supabase function configuration.' }, 500);

  const authHeader = request.headers.get('Authorization') ?? '';
  const caller = createClient(url, publishableKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return response({ error: 'Authenticated operator session required.' }, 401);

  let body: { league?: unknown; cutoffAt?: unknown; idempotencyKey?: unknown; fixtures?: unknown };
  try { body = await request.json(); } catch { return response({ error: 'Invalid JSON body.' }, 400); }
  if (typeof body.league !== 'string' || !LEAGUES.has(body.league)) return response({ error: 'league must be angol or spanyol.' }, 400);
  if (!isUuid(body.idempotencyKey) || !Array.isArray(body.fixtures) || body.fixtures.length < 1 || body.fixtures.length > 16) {
    return response({ error: 'A valid idempotencyKey and 1–16 fixtures are required.' }, 400);
  }
  const fixtures = body.fixtures as IncomingFixture[];
  const seenSlots = new Set<number>(), seenPairs = new Set<string>(), usedTeams = new Set<string>();
  for (const fixture of fixtures) {
    if (!Number.isInteger(fixture.fixtureNo) || fixture.fixtureNo < 1 || fixture.fixtureNo > 16 || !isUuid(fixture.homeTeamId) || !isUuid(fixture.awayTeamId) || fixture.homeTeamId === fixture.awayTeamId) {
      return response({ error: 'Every fixture needs a distinct valid home and away team and a slot from 1 to 16.' }, 400);
    }
    const pair = `${fixture.homeTeamId}:${fixture.awayTeamId}`;
    if (seenSlots.has(fixture.fixtureNo) || seenPairs.has(pair) || usedTeams.has(fixture.homeTeamId) || usedTeams.has(fixture.awayTeamId)) {
      return response({ error: 'Duplicate fixture slot, pair, or team in the same league round.' }, 400);
    }
    seenSlots.add(fixture.fixtureNo); seenPairs.add(pair); usedTeams.add(fixture.homeTeamId); usedTeams.add(fixture.awayTeamId);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: sourceRun, error: sourceError } = await admin.from('winmix_engine_runs')
    .select('id,data_version_id,parameter_snapshot_id,status,is_current')
    .eq('is_current', true).eq('status', 'succeeded').maybeSingle();
  if (sourceError || !sourceRun) return response({ error: 'No published WinMix source run is available yet.' }, 409);

  const { data: eligibleTeams, error: teamsError } = await admin.from('winmix_team_state_snapshots')
    .select('team_id').eq('run_id', sourceRun.id).eq('league', body.league).in('team_id', [...usedTeams]);
  if (teamsError || (eligibleTeams?.length ?? 0) !== usedTeams.size) return response({ error: 'A selected team is not available in the published league state.' }, 400);

  const payload = { league: body.league, cutoffAt: typeof body.cutoffAt === 'string' ? body.cutoffAt : null, fixtures: [...fixtures].sort((a, b) => a.fixtureNo - b.fixtureNo), sourceRunId: sourceRun.id };
  const inputHash = await hash(payload);
  const row = { idempotency_key: body.idempotencyKey, input_hash: inputHash, league: body.league, cutoff_at: payload.cutoffAt, source_run_id: sourceRun.id, data_version_id: sourceRun.data_version_id, parameter_snapshot_id: sourceRun.parameter_snapshot_id, request_payload: payload };
  const { data: created, error: createError } = await admin.from('winmix_fixture_prediction_requests').insert(row).select('id,status,created_at').single();
  if (createError?.code === '23505') {
    const { data: existing } = await admin.from('winmix_fixture_prediction_requests').select('id,status,created_at').eq('idempotency_key', body.idempotencyKey).maybeSingle();
    if (existing) return response({ request: existing, reused: true }, 200);
  }
  if (createError || !created) return response({ error: `Request creation failed: ${createError?.message ?? 'unknown error'}` }, 500);
  return response({ request: created, reused: false }, 202);
});
