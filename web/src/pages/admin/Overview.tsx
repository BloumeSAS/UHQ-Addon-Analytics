import { useAddon } from '../../context';
import { useT } from '../../i18n';
import { useStat } from '../../lib/api';
import { deltaPct, fmtBytes, fmtDay, fmtMs, fmtNum, fmtRate, gbUnit } from '../../lib/format';
import { AreaChart, Donut, HBars, SegBar, colorAt } from '../../components/charts';
import { Card, Empty, ErrorBox, Loading, Stat } from '../../components/ui';
import type { PageProps } from './types';

const LEVEL_ICON: Record<string, string> = { crit: '⛔', warn: '⚠️', info: 'ℹ️', ok: '✅' };

export default function Overview({ days, nonce }: PageProps) {
  const { token, lang, tz } = useAddon();
  const t = useT();
  const ov = useStat<any>(token, 'overview', { days }, { nonce });
  const ins = useStat<any[]>(token, 'insights', { days, tz }, { nonce });

  if (ov.loading && !ov.data) return <Loading />;
  if (ov.error) return <ErrorBox message={ov.error} onRetry={ov.reload} />;
  const d = ov.data;
  if (!d) return <Empty />;

  const tr = d.traffic;
  const a = d.accounts;
  const p = d.pool;
  const vsPrev = deltaPct(tr.total, tr.previous?.bytes);
  const reqPrev = deltaPct(tr.requests, tr.previous?.requests);
  const roleName = (r: string) => t(`role.${r}`);

  return (
    <div className="space-y-4">
      {ins.data && ins.data.length > 0 && (
        <Card title={t('overview.insights')}>
          <div className="insights">
            {ins.data.map((i: any) => (
              <div key={i.id} className={`insight insight-${i.level}`}>
                <span className="insight-ico">{LEVEL_ICON[i.level]}</span>
                <span>{t(`insight.${i.key}`, i.params)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="stat-grid">
        <Stat label={t('overview.traffic')} value={fmtBytes(tr.total, lang)} delta={vsPrev} sub={`↑ ${fmtBytes(tr.sent, lang)} · ↓ ${fmtBytes(tr.received, lang)}`} />
        <Stat label={t('overview.requests')} value={fmtNum(tr.requests, lang)} delta={reqPrev} sub={t('overview.domains', { n: tr.domains })} />
        <Stat label={t('overview.activeAccounts')} value={`${fmtNum(tr.activeAccounts, lang)} / ${fmtNum(a.total, lang)}`} sub={t('overview.today', { n: tr.today.activeAccounts })} />
        <Stat label={t('overview.today24')} value={fmtBytes(tr.today.bytes, lang)} sub={`${fmtNum(tr.today.requests, lang)} ${t('req')}`} />
        <Stat label={t('overview.live')} value={`${fmtNum(d.live.threads, lang)}`} sub={`${t('overview.threads')} · ${d.live.accounts} ${t('overview.accounts')} · ${fmtRate(d.live.receivedBps + d.live.sentBps, lang)}`} />
        <Stat label={t('overview.quota')} value={`${fmtNum(a.usedGb, lang, 1)} / ${a.quotaGb ? fmtNum(a.quotaGb, lang, 1) : '∞'} ${gbUnit(lang)}`} sub={t('overview.unlimited', { n: a.unlimited })} />
        <Stat label={t('overview.pool')} value={`${fmtNum(p.working, lang)} / ${fmtNum(p.total - p.archived, lang)}`} sub={`${t('overview.latency')} ${fmtMs(p.avgLatencyMs, lang)}`} tone={p.working === 0 ? 'bad' : undefined} />
        <Stat label={t('overview.categories')} value={fmtNum(d.categories, lang)} sub={`${d.panelUsers.reduce((n: number, u: any) => n + u.total, 0)} ${t('overview.panelUsers')}`} />
      </div>

      <Card title={t('overview.dailyTraffic')}>
        <AreaChart
          labels={d.daily.map((x: any) => x.day)}
          series={[
            { name: t('sent'), color: '#3b82f6', values: d.daily.map((x: any) => x.sent) },
            { name: t('received'), color: 'var(--primary)', values: d.daily.map((x: any) => x.received) },
          ]}
          stacked
          fmt={(n) => fmtBytes(n, lang)}
          xFmt={(x) => fmtDay(x, lang)}
        />
      </Card>

      <div className="grid cols-2">
        <Card title={t('overview.dailyRequests')}>
          <AreaChart
            labels={d.daily.map((x: any) => x.day)}
            series={[
              { name: t('metric.requests'), color: '#10b981', values: d.daily.map((x: any) => x.requests) },
              { name: t('overview.activeAccounts'), color: '#8b5cf6', values: d.daily.map((x: any) => x.accounts) },
            ]}
            fmt={(n) => fmtNum(n, lang)}
            xFmt={(x) => fmtDay(x, lang)}
            height={170}
          />
        </Card>
        <Card title={t('overview.accountStatus')}>
          <Donut
            fmt={(n) => fmtNum(n, lang)}
            center={<><div style={{ fontSize: '1.2rem' }}>{a.total}</div><div className="text-xs text-muted">{t('overview.accounts')}</div></>}
            slices={[
              { label: t('status.ok'), value: Math.max(0, a.total - a.blocked - a.expired - a.overQuota), color: 'var(--green)' },
              { label: t('status.blocked'), value: a.blocked, color: 'var(--red)' },
              { label: t('status.expired'), value: a.expired, color: '#64748b' },
              { label: t('status.overquota'), value: a.overQuota, color: 'var(--amber)' },
            ]}
          />
          <div className="text-xs text-muted mt-3">
            {t('overview.nearQuota', { n: a.nearQuota })} · {t('overview.customList', { n: a.customList })} · {t('overview.assigned', { n: a.assigned })}
          </div>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={t('overview.topAccounts')}>
          <HBars
            fmt={(n) => fmtBytes(n, lang)}
            rows={d.topAccounts.map((x: any, i: number) => ({
              label: <span title={x.username}>{x.name || x.username}</span>,
              value: x.bytes,
              sub: `${fmtNum(x.requests, lang)} ${t('req')}${x.pool ? ' · ' + x.pool : ''}`,
              color: colorAt(i),
            }))}
          />
        </Card>
        <Card title={t('overview.topDomains')}>
          <HBars
            fmt={(n) => fmtBytes(n, lang)}
            rows={d.topDomains.map((x: any, i: number) => ({
              label: <span className="mono" title={x.hostname}>{x.hostname}</span>,
              value: x.bytes,
              sub: `${fmtNum(x.requests, lang)} ${t('req')} · ${x.accounts} ${t('overview.accounts')}`,
              color: colorAt(i + 2),
            }))}
          />
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={t('overview.poolStatus')}>
          <SegBar
            fmt={(n) => fmtNum(n, lang)}
            slices={[
              { label: t('pool.working'), value: p.working, color: 'var(--green)' },
              { label: t('pool.dead'), value: p.dead, color: 'var(--red)' },
              { label: t('pool.blacklisted'), value: p.blacklisted, color: '#f59e0b' },
              { label: t('pool.archived'), value: p.archived, color: '#64748b' },
            ]}
          />
        </Card>
        <Card title={t('overview.panelUsersTitle')}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('overview.role')}</th><th className="num">{t('overview.total')}</th><th className="num">{t('overview.activeCol')}</th><th className="num">2FA</th><th className="num">{t('overview.newCol')}</th></tr></thead>
              <tbody>
                {d.panelUsers.map((u: any) => (
                  <tr key={u.role}><td>{roleName(u.role)}</td><td className="num">{u.total}</td><td className="num">{u.active}</td><td className="num">{u.with2fa}</td><td className="num">{u.created}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {d.topOwners.length > 0 && (
        <Card title={t('overview.topOwners')}>
          <HBars
            fmt={(n) => fmtBytes(n, lang)}
            rows={d.topOwners.map((o: any, i: number) => ({ label: <span title={o.email}>{o.email}</span>, value: o.bytes, sub: `${o.accounts} ${t('overview.accounts')}`, color: colorAt(i + 4) }))}
          />
        </Card>
      )}
    </div>
  );
}
