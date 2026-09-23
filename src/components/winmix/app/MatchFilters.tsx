import type { ChangeEvent } from 'react';

import type { ConfidenceLabel, DecisionQuadrant, League, Recommendation, Season } from '../../../types/winmix';
import { cn } from '../../../lib/utils';
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_LEVELS,
  DECISIONS,
  DECISION_LABEL,
  LEAGUE_LABEL,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
  type MatchFilters as Filters,
  emptyFilters,
} from '../../../lib/winmixView';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md border px-2.5 py-1 text-ui-xs font-medium transition-colors',
        active
          ? 'border-signal/60 bg-signal-soft text-signal'
          : 'border-border bg-surface-2 text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-ui-xs font-semibold uppercase tracking-label text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function MatchFilters({
  seasons,
  filters,
  onChange,
  resultCount,
  totalCount,
}: {
  seasons: Season[];
  filters: Filters;
  onChange: (next: Filters) => void;
  resultCount: number;
  totalCount: number;
}) {
  const leagues = [...new Set(seasons.map((s) => s.league))] as League[];
  const visibleSeasons = filters.leagues.length
    ? seasons.filter((s) => filters.leagues.includes(s.league))
    : seasons;

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-panel">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filters.query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => set({ query: e.target.value })}
          placeholder="Csapat vagy szezon keresése"
          className="h-9 rounded-md border border-border bg-surface-2 px-3 text-ui-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-signal/50 w-full max-w-xs"
        />
        <div className="flex items-center gap-2 text-ui-sm text-muted-foreground">
          <label htmlFor="from">Dátumtól</label>
          <input
            id="from"
            type="date"
            value={filters.from}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set({ from: e.target.value })}
            className="h-9 rounded-md border border-border bg-surface-2 px-3 text-ui-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-signal/50 w-[9.5rem]"
          />
          <label htmlFor="to">ig</label>
          <input
            id="to"
            type="date"
            value={filters.to}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set({ to: e.target.value })}
            className="h-9 rounded-md border border-border bg-surface-2 px-3 text-ui-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-signal/50 w-[9.5rem]"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-ui-sm text-muted-foreground">
            {resultCount} / {totalCount} mérkőzés
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...emptyFilters })}
            className="rounded-md px-2.5 py-1.5 text-ui-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Szűrők törlése
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Group label="Liga">
          {leagues.map((league) => (
            <Chip
              key={league}
              active={filters.leagues.includes(league)}
              onClick={() =>
                set({
                  leagues: toggle(filters.leagues, league),
                  seasonIds: [],
                })
              }
            >
              {LEAGUE_LABEL[league]}
            </Chip>
          ))}
        </Group>

        <Group label="Szezon">
          {visibleSeasons.map((season) => (
            <Chip
              key={season.id}
              active={filters.seasonIds.includes(season.id)}
              onClick={() => set({ seasonIds: toggle(filters.seasonIds, season.id) })}
            >
              {season.name}
            </Chip>
          ))}
        </Group>

        <Group label="Ajánlás">
          {RECOMMENDATIONS.map((rec: Recommendation) => (
            <Chip
              key={rec}
              active={filters.recommendations.includes(rec)}
              onClick={() => set({ recommendations: toggle(filters.recommendations, rec) })}
            >
              {RECOMMENDATION_LABEL[rec]}
            </Chip>
          ))}
        </Group>

        <div className="space-y-4">
          <Group label="Magabiztosság">
            {CONFIDENCE_LEVELS.map((level: ConfidenceLabel) => (
              <Chip
                key={level}
                active={filters.confidence.includes(level)}
                onClick={() => set({ confidence: toggle(filters.confidence, level) })}
              >
                {CONFIDENCE_LABEL[level]}
              </Chip>
            ))}
          </Group>
          <Group label="Döntési mező">
            {DECISIONS.map((decision: DecisionQuadrant) => (
              <Chip
                key={decision}
                active={filters.decisions.includes(decision)}
                onClick={() => set({ decisions: toggle(filters.decisions, decision) })}
              >
                {DECISION_LABEL[decision]}
              </Chip>
            ))}
          </Group>
        </div>
      </div>
    </section>
  );
}
