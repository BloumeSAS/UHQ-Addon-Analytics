import { useState } from 'react';
import { useAddon } from '../context';
import { useT } from '../i18n';
import { useStat } from '../lib/api';
import { fmtBytes, fmtHour, fmtNum } from '../lib/format';
import { ActivityView, ActivityData } from '../components/ActivityView';
import { Gauge, HBars } from '../components/charts';
import { Badge, Card, Empty, ErrorBox, Loading, PeriodPicker, Stat, Tabs } from '../components/ui';

/**
 * Page utilisateur « Mon activité » : pour chacun de MES comptes proxy, quand
 * et combien je consomme (heures, jours, tendance) — uniquement mes données.
 */
export default function MyActivity() {
  const { token, lang, tz } = useAddon();
  const t = useT();
  const [days, setDays] = useState(30);
  const [sel, setSel] = useState<string>('');
  const res = useStat<any>(token, 'me', { days, tz });

  if (!token) return <div className="page"><Empty>{t('noToken')}</Empty></div>;
  const accounts: any[] = res.data?.accounts ?? [];
  const acc = accounts.find((a) => a.id === sel) ?? accounts[0];

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="section-title">{t('me.title')}</h1>
        <div className="toolbar">
          <PeriodPicker value={days} onChange={setDays} options={[7, 30, 90, 365]} />
          <button className="btn btn-outline btn-sm" onClick={res.reload}>↻ {t('refresh')}</button>
        </div>
      </div>

      {res.loading && !res.data ? <Loading /> : res.error ? <ErrorBox message={res.error} onRetry={res.reload} /> : !acc ? <Card><Empty>{t('me.noAccounts')}</Empty></Card> : (
        <div className="space-y-4">
          {accounts.length > 1 && (
            <Tabs tabs={accounts.map((a) => ({ id: a.id, label: a.label && a.label !== 'My Proxy' ? a.label : a.username }))} value={acc.id} onChange={setSel} />
          )}
          <AccountBlock acc={acc} days={days} lang={lang} />
        </div>
      )}
    </div>
  );
}

function AccountBlock({ acc, days, lang }: { acc: any; days: number; lang: 'fr' | 'en' }) {
  const t = useT();
  const act: ActivityData | null = acc.activity;
  const used = (acc.bytesSent ?? 0) + (acc.bytesReceived ?? 0);
  const quotaPct = acc.trafficLimit ? (used / acc.trafficLimit) * 100 : null;
  const periodBytes = act ? act.byDay.reduce((n, d) => n + d.bytes, 0) : 0;
  const periodReq = act ? act.byDay.reduce((n, d) => n + d.requests, 0) : 0;
  const activeDays = act ? act.byDay.filter((d) => d.bytes > 0).length : 0;
  const domains: { hostname: string; requests: number }[] = acc.usage?.top_domains ?? [];

  return (
    <>
      <div className="stat-grid">
        <Stat label={t('me.period', { days })} value={fmtBytes(periodBytes, lang)} sub={`${fmtNum(periodReq, lang)} ${t('req')}`} />
        <Stat label={t('accounts.activeDays')} value={`${activeDays}/${days}`} />
        <Stat label={t('activity.peakHour')} value={act?.peak.hour ? `${fmtHour(act.peak.hour.hour)}` : '—'} sub={act?.peak.hour ? t('activity.shareOfTraffic', { pct: Math.round(act.peak.hour.share * 100) }) : t('activity.needHourly')} />
        <Stat label={t('me.totalUsed')} value={fmtBytes(used, lang)} sub={acc.trafficLimit ? `/ ${fmtBytes(acc.trafficLimit, lang)}` : t('me.unlimited')} />
      </div>

      <div className="toolbar">
        {acc.pool && <Badge tone="info">{acc.pool}</Badge>}
        {acc.isBlocked && <Badge tone="bad">{t('status.blocked')}</Badge>}
        <span className="mono text-muted">{acc.username}</span>
      </div>

      {quotaPct !== null && (
        <Card title={t('me.quota')}>
          <Gauge pct={quotaPct} label={`${fmtBytes(used, lang)} / ${fmtBytes(acc.trafficLimit, lang)}`} />
        </Card>
      )}

      {act ? <ActivityView data={act} /> : <Card><Empty /></Card>}

      {domains.length > 0 && (
        <Card title={t('me.topDomains')}>
          <HBars fmt={(n) => `${fmtNum(n, lang)} ${t('req')}`} rows={domains.slice(0, 10).map((d) => ({ label: <span className="mono" title={d.hostname}>{d.hostname}</span>, value: d.requests }))} />
        </Card>
      )}
    </>
  );
}
