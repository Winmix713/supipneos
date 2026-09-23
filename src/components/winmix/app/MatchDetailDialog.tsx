import type { Probs } from '../../../types/winmix';
import { useEffect, useState } from 'react';
import {
  DECISION_LABEL,
  formatDay,
  LEAGUE_LABEL,
  num,
  pct,
  RECOMMENDATION_LABEL,
  SUFFICIENCY_LABEL,
  type FlatMatch,
} from '../../../lib/winmixView';
import { ConfidenceChip, DecisionChip, OutcomeChip, RecommendationChip } from './Chips';

function ProbBar({ probs }: { probs: Probs }) {
  const parts = [
    { key: 'home', label: 'Hazai', value: probs.home, className: 'bg-signal' },
    { key: 'draw', label: 'Döntetlen', value: probs.draw, className: 'bg-muted-foreground' },
    { key: 'away', label: 'Vendég', value: probs.away, className: 'bg-warning' },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        {parts.map((part) => (
          <div key={part.key} className={part.className} style={{ width: `${part.value * 100}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {parts.map((part) => (
          <div key={part.key} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
            <p className="text-ui-xs uppercase tracking-label text-muted-foreground">{part.label}</p>
            <p className="text-data-base font-semibold tabular-nums">{pct(part.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
      <p className="text-ui-xs uppercase tracking-label text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-ui-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const LEG_LABEL: Record<string, string> = {
  b0: 'B0 — alap prior',
  b1: 'B1 — Poisson',
  m1: 'M1 — regresszió',
  ensRaw: 'Ensemble (nyers)',
  calibrated: 'Kalibrált',
};

export function MatchDetailDialog({
  row,
  open,
  onOpenChange,
}: {
  row: FlatMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const p = row?.pipeline;
  const [tab, setTab] = useState<'odds' | 'model'>('odds');

  useEffect(() => {
    if (open) setTab('odds');
  }, [open, row?.key]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open || !row) return null;

  const tabClass = (value: 'odds' | 'model') =>
    [
      'rounded-md px-3 py-1.5 text-ui-sm font-medium transition-colors',
      tab === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
    ].join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" role="presentation" onClick={() => onOpenChange(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-panel"
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Bezárás"
          className="absolute right-4 top-4 rounded-md px-2 py-1 text-ui-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          ×
        </button>

        <div className="pr-8">
          <h2 className="text-lg font-semibold tracking-tight">
            {row.match.home_team} – {row.match.away_team}
          </h2>
          <p className="mt-1 text-ui-sm text-muted-foreground">
            {LEAGUE_LABEL[row.season.league]} · {row.season.name} · {formatDay(row.day)} · #
            {row.match.match_no}
          </p>
        </div>

        <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-surface-2 px-3 py-1.5 text-data-base font-semibold tabular-nums">
                {row.match.home_score}–{row.match.away_score}
              </span>
              {row.match.ht_home_score !== null && row.match.ht_away_score !== null ? (
                <span className="text-ui-xs text-muted-foreground">
                  félidő {row.match.ht_home_score}–{row.match.ht_away_score}
                </span>
              ) : null}
              {p ? <RecommendationChip value={p.recommendation} /> : null}
              {p ? <ConfidenceChip value={p.confidenceLabel} score={p.confidence} /> : null}
              {p ? <DecisionChip value={p.decision} /> : null}
              <OutcomeChip correct={p?.reconciliation?.isCorrect} />
            </div>
        </div>

        {!p ? (
          <p className="mt-4 rounded-lg border border-border bg-surface-2 p-4 text-ui-sm text-muted-foreground">
            Ehhez a mérkőzéshez nincs publikált modellkimenet.
          </p>
        ) : (
          <div className="mt-4">
            <div className="inline-flex gap-1 rounded-lg bg-surface-2 p-1">
              <button type="button" className={tabClass('odds')} onClick={() => setTab('odds')}>
                Esélyek és piacok
              </button>
              <button type="button" className={tabClass('model')} onClick={() => setTab('model')}>
                Modell-háttér
              </button>
            </div>

            {tab === 'odds' ? (
              <div className="space-y-4 pt-4">
                  <ProbBar probs={p.calibrated} />

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Stat label="Over 2.5" value={pct(p.secondary.over25)} />
                    <Stat label="Mindkét csapat gólt szerez" value={pct(p.secondary.btts)} />
                    <Stat label="Legvalószínűbb eredmény" value={p.secondary.mostLikelyScore} />
                    {typeof p.secondary.over15 === 'number' ? (
                      <Stat label="Over 1.5" value={pct(p.secondary.over15)} />
                    ) : null}
                    {typeof p.secondary.over35 === 'number' ? (
                      <Stat label="Over 3.5" value={pct(p.secondary.over35)} />
                    ) : null}
                    {typeof p.secondary.mostLikelyScoreProb === 'number' ? (
                      <Stat label="Eredmény valószínűsége" value={pct(p.secondary.mostLikelyScoreProb)} />
                    ) : null}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Stat label="Ajánlás" value={RECOMMENDATION_LABEL[p.recommendation]} />
                    <Stat label="Döntési mező" value={DECISION_LABEL[p.decision]} />
                    <Stat label="Adatlefedettség" value={SUFFICIENCY_LABEL[p.context.dataSufficiency]} />
                  </div>

                  {p.caveat ? (
                    <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-ui-sm text-warning">
                      {p.caveat}
                    </p>
                  ) : null}
</div>
            ) : (
              <div className="space-y-4 pt-4">
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-ui-sm">
                      <thead className="bg-surface-2 text-ui-xs uppercase tracking-label text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Modellág</th>
                          <th className="px-3 py-2 text-right font-semibold">Hazai</th>
                          <th className="px-3 py-2 text-right font-semibold">Döntetlen</th>
                          <th className="px-3 py-2 text-right font-semibold">Vendég</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {(['b0', 'b1', 'm1', 'ensRaw', 'calibrated'] as const).map((leg) => (
                          <tr key={leg}>
                            <td className="px-3 py-1.5">{LEG_LABEL[leg]}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{pct(p[leg].home)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{pct(p[leg].draw)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{pct(p[leg].away)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Stat label="Kalibrációs T" value={num(p.calibratedT, 3)} />
                    <Stat label="M1 súly az ensemble-ben" value={pct(p.ensembleWM1)} />
                    <Stat label="M1 forrás" value={p.m1Source === 'fitted' ? 'illesztett' : 'kézi'} />
                    <Stat label="Eltérés a priortól" value={num(p.priorDivergence, 3)} />
                    <Stat label="Brier (ensemble)" value={num(p.reconciliation.brierEns)} />
                    <Stat label="LogLoss (ensemble)" value={num(p.reconciliation.logLossEns)} />
                    <Stat label="Brier (B1)" value={num(p.reconciliation.brierB1)} />
                    <Stat label="LogLoss (B1)" value={num(p.reconciliation.logLossB1)} />
                    <Stat
                      label="Lejátszott meccsek (H/V)"
                      value={`${p.context.homePlayed} / ${p.context.awayPlayed}`}
                    />
                    {p.lambdas ? (
                      <Stat
                        label="Várt gólok (H/V)"
                        value={`${num(p.lambdas.home, 2)} / ${num(p.lambdas.away, 2)}`}
                      />
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-2 text-ui-xs font-semibold uppercase tracking-label text-muted-foreground">
                      Jellemzők
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(p.features).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1.5"
                        >
                          <span className="truncate text-ui-xs text-muted-foreground">{key}</span>
                          <span className="text-ui-xs font-medium tabular-nums">
                            {num(value as number, 3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
