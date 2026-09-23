export type DataFreshnessBadgeProps = { computedAt?: string; staleAfterHours?: number; className?: string };

export function DataFreshnessBadge({ computedAt, staleAfterHours = 24, className = '' }: DataFreshnessBadgeProps) {
  const timestamp = computedAt ? new Date(computedAt).getTime() : Number.NaN;
  const age = Date.now() - timestamp;
  const threshold = Math.max(0, staleAfterHours) * 3_600_000;
  const valid = Number.isFinite(timestamp);
  const stale = valid && age >= threshold;
  const soon = valid && !stale && age >= threshold * 0.75;
  const label = !valid ? 'Frissesség nem ismert' : stale ? 'Elavult' : soon ? 'Hamarosan frissítendő' : 'Friss';
  const tone = !valid ? 'bg-surface-2 text-muted-foreground' : stale ? 'bg-negative-soft text-negative' : soon ? 'bg-warning-soft text-warning' : 'bg-positive-soft text-positive';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone} ${className}`} aria-label={`Adatfrissesség: ${label}`}>{label}</span>;
}
