import { useMemo } from 'react';

import type { CalibrationMap, Season } from '../../../types/winmix';
import type { PublishedManifest } from '../../../utils/publishedRun';
import { MetricCard } from '../MetricCard';
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_LEVELS,
  LEAGUE_LABEL,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
  flattenSeasons,
  num,
  pct,
  summarise,
} from '../../../lib/winmixView';

/** Read-only overview of the single published run. */
export interface PublishedOverviewData {
  manifest: PublishedManifest;
  seasons: Season[];
  calibration: CalibrationMap;
}

export function OverviewDashboard({ run }: { run: PublishedOverviewData }) {
  const rows = useMemo(() => flattenSeasons(run.seasons), [run.seasons]);
  const stats = useMemo(() => summarise(rows), [rows]);
  const manifest = run.manifest;
  const summary = manifest.result_summary;

  const publishedAt = new Date(manifest.computed_at);
  const publishedLabel = Number.isNaN(publishedAt.getTime())
    ? manifest.computed_at
    : publishedAt.toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Publikált mérkőzések"
          value={manifest.match_count.toLocaleString('hu-HU')}
          sub={`${manifest.season_count} szezon`}
          tone="signal"
        />
        <MetricCard
          label="Találati arány"
          value={pct(stats.hitRate, 1)}
          sub={`${stats.correct} / ${stats.withPipeline} előrejelzés`}
          tone={stats.hitRate !== null && stats.hitRate >= 0.5 ? 'positive' : 'neutral'}
          interval="a publikált futás tárolt kiértékelése"
        />
        <MetricCard
          label="Használható jelzések"
          value={stats.actionable.toLocaleString('hu-HU')}
          sub={`${stats.highConfidence} magas magabiztosságú`}
          tone="positive"
        />
        <MetricCard
          label="Átlagos gólszám"
          value={num(stats.avgGoals, 2)}
          sub={`BTTS ${pct(stats.bttsRate, 0)}`}
          tone="neutral"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 shadow-panel lg:col-span-2">
          <h2 className="text-ui-base font-semibold">Ligák lefedettsége</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(['angol', 'spanyol'] as const).map((league) => {
              const coverage = manifest.league_coverage[league];
              const calibration = run.calibration[league];
              return (
                <div key={league} className="rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-ui-sm font-semibold">{LEAGUE_LABEL[league]}</p>
                  <dl className="mt-2 space-y-1 text-ui-sm text-muted-foreground">
                    <Row label="Szezonok" value={String(coverage.seasons)} />
                    <Row label="Mérkőzések" value={coverage.matches.toLocaleString('hu-HU')} />
                    <Row label="Kalibrációs T" value={num(calibration?.T, 3)} />
                    <Row label="ECE" value={num(calibration?.ece ?? null, 4)} />
                  </dl>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-panel">
          <h2 className="text-ui-base font-semibold">Ajánlások megoszlása</h2>
          <ul className="mt-3 space-y-2">
            {RECOMMENDATIONS.map((rec) => {
              const count = stats.byRecommendation.get(rec) ?? 0;
              const share = stats.withPipeline ? count / stats.withPipeline : 0;
              return (
                <li key={rec}>
                  <div className="flex items-center justify-between text-ui-sm">
                    <span>{RECOMMENDATION_LABEL[rec]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {count} · {pct(share, 0)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-signal" style={{ width: `${share * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 shadow-panel">
          <h2 className="text-ui-base font-semibold">Magabiztossági szintek</h2>
          <ul className="mt-3 space-y-1.5 text-ui-sm">
            {CONFIDENCE_LEVELS.map((level) => {
              const count = rows.filter((r) => r.pipeline?.confidenceLabel === level).length;
              return (
                <li key={level} className="flex items-center justify-between">
                  <span>{CONFIDENCE_LABEL[level]}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-panel lg:col-span-2">
          <h2 className="text-ui-base font-semibold">Publikált futás</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-ui-sm sm:grid-cols-2">
            <Row label="Publikálva" value={publishedLabel} />
            <Row label="Modellverzió" value={summary.modelVersion} />
            <Row label="Jellemzősémás verzió" value={String(summary.featureSchemaVersion)} />
            <Row label="Pipeline-szerződés" value={String(summary.pipelineContractVersion)} />
            <Row label="Előrejelzések" value={summary.predictions.toLocaleString('hu-HU')} />
            <Row label="Forrásmérkőzések" value={summary.sourceMatches.toLocaleString('hu-HU')} />
            <Row label="Előzményhatókör" value={summary.parameters.historyScope} />
            <Row label="Futás azonosító" value={manifest.run_id} />
          </dl>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}
