import { useAddon } from '../../context';
import { useT } from '../../i18n';
import { useStat } from '../../lib/api';
import { fmtMs, fmtNum, fmtPct } from '../../lib/format';
import { BarChart, Donut, HBars, SegBar, colorAt } from '../../components/charts';
import { Badge, Card, Empty, ErrorBox, Loading, Stat } from '../../components/ui';
import type { PageProps } from './types';

const pctOf = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

function ProxyTable({ rows }: { rows: any[] }) {
  const { lang } = useAddon();
  const t = useT();
  if (!rows.length) return <div className="empty text-xs">{t('pool.notEnough')}</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>{t('pool.proxy')}</th><th>{t('pool.provider')}</th><th className="num">{t('pool.successRate')}</th><th className="num">{t('overview.latency')}</th><th className="num">{t('pool.tests')}</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="mono">{r.protocol}://{r.ip}:{r.port} <span className="text-muted">{r.country ?? ''}</span></td>
              <td>{r.provider ?? '—'}</td>
              <td className="num">{fmtPct(r.successPct, lang, 1)}</td>
              <td className="num">{fmtMs(r.latencyMs, lang)}</td>
              <td className="num">{fmtNum(r.successCount + r.failureCount, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pool de proxies amont : santé, fournisseurs, protocoles, pays, latences, ancienneté des tests. */
export default function Pool({ nonce }: PageProps) {
  const { token, lang } = useAddon();
  const t = useT();
  const res = useStat<any>(token, 'pool', {}, { nonce });

  if (res.loading && !res.data) return <Loading />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;
  const d = res.data;
  if (!d) return <Empty />;
  const s = d.status;
  const live = s.total - s.archived;
  const n = (x: number) => fmtNum(x, lang);
  const lat = d.latency;
  const ag = d.ageing;

  return (
    <div className="space-y-4">
      <div className="stat-grid">
        <Stat label={t('pool.working')} value={n(s.working)} sub={`${fmtPct(pctOf(s.working, live), lang, 1)} ${t('pool.ofTestable')}`} tone={s.working === 0 ? 'bad' : 'good'} />
        <Stat label={t('pool.dead')} value={n(s.dead)} sub={t('pool.deadHint')} />
        <Stat label={t('pool.blacklisted')} value={n(s.blacklisted)} />
        <Stat label={t('pool.archived')} value={n(s.archived)} sub={t('pool.archivedHint')} />
        <Stat label={t('overview.latency')} value={fmtMs(s.avgLatencyMs, lang)} sub={`${t('pool.median')} ${fmtMs(s.medianLatencyMs, lang)}`} />
        <Stat label={t('pool.successRate')} value={fmtPct(pctOf(s.successes, s.successes + s.failures), lang, 1)} sub={`${fmtNum(s.successes + s.failures, lang)} ${t('pool.tests')}`} />
        <Stat label={t('pool.countries')} value={n(s.countries)} sub={`${s.providers} ${t('pool.providers')}`} />
        <Stat label={t('pool.inUse')} value={n(d.inUse.proxies)} sub={`${d.inUse.connections} ${t('pool.tunnels')}`} />
      </div>

      <Card title={t('overview.poolStatus')}>
        <SegBar
          fmt={n}
          slices={[
            { label: t('pool.working'), value: s.working, color: 'var(--green)' },
            { label: t('pool.dead'), value: s.dead, color: 'var(--red)' },
            { label: t('pool.blacklisted'), value: s.blacklisted, color: '#f59e0b' },
            { label: t('pool.archived'), value: s.archived, color: '#64748b' },
          ]}
        />
      </Card>

      <div className="grid cols-2">
        <Card title={t('pool.latencyDist')}>
          <BarChart
            fmt={n}
            data={[
              { label: '<300', value: lat.lt300 }, { label: '<800', value: lat.lt800 }, { label: '<1.5s', value: lat.lt1500 },
              { label: '<3s', value: lat.lt3000 }, { label: '<5s', value: lat.lt5000 }, { label: '≥5s', value: lat.gte5000, color: 'var(--red)' },
              { label: '?', value: lat.unknown, color: '#64748b' },
            ]}
            color="var(--green)"
          />
        </Card>
        <Card title={t('pool.ageing')}>
          <BarChart
            fmt={n}
            data={[
              { label: '<1h', value: ag.h1 }, { label: '<6h', value: ag.h6 }, { label: '<24h', value: ag.h24 },
              { label: '<7j', value: ag.d7, color: '#f59e0b' }, { label: '>7j', value: ag.older, color: 'var(--red)' },
            ]}
            color="var(--blue)"
          />
          <p className="text-xs text-muted mt-2">{t('pool.ageingHint')}</p>
        </Card>
      </div>

      <Card pad={false} title={t('pool.byProvider')}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t('pool.provider')}</th><th className="num">{t('overview.total')}</th><th className="num">{t('pool.working')}</th><th className="num">{t('pool.yield')}</th><th className="num">{t('pool.blacklisted')}</th><th className="num">{t('overview.latency')}</th><th className="num">{t('pool.successRate')}</th></tr></thead>
            <tbody>
              {d.byProvider.map((p: any) => (
                <tr key={p.provider}>
                  <td className="text-bold">{p.provider}</td>
                  <td className="num">{n(p.total)}</td>
                  <td className="num">{n(p.working)}</td>
                  <td className="num"><Badge tone={pctOf(p.working, p.total) >= 10 ? 'good' : pctOf(p.working, p.total) >= 2 ? 'warn' : 'bad'}>{fmtPct(pctOf(p.working, p.total), lang, 1)}</Badge></td>
                  <td className="num">{n(p.blacklisted)}</td>
                  <td className="num">{fmtMs(p.avgLatencyMs, lang)}</td>
                  <td className="num">{fmtPct(pctOf(p.successes, p.successes + p.failures), lang, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title={t('pool.byProtocol')}>
          <Donut fmt={n} slices={d.byProtocol.map((p: any, i: number) => ({ label: p.protocol.toUpperCase(), value: p.working, color: colorAt(i) }))} />
          <div className="table-wrap mt-3">
            <table className="table">
              <thead><tr><th>{t('pool.protocol')}</th><th className="num">{t('overview.total')}</th><th className="num">{t('pool.working')}</th><th className="num">{t('overview.latency')}</th></tr></thead>
              <tbody>{d.byProtocol.map((p: any) => <tr key={p.protocol}><td>{p.protocol.toUpperCase()}</td><td className="num">{n(p.total)}</td><td className="num">{n(p.working)}</td><td className="num">{fmtMs(p.avgLatencyMs, lang)}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
        <Card title={t('pool.byCountry')}>
          <HBars fmt={n} rows={d.byCountry.filter((c: any) => c.working > 0).slice(0, 15).map((c: any, i: number) => ({ label: c.country, value: c.working, sub: `${fmtMs(c.avgLatencyMs, lang)} · ${n(c.total)} ${t('overview.total').toLowerCase()}`, color: colorAt(i) }))} />
        </Card>
      </div>

      <div className="grid cols-2">
        <Card pad={false} title={t('pool.best')}><ProxyTable rows={d.best} /></Card>
        <Card pad={false} title={t('pool.worst')}><ProxyTable rows={d.worst} /></Card>
      </div>

      {d.inUse.top.length > 0 && (
        <Card title={t('pool.inUseNow')}>
          <HBars fmt={n} rows={d.inUse.top.map((p: any) => ({ label: <span className="mono">{p.protocol}://{p.ip}:{p.port}</span>, value: p.connections, sub: `${p.users.length} ${t('overview.accounts')}${p.pool ? ' · ' + p.pool : ''}` }))} />
        </Card>
      )}

      {d.failDistribution.length > 0 && (
        <Card title={t('pool.failDist')}>
          <BarChart fmt={n} data={d.failDistribution.map((f: any) => ({ label: String(f.fails), value: f.n }))} color="var(--red)" height={110} />
          <p className="text-xs text-muted mt-2">{t('pool.failHint')}</p>
        </Card>
      )}
    </div>
  );
}
