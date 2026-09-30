import { useAddon } from '../../context';
import { useT } from '../../i18n';
import { useStat } from '../../lib/api';
import { fmtBytes, fmtDay, fmtHour, fmtMs, fmtNum, gbUnit } from '../../lib/format';
import { AreaChart, Donut, Gauge, HBars, SegBar, colorAt } from '../../components/charts';
import { Badge, Card, Empty, ErrorBox, Loading } from '../../components/ui';
import type { PageProps } from './types';

export default function Categories({ days, nonce }: PageProps) {
  const { token, lang, tz } = useAddon();
  const t = useT();
  const res = useStat<any>(token, 'categories', { days, tz }, { nonce });

  if (res.loading && !res.data) return <Loading />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;
  const cats: any[] = res.data?.categories ?? [];
  if (!cats.length) return <Empty />;

  const name = (c: any) => c.name ?? t('categories.default');
  const color = (c: any, i: number) => c.color ?? colorAt(i);

  // Série journalière par catégorie (empilée).
  const daily: { day: string; pool: string; bytes: number }[] = res.data.daily ?? [];
  const dayList = [...new Set(daily.map((d) => d.day))].sort();
  const series = cats
    .filter((c) => c.traffic.total > 0)
    .map((c, i) => ({
      name: name(c),
      color: color(c, i),
      values: dayList.map((day) => daily.filter((d) => d.day === day && d.pool === (c.name ?? '')).reduce((n, d) => n + d.bytes, 0)),
    }));

  return (
    <div className="space-y-4">
      <div className="grid cols-2">
        <Card title={t('categories.trafficShare')}>
          <Donut
            fmt={(n) => fmtBytes(n, lang)}
            slices={cats.filter((c) => c.traffic.total > 0).map((c, i) => ({ label: name(c), value: c.traffic.total, color: color(c, i) }))}
            center={<><div style={{ fontSize: '1rem' }}>{fmtBytes(cats.reduce((n, c) => n + c.traffic.total, 0), lang)}</div></>}
          />
        </Card>
        <Card title={t('categories.dailyByCategory')}>
          {series.length ? (
            <AreaChart labels={dayList} series={series} stacked fmt={(n) => fmtBytes(n, lang)} xFmt={(x) => fmtDay(x, lang)} height={170} />
          ) : <Empty />}
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={t('categories.accountsBy')}>
          <HBars fmt={(n) => fmtNum(n, lang)} rows={cats.map((c, i) => ({ label: name(c), value: c.accounts.total, sub: `${c.accounts.active} ${t('categories.active')}`, color: color(c, i) }))} />
        </Card>
        <Card title={t('categories.requestsBy')}>
          <HBars fmt={(n) => fmtNum(n, lang)} rows={cats.map((c, i) => ({ label: name(c), value: c.traffic.requests, color: color(c, i) }))} />
        </Card>
        <Card title={t('categories.bytesPerAccount')}>
          <HBars fmt={(n) => fmtBytes(n, lang)} rows={cats.map((c, i) => ({ label: name(c), value: c.accounts.active ? c.traffic.total / c.accounts.active : 0, color: color(c, i) }))} />
        </Card>
        <Card title={t('categories.latencyBy')}>
          <HBars fmt={(n) => fmtMs(n, lang)} rows={cats.filter((c) => c.upstream.avgLatencyMs).map((c, i) => ({ label: name(c), value: c.upstream.avgLatencyMs, sub: `${c.upstream.working}/${c.upstream.total}`, color: color(c, i) }))} />
        </Card>
      </div>

      <Card title={t('categories.upstreamHealth')}>
        <div className="space-y-3">
          {cats.filter((c) => c.upstream.total > 0).map((c, i) => (
            <div key={c.key}>
              <div className="text-xs mb-2 text-bold">{name(c)}</div>
              <SegBar
                fmt={(n) => fmtNum(n, lang)}
                slices={[
                  { label: t('pool.working'), value: c.upstream.working, color: 'var(--green)' },
                  { label: t('pool.dead'), value: c.upstream.dead, color: 'var(--red)' },
                  { label: t('pool.blacklisted'), value: c.upstream.blacklisted, color: '#f59e0b' },
                ]}
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid cols-2">
        {cats.map((c, i) => (
          <Card
            key={c.key}
            title={
              <span className="flex items-center gap-2">
                <span className="dot" style={{ background: color(c, i), width: 12, height: 12 }} /> {name(c)}
              </span>
            }
            right={
              <span className="flex gap-1 wrap">
                {c.trafficMultiplier !== 1 && <Badge tone="warn" title={t('categories.multiplier')}>× {c.trafficMultiplier}</Badge>}
                {c.alwaysOnline && <Badge tone="good">{t('categories.alwaysOnline')}</Badge>}
                {c.antiVpnEnabled && <Badge tone="bad">Anti-VPN</Badge>}
                {c.checkerEnabled === false && <Badge>{t('categories.checkerOff')}</Badge>}
                {c.port && <Badge>:{c.port}</Badge>}
              </span>
            }
          >
            {c.description && <p className="text-xs text-muted mb-3">{c.description}</p>}
            <div className="grid cols-2" style={{ gap: '0.5rem' }}>
              <div>
                <div className="stat-label">{t('overview.accounts')}</div>
                <div className="text-bold">{fmtNum(c.accounts.total, lang)} <span className="text-muted text-xs">· {c.accounts.active} {t('categories.active')}</span></div>
                <div className="text-xs text-muted">{c.accounts.blocked} {t('status.blocked').toLowerCase()} · {c.accounts.overQuota} {t('status.overquota').toLowerCase()}</div>
              </div>
              <div>
                <div className="stat-label">{t('metric.bytes')}</div>
                <div className="text-bold">{fmtBytes(c.traffic.total, lang)}</div>
                <div className="text-xs text-muted">{fmtNum(c.traffic.requests, lang)} {t('req')} · {c.traffic.domains} {t('accounts.domains').toLowerCase()}</div>
              </div>
              <div>
                <div className="stat-label">{t('categories.upstream')}</div>
                <div className="text-bold">{fmtNum(c.upstream.working, lang)} / {fmtNum(c.upstream.total, lang)}</div>
                <div className="text-xs text-muted">{t('overview.latency')} {fmtMs(c.upstream.avgLatencyMs, lang)}</div>
              </div>
              <div>
                <div className="stat-label">{t('activity.peakHour')}</div>
                <div className="text-bold">{c.peakHour !== null && c.peakHour !== undefined ? fmtHour(c.peakHour) : '—'}</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="stat-label">{t('categories.quotaUsage')}</div>
              <Gauge pct={c.accounts.quotaGb > 0 ? (c.accounts.usedGb / c.accounts.quotaGb) * 100 : null} label={`${fmtNum(c.accounts.usedGb, lang, 1)} / ${fmtNum(c.accounts.quotaGb, lang, 1)} ${gbUnit(lang)}`} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
