import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getServiceConfig } from '../scripts/supabase/lib/config.mjs';
const config = getServiceConfig();
const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: version, error: versionError } = await client.from('winmix_data_versions').select('id,content_fingerprint').eq('version_key', 'baseline-v1').single();
if (versionError) throw versionError;
const rows = [];
for (let offset = 0; ; offset += 1000) {
  const { data, error } = await client.from('winmix_matches').select('league,match_no,kickoff_iso,home_team_id,away_team_id,ht_home_score,ht_away_score,home_score,away_score,season:winmix_seasons!winmix_matches_season_id_fkey(season_index)').eq('data_version_id', version.id).order('league').order('season_id').order('match_no').range(offset, offset + 999);
  if (error) throw error;
  rows.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
rows.sort((a,b) => a.league.localeCompare(b.league) || a.season.season_index - b.season.season_index || a.match_no - b.match_no);
const pg = (values) => values.filter((v) => v !== null && v !== undefined).map(String).join('|');
const records = rows.map((r) => pg([r.league, r.season.season_index, r.match_no, r.kickoff_iso, r.home_team_id, r.away_team_id, r.ht_home_score, r.ht_away_score, r.home_score, r.away_score]));
const digest = (separator) => createHash('md5').update(records.join(separator)).digest('hex');
console.log(JSON.stringify({ stored: version.content_fingerprint, actualNewline: digest('\n'), literalBackslashN: digest('\\n'), crlf: digest('\r\n'), rows: rows.length }, null, 2));
