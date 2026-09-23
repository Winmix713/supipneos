import { OverviewDashboard, type PublishedOverviewData } from '../components/winmix/app/OverviewDashboard';
import { EmptyState, ErrorState, LoadingState } from '../components/winmix/app/StateNotice';
import { DataFreshnessBadge, PublishedRunBanner } from '../components/winmix/status';
import { useWinmix } from '../contexts/WinmixContext';

/** Public, read-only summary of the one promoted engine run. */
export function PublishedOverview() {
  const { seasons, calibration, publishedRun, publishedStatus, publishedError, refreshPublishedRun } = useWinmix();

  if (publishedStatus === 'loading') return <LoadingState />;
  if (publishedStatus === 'error' || publishedStatus === 'stale') {
    return <ErrorState message={publishedError ?? 'A publikált eredmények most nem tölthetők be.'} />;
  }
  if (!publishedRun) {
    return (
      <EmptyState
        title="Nincs publikált futás"
        hint="Az eredmények az első sikeres, validált motorfutás publikálása után jelennek meg."
      />
    );
  }

  const run: PublishedOverviewData = { manifest: publishedRun, seasons, calibration };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataFreshnessBadge computedAt={publishedRun.computed_at} />
        <button type="button" className="btn btn--outline btn--sm" onClick={() => void refreshPublishedRun()}>Eredmények frissítése</button>
      </div>
      <PublishedRunBanner status="ready" versionKey={publishedRun.version_key} computedAt={publishedRun.computed_at} matchCount={publishedRun.match_count} />
      <OverviewDashboard run={run} />
    </div>
  );
}
