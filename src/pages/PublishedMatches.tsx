import { MatchesPanel } from '../components/winmix/app/MatchesPanel';
import { EmptyState, ErrorState, LoadingState } from '../components/winmix/app/StateNotice';
import { useWinmix } from '../contexts/WinmixContext';

/** Read-only browser for matches belonging to the currently promoted run. */
export function PublishedMatches() {
  const { seasons, publishedRun, publishedStatus, publishedError } = useWinmix();
  if (publishedStatus === 'loading') return <LoadingState rows={10} />;
  if (publishedStatus === 'error' || publishedStatus === 'stale') {
    return <ErrorState message={publishedError ?? 'A publikált mérkőzések most nem tölthetők be.'} />;
  }
  if (!publishedRun || seasons.length === 0) {
    return <EmptyState title="Nincs megjeleníthető mérkőzés" hint="A lista a következő publikált motorfutás után lesz elérhető." />;
  }
  return <MatchesPanel seasons={seasons} />;
}
