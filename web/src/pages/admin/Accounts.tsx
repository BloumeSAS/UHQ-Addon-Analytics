import { useEffect, useState } from 'react';
import { useAddon } from '../../context';
import { useT } from '../../i18n';
import { createApi, useStat } from '../../lib/api';
import { deltaPct, downloadCsv, fmtBytes, fmtDate, fmtDay, fmtHour, fmtNum, fmtPct, gbUnit, timeAgo } from '../../lib/format';
import { ActivityView } from '../../components/ActivityView';
import { AreaChart, Gauge, HBars } from '../../components/charts';
import { Badge, Card, Empty, ErrorBox, Loading, Pagination, SortTh, Stat, useDebounced } from '../../components/ui';
import type { PageProps } from './types';

const PAGE = 25;

function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const tone = status === 'ok' ? 'good' : status === 'blocked' ? 'bad' : status === 'overquota' ? 'warn' : 'muted';
  return <Badge tone={tone}>{t(`status.${status}`)}</Badge>;
}

export default function Accounts({ days, nonce }: PageProps) {
  const { token, lang, tz } = useAddon();
  const t = useT();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [status, setStatus] = useState('');
  const [pool, setPool] = useState('');
  const [sort, setSort] = useState('bytes');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => setOffset(0), [dq, status, pool, sort, order, days]);

  const params = { days, tz, q: dq || undefined, status: status || undefined, pool: pool || undefined, sort, order, limit: PAGE, offset };
  const res = useStat<any>(token, 'accounts', params, { raw: true, nonce });
  const cats = useStat<any>(token, 'categories', { days, tz }, { nonce });

  const onSort = (id: string) => {
    if (sort === id) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(id); setOrder(id === 'username' ? 'asc' : 'desc'); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: any[] = [];
      for (let off = 0; off < 5000; off += 500) {
        const r: any = await createApi(token).get('stats/accounts', { ...params, limit: 500, offset: off });
        rows.push(...(r.data ?? []));
        if (rows.length >= r.total || !(r.data ?? []).length) break;
      }
      downloadCsv(`accounts-${days}d.csv`, [
        ['username', 'name', 'category', 'owner', 'status', 'bytes', 'sent', 'received', 'requests', 'domains', 'active_days', 'last_active', 'peak_hour', 'used_gb', 'quota_gb', 'quota_pct'],
        ...rows.map((a) => [a.username, a.name, a.pool ?? '', a.ownerEmail ?? '', a.status, Math.round(a.bytes), Math.round(a.sent), Math.round(a.received), a.requests, a.domains, a.activeDays, a.lastHour ?? a.lastDay ?? '', a.peakHour ?? '', a.usedGb?.toFixed(3), a.totalGb, a.quotaPct ?? '']),
      ]);
    } finally {
      setExporting(false);
    }
  };

  const rows: any[] = res.data?.data ?? [];

  return (
    <div className="space-y-4">
      <Card pad={false} title={t('accounts.title')} right={
        <div className="toolbar">
          <input className="input" style={{ width: 200 }} placeholder={t('accounts.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('accounts.allStatus')}</option>
            {['active', 'inactive', 'blocked', 'expired', 'overquota', 'nearquota'].map((s) => <option key={s} value={s}>{t(`filter.${s}`)}</option>)}
          </select>
          <select className="input" value={pool} onChange={(e) => setPool(e.target.value)}>
            <option value="">{t('activity.all')}</option>
            {(cats.data?.categories ?? []).map((c: any) => <option key={c.key} value={c.key}>{c.name ?? t('categories.default')}</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={exporting}>{exporting ? '…' : t('export.csv')}</button>
        </div>
      }>
        {res.error && <div style={{ padding: '0 1.25rem 1rem' }}><ErrorBox message={res.error} onRetry={res.reload} /></div>}
        {res.loading && !res.data ? <Loading /> : rows.length === 0 ? <Empty>{t('accounts.none')}</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <SortTh id="username" sort={sort} order={order} onSort={onSort}>{t('accounts.account')}</SortTh>
                  <th>{t('activity.category')}</th>
                  <th>{t('accounts.status')}</th>
                  <SortTh id="bytes" sort={sort} order={order} onSort={onSort} right>{t('metric.bytes')}</SortTh>
                  <SortTh id="requests" sort={sort} order={order} onSort={onSort} right>{t('metric.requests')}</SortTh>
                  <SortTh id="domains" sort={sort} order={order} onSort={onSort} right>{t('accounts.domains')}</SortTh>
                  <SortTh id="activeDays" sort={sort} order={order} onSort={onSort} right>{t('accounts.activeDays')}</SortTh>
                  <SortTh id="lastActive" sort={sort} order={order} onSort={onSort}>{t('accounts.lastActive')}</SortTh>
                  <th>{t('accounts.peak')}</th>
                  <SortTh id="quota" sort={sort} order={order} onSort={onSort}>{t('accounts.quota')}</SortTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="clickable" onClick={() => setOpenId(a.id)}>
                    <td>
                      <div className="text-bold">{a.name && a.name !== 'My Proxy' ? a.name : a.username}</div>
                      <div className="mono text-muted">{a.username}{a.ownerEmail ? ` · ${a.ownerEmail}` : ''}</div>
                    </td>
                    <td>{a.pool ? <Badge tone="info">{a.pool}</Badge> : <span className="text-muted">—</span>}</td>
                    <td><StatusBadge status={a.status} />{a.customList && <> <Badge tone="muted" title={t('accounts.customList')}>⛓</Badge></>}</td>
                    <td className="num">{fmtBytes(a.bytes, lang)}</td>
                    <td className="num">{fmtNum(a.requests, lang)}</td>
                    <td className="num">{fmtNum(a.domains, lang)}</td>
                    <td className="num">{a.activeDays}/{days}</td>
                    <td className="text-xs">{a.lastHour ? timeAgo(a.lastHour, lang) : a.lastDay ? timeAgo(a.lastDay, lang) : <span className="text-muted">{t('accounts.never')}</span>}</td>
                    <td>{a.peakHour !== null && a.peakHour !== undefined ? fmtHour(a.peakHour) : <span className="text-muted">—</span>}</td>
                    <td><Gauge pct={a.quotaPct} label={`${fmtNum(a.usedGb, lang, 2)} / ${a.totalGb ? fmtNum(a.totalGb, lang, 1) : '∞'} ${gbUnit(lang)}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={res.data?.total ?? 0} limit={PAGE} offset={offset} onChange={setOffset} />
      </Card>

      {openId && <AccountDrawer id={openId} days={days} nonce={nonce} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function AccountDrawer({ id, days, nonce, onClose }: { id: string; days: number; nonce: number; onClose: () => void }) {
  const { token, lang, tz } = useAddon();
  const t = useT();
  const res = useStat<any>(token, `accounts/${id}`, { days, tz }, { nonce });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const d = res.data;
  const a = d?.account;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="section-title">{a ? (a.name && a.name !== 'My Proxy' ? a.name : a.username) : '…'}</div>
            {a && <div className="mono text-muted">{a.username}</div>}
          </div>
          <button className="drawer-close" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>

        {res.loading && !d ? <Loading /> : res.error ? <ErrorBox message={res.error} onRetry={res.reload} /> : d && (
          <div className="space-y-4">
            <div className="stat-grid">
              <Stat label={t('metric.bytes')} value={fmtBytes(d.totals.bytes, lang)} delta={deltaPct(d.totals.bytes, d.previous?.bytes)} sub={`↑ ${fmtBytes(d.totals.sent, lang)} · ↓ ${fmtBytes(d.totals.received, lang)}`} />
              <Stat label={t('metric.requests')} value={fmtNum(d.totals.requests, lang)} delta={deltaPct(d.totals.requests, d.previous?.requests)} sub={t('overview.domains', { n: d.totals.domains })} />
              <Stat label={t('accounts.activeDays')} value={`${d.totals.activeDays}/${days}`} sub={d.totals.last ? t('accounts.lastDay', { ago: d.totals.last }) : undefined} />
              <Stat label={t('accounts.quota')} value={a.quotaPct === null ? '∞' : fmtPct(a.quotaPct, lang, 1)} sub={`${fmtNum(a.usedGb, lang, 2)} / ${a.totalGb ? fmtNum(a.totalGb, lang, 1) : '∞'} ${gbUnit(lang)}`} tone={a.quotaPct >= 100 ? 'bad' : a.quotaPct >= 80 ? 'warn' : undefined} />
              <Stat label={t('accounts.liveThreads')} value={`${a.liveThreads} / ${a.threadsLimit}`} sub={a.bandwidthLimit ? t('accounts.bwLimit', { n: a.bandwidthLimit }) : undefined} />
              <Stat label={t('accounts.created')} value={fmtDate(a.createdAt, lang)} sub={a.expiresAt ? t('accounts.expires', { date: fmtDate(a.expiresAt, lang) }) : t('accounts.noExpiry')} />
            </div>

            <div className="toolbar text-xs">
              {a.pool && <Badge tone="info">{a.pool}</Badge>}
              {a.isBlocked && <Badge tone="bad">{t('status.blocked')}</Badge>}
              {a.ownerEmail && <Badge>{a.ownerEmail}</Badge>}
              {a.port && <Badge>:{a.port}</Badge>}
              {a.domain && <Badge>{a.domain}</Badge>}
              {a.countryFilter && <Badge>{a.countryFilter}</Badge>}
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
                height={170}
              />
            </Card>

            <ActivityView data={d.activity} />

            <div className="grid cols-2">
              <Card title={t('overview.topDomains')}>
                <HBars
                  fmt={(n) => fmtBytes(n, lang)}
                  rows={d.domains.slice(0, 12).map((x: any) => ({ label: <span className="mono" title={x.hostname}>{x.hostname}</span>, value: x.bytes, sub: `${fmtNum(x.requests, lang)} ${t('req')} · ${x.days}${t('accounts.dShort')}` }))}
                />
              </Card>
              <Card title={t('accounts.errors')}>
                {d.errors.length ? (
                  <HBars fmt={(n) => fmtNum(n, lang)} rows={d.errors.map((e: any) => ({ label: e.reason, value: e.count, sub: `${e.hosts} ${t('security.hosts')}`, color: 'var(--red)' }))} />
                ) : <div className="empty text-xs">{t('accounts.noErrors')}</div>}
              </Card>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
