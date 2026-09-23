import { describe, expect, it } from 'vitest';
import {
  flattenSeasons,
  filterMatches,
  sortMatches,
  summarise,
  emptyFilters,
  toDay,
  type FlatMatch,
  type MatchFilters,
} from '../lib/winmixView';
import type { MatchPipeline, MatchRow, Season } from '../types/winmix';

function makePipeline(overrides: Partial<MatchPipeline> = {}): MatchPipeline {
  const base: MatchPipeline = {
    context: { homePlayed: 10, awayPlayed: 10, dataSufficiency: 'hot' },
    features: {
      home_weight_index: 5, away_weight_index: 5, weight_diff: 0,
      home_att_home: 1.4, home_def_home: 1.1, away_att_away: 1.2, away_def_away: 1.3,
      league_home_gpm: 1.5, league_away_gpm: 1.15, home_form_5: 1.5, away_form_5: 1.3,
      home_gd_form_5: 0.2, away_gd_form_5: -0.1, h2h_home_ppg: 1.35,
      htGoalRate5: 0.65, htLeadConversionHome: 0.72, htLeadConversionAway: 0.72,
      secondHalfGoalRatio: 0.52, prevMatchTotalGoalsHome: 2.5, prevMatchTotalGoalsAway: 2.5,
    },
    b0: { home: 0.44, draw: 0.26, away: 0.30 },
    b1: { home: 0.45, draw: 0.25, away: 0.30 },
    m1: { home: 0.46, draw: 0.24, away: 0.30 },
    ensRaw: { home: 0.455, draw: 0.245, away: 0.30 },
    calibrated: { home: 0.50, draw: 0.25, away: 0.25 },
    lambdas: { home: 1.4, away: 1.2 },
    calibratedT: 1.0,
    confidence: 0.8,
    confidenceLabel: 'High',
    decision: 'actionable',
    m1Source: 'fitted',
    ensembleWM1: 0.65,
    priorDivergence: 0.02,
    recommendation: 'HOME_WIN',
    caveat: null,
    secondary: {
      over25: 0.55, btts: 0.48, mostLikelyScore: '1-1',
    },
    reconciliation: { brierB1: 0.3, brierEns: 0.28, logLossB1: 0.7, logLossEns: 0.65, isCorrect: true },
  };
  return { ...base, ...overrides } as MatchPipeline;
}

function makeMatch(n: number, overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    match_no: n,
    date: `2026-01-${String(n).padStart(2, '0')}`,
    kickoffIso: `2026-01-${String(n).padStart(2, '0')}T15:00:00Z`,
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    ht_home_score: 1,
    ht_away_score: 0,
    home_score: 2,
    away_score: 1,
    total_goals: 3,
    btts: true,
    outcome: 'H',
    ...overrides,
  };
}

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 's-eng-2026',
    league: 'angol',
    seasonIndex: 1,
    name: 'Angol 2026',
    fileName: 'eng.csv',
    createdAt: '2026-01-01',
    contentHash: null,
    countWarning: false,
    actualMatchCount: 2,
    orderMode: 'chronological',
    datedMatchCount: 2,
    matches: [makeMatch(1), makeMatch(2)],
    ...overrides,
  };
}

const baseSeasons: Season[] = [
  makeSeason(),
  makeSeason({
    id: 's-esp-2026',
    league: 'spanyol',
    seasonIndex: 1,
    name: 'Spanyol 2026',
    fileName: 'esp.csv',
    matches: [
      makeMatch(1, { home_team: 'Barcelona', away_team: 'Real Madrid', date: '2026-02-01', kickoffIso: '2026-02-01T15:00:00Z' }),
      makeMatch(2, { home_team: 'Atletico', away_team: 'Sevilla', date: '2026-02-05', kickoffIso: '2026-02-05T15:00:00Z' }),
    ],
  }),
];

describe('flattenSeasons', () => {
  it('produces one FlatMatch per match across all seasons', () => {
    const rows = flattenSeasons(baseSeasons);
    expect(rows).toHaveLength(4);
    expect(rows[0].key).toBe('s-eng-2026:1');
    expect(rows[2].season.league).toBe('spanyol');
  });

  it('does not mutate the input seasons array', () => {
    const snapshot = structuredClone(baseSeasons);
    flattenSeasons(baseSeasons);
    expect(baseSeasons).toEqual(snapshot);
  });

  it('extracts the calendar day from kickoffIso', () => {
    const rows = flattenSeasons(baseSeasons);
    expect(rows[0].day).toBe('2026-01-01');
    expect(rows[2].day).toBe('2026-02-01');
  });
});

describe('filterMatches', () => {
  const rows = flattenSeasons(baseSeasons);

  it('returns all rows with empty filters', () => {
    expect(filterMatches(rows, emptyFilters)).toHaveLength(4);
  });

  it('filters by league', () => {
    const f: MatchFilters = { ...emptyFilters, leagues: ['angol'] };
    const result = filterMatches(rows, f);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.season.league === 'angol')).toBe(true);
  });

  it('filters by season id', () => {
    const f: MatchFilters = { ...emptyFilters, seasonIds: ['s-esp-2026'] };
    const result = filterMatches(rows, f);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.season.id === 's-esp-2026')).toBe(true);
  });

  it('filters by date range (from)', () => {
    const f: MatchFilters = { ...emptyFilters, from: '2026-02-01' };
    const result = filterMatches(rows, f);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.season.league === 'spanyol')).toBe(true);
  });

  it('filters by date range (to)', () => {
    const f: MatchFilters = { ...emptyFilters, to: '2026-01-31' };
    const result = filterMatches(rows, f);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.season.league === 'angol')).toBe(true);
  });

  it('filters by recommendation', () => {
    const withPipeline = rows.map((r, i) =>
      i % 2 === 0
        ? { ...r, pipeline: makePipeline({ recommendation: 'HOME_WIN' }) }
        : { ...r, pipeline: makePipeline({ recommendation: 'DRAW' }) },
    );
    const f: MatchFilters = { ...emptyFilters, recommendations: ['DRAW'] };
    const result = filterMatches(withPipeline, f);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.pipeline!.recommendation === 'DRAW')).toBe(true);
  });

  it('filters by confidence label', () => {
    const withPipeline = rows.map((r, i) =>
      i < 2
        ? { ...r, pipeline: makePipeline({ confidenceLabel: 'High' }) }
        : { ...r, pipeline: makePipeline({ confidenceLabel: 'Low' }) },
    );
    const f: MatchFilters = { ...emptyFilters, confidence: ['High'] };
    const result = filterMatches(withPipeline, f);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.pipeline!.confidenceLabel === 'High')).toBe(true);
  });

  it('filters by decision quadrant', () => {
    const withPipeline = rows.map((r, i) =>
      i % 2 === 0
        ? { ...r, pipeline: makePipeline({ decision: 'actionable' }) }
        : { ...r, pipeline: makePipeline({ decision: 'ignore' }) },
    );
    const f: MatchFilters = { ...emptyFilters, decisions: ['actionable'] };
    const result = filterMatches(withPipeline, f);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.pipeline!.decision === 'actionable')).toBe(true);
  });

  it('filters by team name query', () => {
    const f: MatchFilters = { ...emptyFilters, query: 'Barcelona' };
    const result = filterMatches(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].match.home_team).toBe('Barcelona');
  });

  it('query is case-insensitive', () => {
    const f: MatchFilters = { ...emptyFilters, query: 'arsenal' };
    const result = filterMatches(rows, f);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.match.home_team === 'Arsenal')).toBe(true);
  });

  it('excludes matches without a pipeline when filtering by recommendation', () => {
    const noPipeline: FlatMatch[] = rows.map((r) => ({ ...r, pipeline: undefined }));
    const f: MatchFilters = { ...emptyFilters, recommendations: ['HOME_WIN'] };
    expect(filterMatches(noPipeline, f)).toHaveLength(0);
  });

  it('does not mutate the input rows array', () => {
    const snapshot = structuredClone(rows);
    filterMatches(rows, { ...emptyFilters, leagues: ['angol'] });
    expect(rows).toEqual(snapshot);
  });
});

describe('sortMatches', () => {
  it('sorts by date descending (newest first)', () => {
    const rows = flattenSeasons(baseSeasons);
    const sorted = sortMatches(rows);
    expect(sorted[0].day).toBe('2026-02-05');
    expect(sorted[3].day).toBe('2026-01-01');
  });

  it('breaks ties by season name ascending then match_no descending', () => {
    const season = makeSeason({
      matches: [
        makeMatch(1, { date: '2026-01-01', kickoffIso: '2026-01-01T15:00:00Z' }),
        makeMatch(2, { date: '2026-01-01', kickoffIso: '2026-01-01T15:00:00Z' }),
        makeMatch(3, { date: '2026-01-01', kickoffIso: '2026-01-01T15:00:00Z' }),
      ],
    });
    const rows = flattenSeasons([season]);
    const sorted = sortMatches(rows);
    expect(sorted.map((r) => r.match.match_no)).toEqual([3, 2, 1]);
  });

  it('places matches with no day after matches with a day (empty string sorts before any date)', () => {
    const seasons: Season[] = [
      makeSeason({
        matches: [
          makeMatch(1, { date: '', kickoffIso: null }),
          makeMatch(2, { date: '2026-03-01', kickoffIso: '2026-03-01T15:00:00Z' }),
        ],
      }),
    ];
    const rows = flattenSeasons(seasons);
    const sorted = sortMatches(rows);
    expect(sorted[0].day).toBe('2026-03-01');
    expect(sorted[1].day).toBeNull();
  });

  it('is a stable sort for equal dates within the same season', () => {
    const season = makeSeason({
      matches: [
        makeMatch(1, { date: '2026-01-01', kickoffIso: '2026-01-01T15:00:00Z', home_team: 'A' }),
        makeMatch(2, { date: '2026-01-01', kickoffIso: '2026-01-01T15:00:00Z', home_team: 'B' }),
        makeMatch(3, { date: '2026-01-01', kickoffIso: '2026-01-01T15:00:00Z', home_team: 'C' }),
      ],
    });
    const rows = flattenSeasons([season]);
    // Reverse the input order; the sort must still produce match_no descending.
    const reversed = [...rows].reverse();
    const sorted = sortMatches(reversed);
    expect(sorted.map((r) => r.match.match_no)).toEqual([3, 2, 1]);
  });

  it('does not mutate the input array', () => {
    const rows = flattenSeasons(baseSeasons);
    const originalOrder = rows.map((r) => r.key);
    sortMatches(rows);
    expect(rows.map((r) => r.key)).toEqual(originalOrder);
  });
});

describe('summarise', () => {
  it('counts totals, goals and btts from raw match data', () => {
    const rows = flattenSeasons(baseSeasons);
    const s = summarise(rows);
    expect(s.total).toBe(4);
    expect(s.avgGoals).toBe(3);
    expect(s.bttsRate).toBe(1);
  });

  it('aggregates pipeline metrics when pipelines exist', () => {
    const rows = flattenSeasons(baseSeasons).map((r, i) => ({
      ...r,
      pipeline: makePipeline({
        recommendation: i < 2 ? 'HOME_WIN' : 'DRAW',
        decision: i === 0 ? 'actionable' : 'volatile',
        confidenceLabel: i === 0 ? 'High' : 'Good',
        reconciliation: { brierB1: 0.3, brierEns: 0.28, logLossB1: 0.7, logLossEns: 0.65, isCorrect: i < 3 },
      }),
    }));
    const s = summarise(rows);
    expect(s.withPipeline).toBe(4);
    expect(s.correct).toBe(3);
    expect(s.hitRate).toBe(0.75);
    expect(s.actionable).toBe(1);
    expect(s.highConfidence).toBe(1);
    expect(s.byRecommendation.get('HOME_WIN')).toBe(2);
    expect(s.byRecommendation.get('DRAW')).toBe(2);
  });

  it('returns null hitRate when no pipelines exist', () => {
    const rows = flattenSeasons(baseSeasons);
    const s = summarise(rows);
    expect(s.withPipeline).toBe(0);
    expect(s.hitRate).toBeNull();
  });

  it('handles empty input', () => {
    const s = summarise([]);
    expect(s.total).toBe(0);
    expect(s.avgGoals).toBeNull();
    expect(s.bttsRate).toBeNull();
  });
});

describe('toDay', () => {
  it('extracts YYYY-MM-DD from kickoffIso', () => {
    expect(toDay(makeMatch(1, { kickoffIso: '2026-03-15T10:00:00Z' }))).toBe('2026-03-15');
  });

  it('falls back to the raw date field when kickoffIso is null', () => {
    expect(toDay(makeMatch(1, { kickoffIso: null, date: '2026-03-16' }))).toBe('2026-03-16');
  });

  it('returns null when neither kickoff nor raw date is parseable', () => {
    expect(toDay(makeMatch(1, { kickoffIso: null, date: 'N/A' }))).toBeNull();
  });
});

