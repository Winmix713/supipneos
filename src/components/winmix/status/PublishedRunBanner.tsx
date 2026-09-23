export type PublishedRunStatus = 'ready' | 'no-run' | 'error' | 'stale' | 'loading';
export type PublishedRunBannerProps = { status: PublishedRunStatus; versionKey?: string; computedAt?: string; matchCount?: number; onRefresh?: () => void; className?: string };

const content: Record<PublishedRunStatus, { title: string; detail: string; tone: string }> = {
  ready: { title: 'Publikált adatok elérhetők', detail: 'A legutóbbi futás eredményei jelennek meg.', tone: 'bg-positive' },
  'no-run': { title: 'Még nincs publikált futás', detail: 'A predikciók az első validált futás után jelennek meg.', tone: 'bg-muted-foreground' },
  error: { title: 'Az adatok nem tölthetők be', detail: 'Próbáld meg frissíteni az adatokat.', tone: 'bg-negative' },
  stale: { title: 'Az adatok frissítésre várnak', detail: 'A megjelenített adatok nem a legújabb futásból származnak.', tone: 'bg-warning' },
  loading: { title: 'Adatok betöltése', detail: 'A publikált futás ellenőrzése folyamatban van.', tone: 'bg-signal' },
};

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function PublishedRunBanner({ status, versionKey, computedAt, matchCount, onRefresh, className = '' }: PublishedRunBannerProps) {
  const item = content[status];
  const date = formatDate(computedAt);
  const canRefresh = (status === 'error' || status === 'stale') && onRefresh;
  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className}`} aria-live="polite" aria-busy={status === 'loading'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`mt-1 size-2.5 shrink-0 rounded-full ${item.tone}`} aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-foreground">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            {status === 'ready' && <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {versionKey && <div><dt className="inline">Verzió: </dt><dd className="inline text-foreground">{versionKey}</dd></div>}
              {date && <div><dt className="inline">Számítva: </dt><dd className="inline text-foreground">{date}</dd></div>}
              {typeof matchCount === 'number' && <div><dt className="inline">Mérkőzések: </dt><dd className="inline text-foreground">{matchCount.toLocaleString('hu-HU')}</dd></div>}
            </dl>}
          </div>
        </div>
        {canRefresh && <button type="button" onClick={onRefresh} className="btn btn--outline btn--sm">Frissítés</button>}
      </div>
    </section>
  );
}
