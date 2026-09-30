/**
 * Widget compact (100 px) affiché sur le Dashboard du panel.
 * Manifeste : { "zone": "/", "path": "/widget/dashboard", "height": 100 }
 */
import { useAddon } from '../context';
import { useT } from '../i18n';
import { useStat } from '../lib/api';
import { fmtBytes, fmtHour, fmtNum } from '../lib/format';

export default function DashboardWidget() {
  const { token, lang, role, tz } = useAddon();
  const t = useT();
  const staff = role === 'ADMIN' || role === 'SUPPORT';
  const ov = useStat<any>(token, 'overview', { days: 1 }, { enabled: staff });
  const act = useStat<any>(token, 'activity', { days: 7, tz }, { enabled: staff });

  // Silencieux pour un non-admin ou si les données ne sont pas (encore) là : pas d'erreur dans le dashboard.
  if (!staff || !ov.data) return null;
  const d = ov.data;
  const peak = act.data?.peak?.hour;

  const stats = [
    { label: t('widget.today'), value: fmtBytes(d.traffic.today.bytes, lang), sub: `${fmtNum(d.traffic.today.requests, lang)} ${t('req')}` },
    { label: t('widget.live'), value: fmtNum(d.live.threads, lang), sub: `${d.live.accounts} ${t('overview.accounts')}` },
    { label: t('activity.peakHour'), value: peak ? fmtHour(peak.hour) : '—', sub: t('widget.last7') },
  ];

  return (
    <div className="grid cols-3 widget" style={{ height: '100%', alignItems: 'stretch' }}>
      {stats.map((s) => (
        <div key={s.label} className="card card-sm" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{s.value}</div>
          <div className="stat-sub">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
