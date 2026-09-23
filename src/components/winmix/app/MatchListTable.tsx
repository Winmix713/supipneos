import { cn } from '../../../lib/utils';
import { formatDay, LEAGUE_LABEL, pct, type FlatMatch } from '../../../lib/winmixView';
import { ConfidenceChip, DecisionChip, OutcomeChip, RecommendationChip } from './Chips';

/**
 * Compact, scannable match rows. Pure presentation over already-published
 * values — nothing is recomputed here.
 */
export function MatchListTable({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: FlatMatch[];
  selectedKey?: string | null;
  onSelect: (row: FlatMatch) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-panel">
      <div className="hidden grid-cols-[6.5rem_1fr_5rem_9rem_8rem_7rem_5rem] gap-3 border-b border-border/70 px-4 py-2 text-ui-xs font-semibold uppercase tracking-label text-muted-foreground lg:grid">
        <span>Dátum</span>
        <span>Mérkőzés</span>
        <span className="text-center">Eredmény</span>
        <span>Ajánlás</span>
        <span>Magabiztosság</span>
        <span>Döntés</span>
        <span className="text-right">Talált</span>
      </div>

      <ul className="divide-y divide-border/60">
        {rows.map((row) => {
          const p = row.pipeline;
          const active = selectedKey === row.key;
          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onSelect(row)}
                className={cn(
                  'grid w-full grid-cols-1 gap-2 px-4 py-2.5 text-left transition-colors hover:bg-accent/60 lg:grid-cols-[6.5rem_1fr_5rem_9rem_8rem_7rem_5rem] lg:items-center lg:gap-3',
                  active && 'bg-accent',
                )}
              >
                <span className="text-ui-xs text-muted-foreground">
                  {formatDay(row.day, `#${row.match.match_no}`)}
                  <span className="block truncate opacity-70">
                    {LEAGUE_LABEL[row.season.league]} · {row.season.name}
                  </span>
                </span>

                <span className="min-w-0 text-ui-sm font-medium">
                  <span className="truncate">{row.match.home_team}</span>
                  <span className="px-1.5 text-muted-foreground">–</span>
                  <span className="truncate">{row.match.away_team}</span>
                  {p ? (
                    <span className="ml-2 text-ui-xs text-muted-foreground">
                      {pct(p.calibrated.home, 0)} / {pct(p.calibrated.draw, 0)} / {pct(p.calibrated.away, 0)}
                    </span>
                  ) : null}
                </span>

                <span className="text-center text-data-sm font-semibold tabular-nums">
                  {row.match.home_score}–{row.match.away_score}
                </span>

                <span>{p ? <RecommendationChip value={p.recommendation} /> : <Dash />}</span>
                <span>{p ? <ConfidenceChip value={p.confidenceLabel} score={p.confidence} /> : <Dash />}</span>
                <span>{p ? <DecisionChip value={p.decision} /> : <Dash />}</span>
                <span className="lg:text-right">
                  <OutcomeChip correct={p?.reconciliation?.isCorrect} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Dash() {
  return <span className="text-ui-xs text-muted-foreground">—</span>;
}
