import { useMemo, useState } from 'react';

import type { Season } from '../../../types/winmix';
import {
  emptyFilters,
  filterMatches,
  flattenSeasons,
  sortMatches,
  type FlatMatch,
  type MatchFilters as Filters,
} from '../../../lib/winmixView';
import { MatchDetailDialog } from './MatchDetailDialog';
import { MatchFilters } from './MatchFilters';
import { MatchListTable } from './MatchListTable';
import { EmptyState } from './StateNotice';

const PAGE_SIZE = 60;

/** Filters + compact list + detail dialog, driven entirely by published data. */
export function MatchesPanel({ seasons }: { seasons: Season[] }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<FlatMatch | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const all = useMemo(() => sortMatches(flattenSeasons(seasons)), [seasons]);
  const filtered = useMemo(() => filterMatches(all, filters), [all, filters]);
  const visible = filtered.slice(0, limit);

  return (
    <div className="space-y-4">
      <MatchFilters
        seasons={seasons}
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setLimit(PAGE_SIZE);
        }}
        resultCount={filtered.length}
        totalCount={all.length}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="Nincs a szűrőknek megfelelő mérkőzés"
          hint="Lazíts a dátumtartományon, a ligán vagy az ajánlás szűrőn."
        />
      ) : (
        <>
          <MatchListTable rows={visible} selectedKey={selected?.key} onSelect={setSelected} />
          {visible.length < filtered.length ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="rounded-md border border-border bg-surface-2 px-4 py-2 text-ui-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                További {Math.min(PAGE_SIZE, filtered.length - visible.length)} mérkőzés
              </button>
            </div>
          ) : null}
        </>
      )}

      <MatchDetailDialog
        row={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
