import type { HTMLAttributes } from 'react';

export type ColdStartNoticeProps = HTMLAttributes<HTMLDivElement> & {
  teamName: string;
  matchesObserved: number;
  threshold?: number;
};

/** Visible only while a newly introduced team is still building its own sample. */
export function ColdStartNotice({ teamName, matchesObserved, threshold = 10, className = '', ...props }: ColdStartNoticeProps) {
  if (matchesObserved >= threshold) return null;
  return (
    <aside className={`rounded-xl border border-border bg-warning-soft p-4 text-warning ${className}`} aria-live="polite" {...props}>
      <p className="font-semibold">Kezdeti minta</p>
      <p className="mt-1 text-sm text-muted-foreground">
        A(z) {teamName} új csapatként még csak {matchesObserved} mérkőzés alapján szerepel, ezért a predikció mérsékeltebb bizalmú.
      </p>
    </aside>
  );
}
