import type {
  ConfidenceLabel,
  DecisionQuadrant,
  League,
  MatchPipeline,
  MatchRow,
  Recommendation,
  Season,
} from '../types/winmix';

export interface FlatMatch {
  key: string;
  season: Season;
  match: MatchRow;
  pipeline: MatchPipeline | undefined;
  /** ISO calendar day (YYYY-MM-DD) when the source carried a usable kickoff. */
  day: string | null;
}

export interface MatchFilters {
  leagues: League[];
  seasonIds: string[];
  from: string;
  to: string;
  recommendations: Recommendation[];
  confidence: ConfidenceLabel[];
  decisions: DecisionQuadrant[];
  query: string;
}

export const emptyFilters: MatchFilters = {
  leagues: [],
  seasonIds: [],
  from: '',
  to: '',
  recommendations: [],
  confidence: [],
  decisions: [],
  query: '',
};

export const LEAGUE_LABEL: Record<League, string> = {
  angol: 'Angol liga',
  spanyol: 'Spanyol liga',
};

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  HOME_WIN: 'Hazai győzelem',
  DRAW: 'Döntetlen',
  AWAY_WIN: 'Vendég győzelem',
  NO_CLEAR_EDGE: 'Nincs tiszta él',
};

export const RECOMMENDATION_SHORT: Record<Recommendation, string> = {
  HOME_WIN: 'Hazai',
  DRAW: 'Döntetlen',
  AWAY_WIN: 'Vendég',
  NO_CLEAR_EDGE: 'Nincs él',
};

export const CONFIDENCE_LABEL: Record<ConfidenceLabel, string> = {
  High: 'Magas',
  Good: 'Jó',
  Moderate: 'Közepes',
  Low: 'Alacsony',
};

export const DECISION_LABEL: Record<DecisionQuadrant, string> = {
  actionable: 'Használható',
  volatile: 'Ingadozó',
  flat: 'Lapos',
  ignore: 'Kihagyandó',
};

export const SUFFICIENCY_LABEL: Record<'hot' | 'warm' | 'cold', string> = {
  hot: 'Sok adat',
  warm: 'Közepes adat',
  cold: 'Kevés adat',
};

export const RECOMMENDATIONS: Recommendation[] = ['HOME_WIN', 'DRAW', 'AWAY_WIN', 'NO_CLEAR_EDGE'];
export const CONFIDENCE_LEVELS: ConfidenceLabel[] = ['High', 'Good', 'Moderate', 'Low'];
export const DECISIONS: DecisionQuadrant[] = ['actionable', 'volatile', 'flat', 'ignore'];

export function toDay(match: MatchRow): string | null {
  if (match.kickoffIso) return match.kickoffIso.slice(0, 10);
  const raw = (match.date ?? '').trim();
  const iso = /^(\d{4})[-./](\d{2})[-./](\d{2})/.exec(raw);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

export function flattenSeasons(seasons: Season[]): FlatMatch[] {
  const rows: FlatMatch[] = [];
  for (const season of seasons) {
    for (const match of season.matches) {
      rows.push({
        key: `${season.id}:${match.match_no}`,
        season,
        match,
        pipeline: match.pipeline,
        day: toDay(match),
      });
    }
  }
  return rows;
}

export function filterMatches(rows: FlatMatch[], filters: MatchFilters): FlatMatch[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.leagues.length && !filters.leagues.includes(row.season.league)) return false;
    if (filters.seasonIds.length && !filters.seasonIds.includes(row.season.id)) return false;
    if (filters.from && (!row.day || row.day < filters.from)) return false;
    if (filters.to && (!row.day || row.day > filters.to)) return false;
    const p = row.pipeline;
    if (filters.recommendations.length && (!p || !filters.recommendations.includes(p.recommendation)))
      return false;
    if (filters.confidence.length && (!p || !filters.confidence.includes(p.confidenceLabel))) return false;
    if (filters.decisions.length && (!p || !filters.decisions.includes(p.decision))) return false;
    if (query) {
      const haystack = `${row.match.home_team} ${row.match.away_team} ${row.season.name}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function sortMatches(rows: FlatMatch[]): FlatMatch[] {
  return [...rows].sort((a, b) => {
    const da = a.day ?? '';
    const db = b.day ?? '';
    if (da !== db) return db.localeCompare(da);
    if (a.season.id !== b.season.id) return a.season.name.localeCompare(b.season.name);
    return b.match.match_no - a.match.match_no;
  });
}

export function pct(value: number | undefined | null, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function num(value: number | undefined | null, digits = 3): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function formatDay(day: string | null, fallback = '—'): string {
  if (!day) return fallback;
  const [y, m, d] = day.split('-');
  return `${y}. ${m}. ${d}.`;
}

/** Counts of stored outcomes — reads only, nothing is recomputed. */
export function summarise(rows: FlatMatch[]) {
  let withPipeline = 0;
  let correct = 0;
  let actionable = 0;
  let highConfidence = 0;
  let goals = 0;
  let btts = 0;
  const byRecommendation = new Map<Recommendation, number>();
  for (const row of rows) {
    goals += row.match.total_goals;
    if (row.match.btts) btts += 1;
    const p = row.pipeline;
    if (!p) continue;
    withPipeline += 1;
    if (p.reconciliation?.isCorrect) correct += 1;
    if (p.decision === 'actionable') actionable += 1;
    if (p.confidenceLabel === 'High') highConfidence += 1;
    byRecommendation.set(p.recommendation, (byRecommendation.get(p.recommendation) ?? 0) + 1);
  }
  return {
    total: rows.length,
    withPipeline,
    correct,
    hitRate: withPipeline ? correct / withPipeline : null,
    actionable,
    highConfidence,
    avgGoals: rows.length ? goals / rows.length : null,
    bttsRate: rows.length ? btts / rows.length : null,
    byRecommendation,
  };
}
