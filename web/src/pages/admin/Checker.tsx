import { useAddon } from '../../context';
import { useT } from '../../i18n';
import { useStat } from '../../lib/api';
import { fmtDateTime, fmtDuration, fmtNum, fmtPct, timeAgo } from '../../lib/format';
import { AreaChart, BarChart } from '../../components/charts';
import { Badge, Card, Empty, ErrorBox, Loading, Stat } from '../../components/ui';
import type { PageProps } from './types';

export default function Checker({ days, nonce }: PageProps) {
  const { token, lang } = useAddon();
  const t = useT();
  const res = useStat<any>(token, 'checker', { days }, { nonce });

  if (res.loading && !res.data) return <Loading />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;
  const d = res.data;
  if (!d) return <Empty />;
  const st = d.status;
  const sm = d.summary;
  const n = (x: number) => fmtNum(x, lang);
  // Les cycles arrivent du plus récent au plus ancien : on les remet dans l'ordre chronologique.
  const runs: any[] = [...d.runs].reverse();
  const label = (r: any) => fmtDateTime(r.startedAt, lang);

  return (
    <div className="space-y-4">
      <div className="stat-grid">
        <Stat
          label={t('checker.state')}
          value={st.running ? <Badge tone="info">{t('checker.running')}</Badge> : st.loopActive ? <Badge tone="good">{t('checker.waiting')}</Badge> : <Badge>{t('checker.off')}</Badge>}
          sub={st.running ? `${n(st.processed)} / ${n(st.total)} (${st.progress} %)` : undefined}
        />
        <Stat label={t('checker.lastRun')} value={st.lastRun ? timeAgo(st.lastRun, lang) : '—'} sub={st.lastRun ? `${fmtDuration(st.lastRunDurationMs, lang)} · ${n(st.lastRunProcessed)} ${t('checker.tested')}` : undefined} />
        <Stat label={t('checker.interval')} value={fmtDuration(d.intervalSec * 1000, lang)} sub={t('checker.intervalHint')} />
        <Stat label={t('checker.cycles')} value={n(sm.cycles)} sub={t('checker.inPeriod', { days })} />
        <Stat label={t('checker.avgDuration')} value={fmtDuration(sm.avgDurationMs, lang)} sub={`max ${fmtDuration(sm.maxDurationMs, lang)}`} />
        <Stat label={t('checker.aliveRate')} value={sm.alivePct === null ? '—' : fmtPct(sm.alivePct, lang, 1)} sub={`${n(sm.alive)} / ${n(sm.tested)}`} />
      </div>

      {st.running && (
        <Card title={t('checker.progress')}>
          <div className="segbar"><div style={{ width: `${st.progress}%`, background: 'var(--primary)' }} /></div>
        </Card>
      )}

      <Card title={t('checker.health')}>
        {d.health.length ? (
          <AreaChart
            labels={d.health.map((h: any) => h.createdAt)}
            series={[
              { name: t('pool.working'), color: 'var(--green)', values: d.health.map((h: any) => h.working) },
              { name: t('pool.dead'), color: 'var(--red)', values: d.health.map((h: any) => h.dead) },
            ]}
            fmt={n}
            xFmt={(x) => fmtDateTime(x, lang)}
          />
        ) : <Empty />}
      </Card>

      {runs.length > 0 ? (
        <>
          <div className="grid cols-2">
            <Card title={t('checker.aliveByCycle')}>
              <BarChart
                fmt={(v) => fmtPct(v, lang, 1)}
                data={runs.map((r) => ({ label: '', value: r.processed ? (r.ok / r.processed) * 100 : 0, tip: `${label(r)} — ${fmtPct(r.processed ? (r.ok / r.processed) * 100 : 0, lang, 1)} (${n(r.ok)}/${n(r.processed)})` }))}
                color="var(--green)"
                height={120}
              />
            </Card>
            <Card title={t('checker.durationByCycle')}>
              <BarChart
                fmt={(v) => fmtDuration(v, lang)}
                data={runs.map((r) => ({ label: '', value: r.durationMs, tip: `${label(r)} — ${fmtDuration(r.durationMs, lang)}` }))}
                color="var(--blue)"
                height={120}
              />
            </Card>
          </div>
          <Card pad={false} title={t('checker.history')}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('date')}</th><th className="num">{t('checker.tested')}</th><th className="num">{t('pool.working')}</th><th className="num">{t('pool.dead')}</th><th className="num">{t('checker.aliveRate')}</th><th className="num">{t('duration')}</th></tr></thead>
                <tbody>
                  {d.runs.slice(0, 30).map((r: any) => (
                    <tr key={r.id}>
                      <td>{label(r)}</td><td className="num">{n(r.processed)}</td><td className="num text-green">{n(r.ok)}</td><td className="num text-red">{n(r.failed)}</td>
                      <td className="num">{fmtPct(r.processed ? (r.ok / r.processed) * 100 : 0, lang, 1)}</td><td className="num">{fmtDuration(r.durationMs, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card><Empty>{t('checker.noHistory')}</Empty></Card>
      )}
    </div>
  );
}
