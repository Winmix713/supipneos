import type { ConfidenceLabel, DecisionQuadrant, Recommendation } from '../../../types/winmix';
import { cn } from '../../../lib/utils';
import {
  CONFIDENCE_LABEL,
  DECISION_LABEL,
  RECOMMENDATION_SHORT,
} from '../../../lib/winmixView';

const base =
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-ui-xs font-medium whitespace-nowrap';

const recTone: Record<Recommendation, string> = {
  HOME_WIN: 'bg-signal-soft text-signal',
  AWAY_WIN: 'bg-warning-soft text-warning',
  DRAW: 'bg-white/[0.07] text-muted-foreground',
  NO_CLEAR_EDGE: 'bg-white/[0.04] text-muted-foreground',
};

const confTone: Record<ConfidenceLabel, string> = {
  High: 'bg-positive-soft text-positive',
  Good: 'bg-signal-soft text-signal',
  Moderate: 'bg-warning-soft text-warning',
  Low: 'bg-white/[0.06] text-muted-foreground',
};

const decisionTone: Record<DecisionQuadrant, string> = {
  actionable: 'bg-positive-soft text-positive',
  volatile: 'bg-warning-soft text-warning',
  flat: 'bg-white/[0.06] text-muted-foreground',
  ignore: 'bg-negative-soft text-negative',
};

export function RecommendationChip({ value }: { value: Recommendation }) {
  return <span className={cn(base, recTone[value])}>{RECOMMENDATION_SHORT[value]}</span>;
}

export function ConfidenceChip({ value, score }: { value: ConfidenceLabel; score?: number }) {
  return (
    <span className={cn(base, confTone[value])}>
      {CONFIDENCE_LABEL[value]}
      {typeof score === 'number' ? <span className="opacity-70">{Math.round(score * 100)}</span> : null}
    </span>
  );
}

export function DecisionChip({ value }: { value: DecisionQuadrant }) {
  return <span className={cn(base, decisionTone[value])}>{DECISION_LABEL[value]}</span>;
}

export function OutcomeChip({ correct }: { correct: boolean | undefined }) {
  if (correct === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn(base, correct ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative')}>
      {correct ? 'Talált' : 'Hibás'}
    </span>
  );
}
