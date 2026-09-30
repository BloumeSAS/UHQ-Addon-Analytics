import { useAddon } from '../../context';
import { useT } from '../../i18n';
import { useStat } from '../../lib/api';
import { fmtDateTime, fmtDuration, fmtMs, fmtNum, fmtPct, timeAgo } from '../../lib/format';
import { AreaChart, BarChart, Donut, HBars, colorAt } from '../../components/charts';
import { Badge, Card, Empty, ErrorBox, Loading, Stat } from '../../components/ui';
import type { PageProps } from './types';
import { useLabels } from '../../i18n/labels';

const pctOf = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

export default function Scraper({ days, nonce }: PageProps) {
  const { token, lang } = useAddon();
  const t = useT();
  const L = useLabels();
  const res = useStat<any>(token, 'scraper', { days }, { nonce });

  if (res.loading && !res.data) return <Loading />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;
  const d = res.data;
  if (!d) return <Empty />;
  const st = d.status;
  const sm = d.summary;
  const n = (x: number) => fmtNum(x, lang);
  const sources: any[] = d.sources;
  const runs: any[] = [...d.runs].reverse();
  const label = (r: any) => fmtDateTime(r.startedAt, lang);
  const failing = sources.filter((s) => s.enabled && s.failCount > 0).length;
  const totalWorking = sources.reduce((x, s) => x + s.working, 0);

  return (
    <div className="space-y-4">
      <div className="stat-grid">
        <Stat
          label={t('checker.state')}
          value={st.running ? <Badge tone="info">{t('checker.running')}</Badge> : st.loopActive ? <Badge tone="good">{t('checker.waiting')}</Badge> : <Badge>{t('checker.off')}</Badge>}
          sub={st.running ? `${st.sourcesDone} / ${st.sourcesTotal} ${t('scraper.sources').toLowerCase()}` : undefined}
        />
        <Stat label={t('checker.lastRun')} value={st.lastRun ? timeAgo(st.lastRun, lang) : '—'} sub={st.lastRun ? `${fmtDuration(st.lastRunDurationMs, lang)} · ${n(st.lastRunCollected)} ${t('scraper.unique')}` : undefined} />
        <Stat label={t('scraper.sources')} value={n(sources.length)} sub={`${sources.filter((s) => s.enabled).length} ${t('scraper.enabled')}`} />
        <Stat label={t('scraper.failing')} value={n(failing)} tone={failing > 0 ? 'warn' : 'good'} sub={t('scraper.failingHint')} />
        <Stat label={t('checker.cycles')} value={n(sm.cycles)} sub={t('checker.inPeriod', { days })} />
        <Stat label={t('scraper.avgUnique')} value={n(Math.round(sm.avgUnique))} sub={`${fmtDuration(sm.avgDurationMs, lang)} / ${t('scraper.cycle')}`} />
        <Stat label={t('scraper.usable')} value={n(totalWorking)} sub={t('scraper.usableHint')} />
      </div>

      <div className="grid cols-2">
        <Card title={t('scraper.yieldBySource')}>
          <HBars
            fmt={n}
            rows={[...sources].filter((s) => s.working > 0).sort((a, b) => b.working - a.working).slice(0, 15).map((s, i) => ({
              label: <span title={s.name}>{s.name}</span>,
              value: s.working,
              sub: `${fmtPct(pctOf(s.working, s.total), lang, 1)} · ${fmtMs(s.avgLatencyMs, lang)}`,
              color: colorAt(i),
            }))}
          />
        </Card>
        <Card title={t('scraper.uniqueByCycle')}>
          {runs.length ? (
            <BarChart fmt={n} data={runs.map((r) => ({ label: '', value: r.processed, tip: `${label(r)} — ${n(r.processed)} ${t('scraper.unique')} (${r.ok} ✓ / ${r.failed} ✗)` }))} height={140} />
          ) : <Empty>{t('checker.noHistory')}</Empty>}
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={t('scraper.sourceHealth')}>
          <Donut
            fmt={n}
            size={130}
            slices={[
              { label: t('scraper.healthy'), value: sources.filter((s) => s.enabled && s.failCount === 0).length, color: 'var(--green)' },
              { label: t('scraper.failing'), value: failing, color: '#f59e0b' },
              { label: t('scraper.disabled'), value: sources.filter((s) => !s.enabled).length, color: 'var(--red)' },
            ]}
          />
        </Card>
        <Card title={t('scraper.failingTop')}>
          <HBars
            fmt={n}
            empty={t('scraper.noFailing')}
            rows={sources.filter((s) => s.failCount > 0).sort((a, b) => b.failCount - a.failCount).slice(0, 10).map((s) => ({ label: s.name, value: s.failCount, sub: s.lastError ? String(s.lastError).slice(0, 40) : undefined, color: 'var(--red)', tip: s.lastError ?? '' }))}
          />
        </Card>
      </div>

      {runs.length > 1 && (
        <div className="grid cols-2">
          <Card title={t('scraper.cyclesFlow')}>
            <AreaChart
              labels={runs.map((r) => r.startedAt)}
              series={[
                { name: t('scraper.collected'), color: '#64748b', values: runs.map((r) => r.extra?.collected ?? 0) },
                { name: t('scraper.unique'), color: 'var(--primary)', values: runs.map((r) => r.processed) },
              ]}
              fmt={n}
              xFmt={(x) => fmtDateTime(x, lang)}
              height={150}
            />
          </Card>
          <Card title={t('scraper.sourcesOkFail')}>
            <AreaChart
              labels={runs.map((r) => r.startedAt)}
              series={[
                { name: '✓', color: 'var(--green)', values: runs.map((r) => r.ok) },
                { name: '✗', color: 'var(--red)', values: runs.map((r) => r.failed) },
              ]}
              stacked
              fmt={n}
              xFmt={(x) => fmtDateTime(x, lang)}
              height={150}
            />
          </Card>
        </div>
      )}

      <Card pad={false} title={t('scraper.sourcesTable')}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('scraper.source')}</th><th>{t('pool.protocol')}</th><th>{t('activity.category')}</th><th>{t('accounts.status')}</th>
                <th className="num">{t('overview.total')}</th><th className="num">{t('pool.working')}</th><th className="num">{t('pool.yield')}</th>
                <th className="num">{t('overview.latency')}</th><th>{t('scraper.lastSuccess')}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="text-bold">{s.name}</td>
                  <td>{s.protocol.toUpperCase()}</td>
                  <td>{s.pool ? <Badge tone="info">{s.pool}</Badge> : <span className="text-muted">—</span>}</td>
                  <td>
                    {!s.enabled ? <Badge tone="bad">{t('scraper.disabled')}</Badge> : s.failCount > 0 ? <Badge tone="warn" title={s.lastError ?? ''}>{t('scraper.failures', { n: s.failCount })}</Badge> : <Badge tone="good">OK</Badge>}
                  </td>
                  <td className="num">{n(s.total)}</td>
                  <td className="num">{n(s.working)}</td>
                  <td className="num">{s.total ? fmtPct(pctOf(s.working, s.total), lang, 1) : '—'}</td>
                  <td className="num">{fmtMs(s.avgLatencyMs, lang)}</td>
                  <td className="text-xs">{s.lastSuccess ? timeAgo(s.lastSuccess, lang) : <span className="text-muted">{t('accounts.never')}</span>}</td>
                </tr>
              ))}
              {!sources.length && <tr><td colSpan={9}><Empty /></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {d.otherProviders.length > 0 && (
        <Card title={t('scraper.otherProviders')}>
          <HBars fmt={n} rows={d.otherProviders.map((p: any, i: number) => ({ label: L.provider(p.provider), value: p.working, sub: `${n(p.total)} ${t('overview.total').toLowerCase()}`, color: colorAt(i + 3) }))} />
        </Card>
      )}

      {runs.length > 0 && (
        <Card pad={false} title={t('checker.history')}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('date')}</th><th className="num">{t('scraper.collected')}</th><th className="num">{t('scraper.unique')}</th><th className="num">{t('scraper.dupes')}</th><th className="num">✓ {t('scraper.sources')}</th><th className="num">✗ {t('scraper.sources')}</th><th className="num">{t('duration')}</th></tr></thead>
              <tbody>
                {d.runs.slice(0, 30).map((r: any) => (
                  <tr key={r.id}>
                    <td>{label(r)}</td><td className="num">{n(r.extra?.collected ?? 0)}</td><td className="num">{n(r.processed)}</td><td className="num">{n(r.extra?.duplicates ?? 0)}</td>
                    <td className="num text-green">{r.ok}</td><td className="num text-red">{r.failed}</td><td className="num">{fmtDuration(r.durationMs, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
