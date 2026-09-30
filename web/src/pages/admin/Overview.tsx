import { useAddon } from '../../context';
import { useT } from '../../i18n';
import { useStat } from '../../lib/api';
import { cumulative, deltaPct, fmtBytes, fmtDay, fmtMs, fmtNum, fmtPct, fmtRate, fmtStamp, gbUnit, shiftDay } from '../../lib/format';
import { AreaChart, BarChart, Donut, HBars, SegBar, colorAt } from '../../components/charts';
import { Card, Empty, ErrorBox, Loading, Stat } from '../../components/ui';
import type { PageProps } from './types';
import { useLabels } from '../../i18n/labels';

const LEVEL_ICON: Record<string, string> = { crit: '⛔', warn: '⚠️', info: 'ℹ️', ok: '✅' };

export default function Overview({ days, nonce }: PageProps) {
  const { token, lang, tz } = useAddon();
  const t = useT();
  const L = useLabels();
  const ov = useStat<any>(token, 'overview', { days, tz }, { nonce });
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
  const fr = lang === 'fr';
  const mo = fr ? 'Mo' : 'MB';
  const go = gbUnit(lang);
  const bucketLabels = [`<100 ${mo}`, `100 ${mo}–1 ${go}`, `1–10 ${go}`, `10–100 ${go}`, `≥100 ${go}`];
  const consumption = bucketLabels.map((label, i) => ({ label, row: (d.consumption as any[]).find((c) => c.bucket === i) }));
  const quotaLabels = ['<25 %', '25–50 %', '50–80 %', '80–100 %', '≥100 %'];
  const quotaDist = quotaLabels.map((label, i) => ({ label, n: (d.quotaDist as any[]).find((c) => c.bucket === i)?.accounts ?? 0 }));
  const dayTotals: number[] = d.daily.map((x: any) => x.sent + x.received);
  const prevByDay = new Map<string, number>((d.prevDaily as any[]).map((x) => [x.day, x.bytes]));
  const prevAligned: number[] = d.daily.map((x: any) => prevByDay.get(shiftDay(x.day, -days)) ?? 0);
  const newByDay = new Map<string, number>((d.newAccounts as any[]).map((x) => [x.day, x.count]));
  const perActive = tr.activeAccounts > 0 ? tr.total / tr.activeAccounts : 0;
  const avgReq = tr.requests > 0 ? tr.total / tr.requests : 0;
  const flow = d.flow ?? { gained: 0, kept: 0, lost: 0 };
  const share = d.domainShare ?? { top1: 0, top5: 0, top15: 0 };

  return (
    <div className="space-y-4">
      {ins.data && ins.data.length > 0 && (
        <Card title={t('overview.insights')}>
          <div className="insights">
            {ins.data.map((i: any) => (
              <div key={i.id} className={`insight insight-${i.level}`}>
                <span className="insight-ico">{LEVEL_ICON[i.level]}</span>
                <span>{t(`insight.${i.key}`, i.key === 'targetErrors' ? { ...i.params, reason: L.reason(String(i.params.reason)) } : i.params)}</span>
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
        <Stat label={t('overview.perActive')} value={fmtBytes(perActive, lang)} sub={`${fmtNum(tr.activeAccounts ? tr.requests / tr.activeAccounts : 0, lang)} ${t('overview.reqPerActive')}`} />
        <Stat label={t('overview.avgRequest')} value={fmtBytes(avgReq, lang)} sub={t('overview.avgRequestHint')} />
        <Stat label={t('overview.busiestHour')} value={d.timeline.length ? fmtStamp(d.timeline.reduce((a: any, b: any) => (b.sent + b.received > a.sent + a.received ? b : a)).hour, lang) : '—'} sub={t('overview.last72')} />
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
        <Card title={t('overview.vsPrevious')}>
          <AreaChart
            labels={d.daily.map((x: any) => x.day)}
            series={[
              { name: t('overview.current'), color: 'var(--primary)', values: dayTotals },
              { name: t('overview.previous'), color: '#64748b', values: prevAligned },
            ]}
            fmt={(n) => fmtBytes(n, lang)}
            xFmt={(x) => fmtDay(x, lang)}
            height={170}
          />
        </Card>
        <Card title={t('overview.cumulative')}>
          <AreaChart
            labels={d.daily.map((x: any) => x.day)}
            series={[{ name: t('overview.cumulative'), color: '#10b981', values: cumulative(dayTotals) }]}
            fmt={(n) => fmtBytes(n, lang)}
            xFmt={(x) => fmtDay(x, lang)}
            height={170}
          />
        </Card>
      </div>

      {d.timeline.length > 1 && (
        <Card title={t('overview.timeline72')}>
          <AreaChart
            labels={d.timeline.map((x: any) => x.hour)}
            series={[
              { name: t('sent'), color: '#3b82f6', values: d.timeline.map((x: any) => x.sent) },
              { name: t('received'), color: 'var(--primary)', values: d.timeline.map((x: any) => x.received) },
            ]}
            stacked
            fmt={(n) => fmtBytes(n, lang)}
            xFmt={(x) => fmtStamp(x, lang)}
            height={170}
          />
        </Card>
      )}

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

      <div className="grid cols-3">
        <Card title={t('overview.sentReceived')}>
          <Donut
            fmt={(n) => fmtBytes(n, lang)}
            slices={[
              { label: t('sent'), value: tr.sent, color: '#3b82f6' },
              { label: t('received'), value: tr.received, color: 'var(--primary)' },
            ]}
            size={130}
          />
        </Card>
        <Card title={t('overview.consumptionDist')}>
          <BarChart
            fmt={(n) => fmtNum(n, lang)}
            data={consumption.map((c) => ({ label: c.label, value: c.row?.accounts ?? 0, tip: `${c.label} — ${fmtNum(c.row?.accounts ?? 0, lang)} ${t('overview.accounts')} · ${fmtBytes(c.row?.bytes ?? 0, lang)}` }))}
            height={120}
          />
          <p className="text-xs text-muted mt-2">{t('overview.consumptionHint')}</p>
        </Card>
        <Card title={t('overview.quotaDist')}>
          <BarChart
            fmt={(n) => fmtNum(n, lang)}
            data={quotaDist.map((c, i) => ({ label: c.label, value: c.n, color: i >= 4 ? 'var(--red)' : i === 3 ? '#f59e0b' : 'var(--green)' }))}
            height={120}
          />
          <p className="text-xs text-muted mt-2">{t('overview.quotaHint')}</p>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={t('overview.accountFlow')}>
          <SegBar
            fmt={(n) => fmtNum(n, lang)}
            slices={[
              { label: t('overview.gained'), value: flow.gained, color: 'var(--green)' },
              { label: t('overview.kept'), value: flow.kept, color: '#3b82f6' },
              { label: t('overview.lost'), value: flow.lost, color: 'var(--red)' },
            ]}
          />
          <p className="text-xs text-muted mt-2">{t('overview.flowHint')}</p>
          {d.newAccounts.length > 0 && (
            <div className="mt-3">
              <div className="stat-label">{t('overview.newAccounts')}</div>
              <BarChart
                fmt={(n) => fmtNum(n, lang)}
                data={d.daily.map((x: any) => ({ label: fmtDay(x.day, lang), value: newByDay.get(x.day) ?? 0 }))}
                labelEvery={Math.max(1, Math.ceil(d.daily.length / 8))}
                height={70}
                color="#8b5cf6"
              />
            </div>
          )}
        </Card>
        <Card title={t('overview.domainShare')}>
          <HBars
            fmt={(n) => fmtPct(n * 100, lang, 1)}
            rows={[
              { label: t('overview.top1'), value: share.top1, color: colorAt(0) },
              { label: t('overview.top5'), value: share.top5, color: colorAt(1) },
              { label: t('overview.top15'), value: share.top15, color: colorAt(2) },
            ]}
          />
          <p className="text-xs text-muted mt-2">{t('overview.domainShareHint')}</p>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={t('overview.growers')}>
          <HBars
            fmt={(n) => `+${fmtBytes(n, lang)}`}
            empty={t('overview.noMovers')}
            rows={d.movers.growers.map((m: any) => ({ label: <span title={m.username}>{m.name || m.username}</span>, value: m.delta, sub: `${fmtBytes(m.prev, lang)} → ${fmtBytes(m.cur, lang)}`, color: 'var(--green)' }))}
          />
        </Card>
        <Card title={t('overview.decliners')}>
          <HBars
            fmt={(n) => `−${fmtBytes(n, lang)}`}
            empty={t('overview.noMovers')}
            rows={d.movers.decliners.map((m: any) => ({ label: <span title={m.username}>{m.name || m.username}</span>, value: -m.delta, sub: `${fmtBytes(m.prev, lang)} → ${fmtBytes(m.cur, lang)}`, color: 'var(--red)' }))}
          />
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
