import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWinmixEngine } from '../hooks/useWinmixEngine';
const mocks = vi.hoisted(() => ({ load: vi.fn(), persisted: vi.fn(), pipeline: vi.fn() }));
vi.mock('../utils/publishedRun', () => ({ PUBLISHED_RUN_MODE: true, loadPublishedRun: mocks.load }));
vi.mock('../contexts/DialogContext', () => ({ useDialogs: () => ({ alert: vi.fn(), confirm: vi.fn() }) }));
vi.mock('../utils/pipelineRunner', () => ({ runLeaguePipeline: mocks.pipeline }));
vi.mock('../utils/storage', async original => ({ ...await original<typeof import('../utils/storage')>(), loadPersistedState: mocks.persisted }));
const fixture = {
  manifest: { run_id: 'published-run', version_key: 'test', match_count: 1 },
  seasons: [{ id: 's1', league: 'angol', seasonIndex: 1, matches: [], actualMatchCount: 0 }],
  teamWeights: { angol: {}, spanyol: {} }, teamAliasMap: { angol: {}, spanyol: {} },
  seasonCounters: { angol: 1, spanyol: 0 },
  calibration: { angol: { T: 1, history: [] }, spanyol: { T: 1, history: [] } },
  parameters: { historyScope: 'season-only', experiments: { dixonColes: false, glicko2: false } },
};
beforeEach(() => vi.clearAllMocks());
describe('production startup', () => {
  it('does not restore legacy history or run a browser pipeline when no published run exists', async () => {
    mocks.load.mockResolvedValue(null);
    const { result } = renderHook(() => useWinmixEngine());
    await waitFor(() => expect(result.current.publishedStatus).toBe('no-run'));
    expect(result.current.isReady).toBe(true);
    expect(mocks.persisted).not.toHaveBeenCalled(); expect(mocks.pipeline).not.toHaveBeenCalled();
  });
  it('retains the last verified snapshot on refresh failure', async () => {
    mocks.load.mockResolvedValueOnce(fixture).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useWinmixEngine());
    await waitFor(() => expect(result.current.publishedStatus).toBe('ready'));
    await act(() => result.current.refreshPublishedRun());
    expect(result.current.publishedStatus).toBe('stale');
    expect(result.current.publishedRun?.run_id).toBe('published-run');
    expect(result.current.seasons).toEqual(fixture.seasons);
  });
  it('blocks import and weight mutations without changing the published snapshot', async () => {
    mocks.load.mockResolvedValue(fixture);
    const { result } = renderHook(() => useWinmixEngine());
    await waitFor(() => expect(result.current.publishedStatus).toBe('ready'));
    await act(async () => {
      await result.current.importFiles([new File(['bad'], 'local.csv')], 'angol');
      await result.current.setWeight('angol', 'arsenal', 9);
      await result.current.clearAll();
    });
    expect(result.current.seasons).toEqual(fixture.seasons);
    expect(result.current.teamWeights.angol).toEqual({});
    expect(mocks.pipeline).not.toHaveBeenCalled();
  });
});
