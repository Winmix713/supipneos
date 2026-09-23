function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 ${className ?? ''}`} />;
}

export function LoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-negative/40 bg-negative-soft p-6">
      <h2 className="text-base font-semibold text-foreground">Az adatok nem tölthetők be</h2>
      <p className="mt-2 max-w-2xl text-ui-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <p className="text-base font-medium">{title}</p>
      {hint ? <p className="mt-2 text-ui-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
