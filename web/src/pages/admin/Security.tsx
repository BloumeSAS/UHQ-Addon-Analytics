import { useAddon } from '../../context';
import { useT } from '../../i18n';
import { useStat } from '../../lib/api';
import { fmtDateTime, fmtDay, fmtNum } from '../../lib/format';
import { AreaChart, HBars, colorAt } from '../../components/charts';
import { Badge, Card, Empty, ErrorBox, Loading, Stat } from '../../components/ui';
import type { PageProps } from './types';

export default function Security({ days, nonce }: PageProps) {
  const { token, lang } = useAddon();
  const t = useT();
  const res = useStat<any>(token, 'security', { days }, { nonce });

  if (res.loading && !res.data) return <Loading />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;
  const d = res.data;
  if (!d) return <Empty />;
  const n = (x: number) => fmtNum(x, lang);

  return (
    <div className="space-y-4">
      <div className="stat-grid">
        <Stat label={t('security.activeBans')} value={n(d.bans.active)} sub={t('security.bansSub', { auto: d.bans.auto, permanent: d.bans.permanent })} tone={d.bans.active > 0 ? 'warn' : undefined} />
        <Stat label={t('security.newBans')} value={n(d.bans.createdInPeriod)} sub={t('checker.inPeriod', { days })} />
        <Stat label={t('security.sessions')} value={n(d.sessions.total)} sub={t('security.sessions24', { n: d.sessions.active24h })} />
        <Stat label={t('security.apiKeys')} value={n(d.apiKeys.active)} sub={t('security.keysSub', { used: d.apiKeys.used30d, expired: d.apiKeys.expired })} />
        <Stat label={t('security.targetBlocks')} value={n(d.targetBlocks)} sub={t('security.targetBlocksHint')} />
        <Stat label={t('security.targetErrors')} value={n(d.errors.reduce((x: number, e: any) => x + e.count, 0))} sub={t('security.targetErrorsHint')} />
      </div>

      <div className="grid cols-2">
        <Card title={t('security.errorsByReason')}>
          {d.errors.length ? (
            <HBars fmt={n} rows={d.errors.map((e: any) => ({ label: e.reason, value: e.count, sub: `${e.accounts} ${t('overview.accounts')} · ${e.hosts} ${t('security.hosts')}`, color: 'var(--red)' }))} />
          ) : <Empty>{t('security.noErrors')}</Empty>}
        </Card>
        <Card title={t('security.errorHosts')}>
          {d.errorHosts.length ? (
            <HBars fmt={n} rows={d.errorHosts.map((e: any, i: number) => ({ label: <span className="mono" title={e.hostname}>{e.hostname}</span>, value: e.count, color: colorAt(i) }))} />
          ) : <Empty>{t('security.noErrors')}</Empty>}
        </Card>
      </div>

      {d.errorsDaily.length > 0 && (
        <Card title={t('security.errorsDaily')}>
          <AreaChart labels={d.errorsDaily.map((x: any) => x.day)} series={[{ name: t('security.targetErrors'), color: 'var(--red)', values: d.errorsDaily.map((x: any) => x.count) }]} fmt={n} xFmt={(x) => fmtDay(x, lang)} height={140} />
        </Card>
      )}

      <Card pad={false} title={t('security.recentBans')}>
        {d.recentBans.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>IP</th><th>{t('security.reason')}</th><th>{t('security.by')}</th><th>{t('date')}</th><th>{t('security.expires')}</th></tr></thead>
              <tbody>
                {d.recentBans.map((b: any) => (
                  <tr key={b.ip}>
                    <td className="mono">{b.ip}</td>
                    <td className="text-xs">{b.reason ?? '—'}</td>
                    <td>{b.createdBy === 'auto' ? <Badge tone="info">auto</Badge> : <span className="text-xs">{b.createdBy ?? '—'}</span>}</td>
                    <td className="text-xs">{fmtDateTime(b.createdAt, lang)}</td>
                    <td className="text-xs">{b.expiresAt ? fmtDateTime(b.expiresAt, lang) : <Badge tone="bad">{t('security.permanent')}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{t('security.noBans')}</Empty>}
      </Card>

      <div className="grid cols-2">
        <Card title={t('security.auditActions')}>
          {d.audit.actions.length ? <HBars fmt={n} rows={d.audit.actions.map((a: any, i: number) => ({ label: <span className="mono">{a.action}</span>, value: a.count, color: colorAt(i) }))} /> : <Empty />}
        </Card>
        <Card title={t('security.auditUsers')}>
          {d.audit.users.length ? <HBars fmt={n} rows={d.audit.users.map((a: any, i: number) => ({ label: a.email, value: a.count, color: colorAt(i + 2) }))} /> : <Empty />}
        </Card>
      </div>

      {d.audit.daily.length > 0 && (
        <Card title={t('security.auditDaily')}>
          <AreaChart labels={d.audit.daily.map((x: any) => x.day)} series={[{ name: t('security.auditActions'), color: 'var(--blue)', values: d.audit.daily.map((x: any) => x.count) }]} fmt={n} xFmt={(x) => fmtDay(x, lang)} height={140} />
        </Card>
      )}
    </div>
  );
}
