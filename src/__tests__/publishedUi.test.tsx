import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchesPanel } from '../components/winmix/app/MatchesPanel';
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
      over15: 0.7, over35: 0.3, mostLikelyScoreProb: 0.12,
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
    pipeline: makePipeline(),
    ...overrides,
  };
}

/** Build N matches with distinct team names so search is testable. */
function makeMatches(count: number): MatchRow[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return makeMatch(n, {
      home_team: `TeamH${n}`,
      away_team: `TeamA${n}`,
      date: `2026-0${Math.ceil(n / 30)}-${String(((n - 1) % 30) + 1).padStart(2, '0')}`,
      kickoffIso: `2026-0${Math.ceil(n / 30)}-${String(((n - 1) % 30) + 1).padStart(2, '0')}T15:00:00Z`,
    });
  });
}

function makeSeason(matches: MatchRow[]): Season {
  return {
    id: 's-eng-2026',
    league: 'angol',
    seasonIndex: 1,
    name: 'Angol 2026',
    fileName: 'eng.csv',
    createdAt: '2026-01-01',
    contentHash: null,
    countWarning: false,
    actualMatchCount: matches.length,
    orderMode: 'chronological',
    datedMatchCount: matches.length,
    matches,
  };
}

describe('MatchesPanel', () => {
  it('renders all matches when fewer than the 60-row page limit', () => {
    const season = makeSeason(makeMatches(5));
    render(<MatchesPanel seasons={[season]} />);
    expect(screen.getByText('5 / 5 mérkőzés')).toBeInTheDocument();
    expect(screen.queryByText(/További/)).not.toBeInTheDocument();
  });

  it('caps the initial list at 60 rows and shows the load-more button', () => {
    const season = makeSeason(makeMatches(80));
    render(<MatchesPanel seasons={[season]} />);
    expect(screen.getByText('80 / 80 mérkőzés')).toBeInTheDocument();
    expect(screen.getByText(/További 20 mérkőzés/)).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    const rowButtons = buttons.filter((b) => b.textContent?.includes('TeamH'));
    expect(rowButtons).toHaveLength(60);
  });

  it('loads the next page when the load-more button is clicked', async () => {
    const user = userEvent.setup();
    const season = makeSeason(makeMatches(80));
    render(<MatchesPanel seasons={[season]} />);
    await user.click(screen.getByText(/További 20 mérkőzés/));
    expect(screen.queryByText(/További/)).not.toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    const rowButtons = buttons.filter((b) => b.textContent?.includes('TeamH'));
    expect(rowButtons).toHaveLength(80);
  });

  it('filters by team name search', async () => {
    const user = userEvent.setup();
    const matches = [
      makeMatch(1, { home_team: 'Arsenal', away_team: 'Chelsea' }),
      makeMatch(2, { home_team: 'Liverpool', away_team: 'Everton' }),
    ];
    render(<MatchesPanel seasons={[makeSeason(matches)]} />);
    expect(screen.getByText('2 / 2 mérkőzés')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Csapat vagy szezon keresése'), 'Arsenal');
    expect(screen.getByText('1 / 2 mérkőzés')).toBeInTheDocument();
  });

  it('toggles a league filter chip and narrows results', async () => {
    const user = userEvent.setup();
    const seasons: Season[] = [
      makeSeason([
        makeMatch(1, { home_team: 'Arsenal', away_team: 'Chelsea' }),
      ]),
      {
        ...makeSeason([]),
        id: 's-esp-2026',
        league: 'spanyol',
        name: 'Spanyol 2026',
        matches: [
          makeMatch(1, { home_team: 'Barcelona', away_team: 'Real Madrid', date: '2026-02-01', kickoffIso: '2026-02-01T15:00:00Z' }),
        ],
        actualMatchCount: 1,
        datedMatchCount: 1,
      },
    ];
    render(<MatchesPanel seasons={seasons} />);
    expect(screen.getByText('2 / 2 mérkőzés')).toBeInTheDocument();
    await user.click(screen.getByText('Spanyol liga'));
    expect(screen.getByText('1 / 2 mérkőzés')).toBeInTheDocument();
  });

  it('clears all filters with the clear button', async () => {
    const user = userEvent.setup();
    const seasons: Season[] = [
      makeSeason([
        makeMatch(1, { home_team: 'Arsenal', away_team: 'Chelsea' }),
      ]),
      {
        ...makeSeason([]),
        id: 's-esp-2026',
        league: 'spanyol',
        name: 'Spanyol 2026',
        matches: [
          makeMatch(1, { home_team: 'Barcelona', away_team: 'Real Madrid', date: '2026-02-01', kickoffIso: '2026-02-01T15:00:00Z' }),
        ],
        actualMatchCount: 1,
        datedMatchCount: 1,
      },
    ];
    render(<MatchesPanel seasons={seasons} />);
    await user.click(screen.getByText('Spanyol liga'));
    expect(screen.getByText('1 / 2 mérkőzés')).toBeInTheDocument();
    await user.click(screen.getByText('Szűrők törlése'));
    expect(screen.getByText('2 / 2 mérkőzés')).toBeInTheDocument();
  });

  it('shows the empty state when no matches match the filters', async () => {
    const user = userEvent.setup();
    const season = makeSeason(makeMatches(2));
    render(<MatchesPanel seasons={[season]} />);
    await user.type(screen.getByPlaceholderText('Csapat vagy szezon keresése'), 'NonExistentTeam');
    expect(screen.getByText('Nincs a szűrőknek megfelelő mérkőzés')).toBeInTheDocument();
  });

  it('opens the detail dialog when a match row is clicked', async () => {
    const user = userEvent.setup();
    const matches = [
      makeMatch(1, { home_team: 'Arsenal', away_team: 'Chelsea' }),
    ];
    render(<MatchesPanel seasons={[makeSeason(matches)]} />);
    await user.click(screen.getByText('Arsenal'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Arsenal – Chelsea')).toBeInTheDocument();
  });

  it('closes the detail dialog when the close button is clicked', async () => {
    const user = userEvent.setup();
    const matches = [
      makeMatch(1, { home_team: 'Arsenal', away_team: 'Chelsea' }),
    ];
    render(<MatchesPanel seasons={[makeSeason(matches)]} />);
    await user.click(screen.getByText('Arsenal'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Bezárás'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

