import { describe, expect, it, vi } from 'vitest';

vi.mock('../utils/forecastCore', () => ({
  FORECAST_MODEL_VERSION: 'winmix-forecast-3.1.1',
}));
vi.mock('../utils/storage', () => ({
  emptyAliases: () => ({ angol: {}, spanyol: {} }),
  emptyCalibration: () => ({ angol: { T: 1, history: [], ece: null, lastComputedAt: null }, spanyol: { T: 1, history: [], ece: null, lastComputedAt: null } }),
  emptyCounters: () => ({ angol: 0, spanyol: 0 }),
  emptyWeights: () => ({ angol: {}, spanyol: {} }),
}));

import { PublishedManifestSchema } from '../utils/publishedRun';
import { FEATURE_SCHEMA_VERSION, PIPELINE_CONTRACT_VERSION } from '../utils/constants';

const MOCK_MODEL_VERSION = 'winmix-forecast-3.1.1';

function validManifest() {
  return {
    run_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    data_version_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    version_key: 'test-key',
    content_fingerprint: 'fixture-fingerprint',
    computed_at: '2026-01-03T12:00:00Z',
    match_count: 4,
    season_count: 2,
    league_coverage: {
      angol: { seasons: 1, matches: 2 },
      spanyol: { seasons: 1, matches: 2 },
    },
    result_summary: {
      modelVersion: MOCK_MODEL_VERSION,
      featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      pipelineContractVersion: PIPELINE_CONTRACT_VERSION,
      predictions: 4,
      featureRows: 4,
      sourceMatches: 4,
      inputFingerprint: 'input-fp',
      parameters: {
        historyScope: 'season-only',
        experiments: { dixonColes: false, glicko2: false },
      },
      calibration: {
        angol: {
          state: {
            T: 1.05,
            history: [{ fittedAtMatchIndex: 24, T: 1.1, ece: 0.03, sampleSize: 24 }],
            ece: 0.03,
            lastComputedAt: '2026-01-02T10:00:00Z',
          },
        },
        spanyol: {
          state: {
            T: 1.0,
            history: [{ fittedAtMatchIndex: 24, T: 1.0, ece: 0.02, sampleSize: 24 }],
            ece: 0.02,
            lastComputedAt: '2026-01-02T10:00:00Z',
          },
        },
      },
    },
  };
}

describe('PublishedManifestSchema', () => {
  it('accepts a valid manifest', () => {
    const result = PublishedManifestSchema.safeParse(validManifest());
    expect(result.success).toBe(true);
  });

  it('rejects an invalid run_id (not a UUID)', () => {
    const m = validManifest();
    m.run_id = 'not-a-uuid';
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects an invalid data_version_id (not a UUID)', () => {
    const m = validManifest();
    m.data_version_id = 'also-not-a-uuid';
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects a wrong model version', () => {
    const m = validManifest();
    (m.result_summary as any).modelVersion = 'wrong-version';
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects a wrong feature schema version', () => {
    const m = validManifest();
    (m.result_summary as any).featureSchemaVersion = 999;
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects a wrong pipeline contract version', () => {
    const m = validManifest();
    (m.result_summary as any).pipelineContractVersion = 999;
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects when league_coverage is missing a league', () => {
    const m = validManifest();
    delete (m.league_coverage as any).spanyol;
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects when match_count is zero', () => {
    const m = validManifest();
    m.match_count = 0;
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects when season_count is zero', () => {
    const m = validManifest();
    m.season_count = 0;
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects an invalid historyScope', () => {
    const m = validManifest();
    (m.result_summary as any).parameters.historyScope = 'invalid-scope';
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects an empty content_fingerprint', () => {
    const m = validManifest();
    m.content_fingerprint = '';
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });

  it('rejects a missing parameters field', () => {
    const m = validManifest();
    delete (m.result_summary as any).parameters;
    expect(PublishedManifestSchema.safeParse(m).success).toBe(false);
  });
});
