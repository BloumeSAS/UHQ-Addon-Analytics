import { useState } from 'react';
import { useAddon } from '../context';
import { useT } from '../i18n';
import { fmtBytes, fmtDay, fmtHour, fmtNum, fmtDate, weekdayName } from '../lib/format';
import { AreaChart, BarChart, Heatmap, HBars } from './charts';
import { Card, Notice, Stat, Tabs } from './ui';

export interface ActivityData {
  period: { days: number; tz: string; serverTz: string };
  hasHourly: boolean;
  hourlySince: string | null;
  hourlyRows: number;
  hourOfDay: { hour: number; bytes: number; requests: number; avgActiveAccounts: number; maxActiveAccounts: number }[];
  weekday: { dow: number; bytes: number; requests: number; avgBytes: number; avgRequests: number }[];
  heatmap: { bytes: number[][]; requests: number[][] };
  byDay: { day: string; bytes: number; requests: number; accounts: number }[];
  peak: {
    hour: { hour: number; bytes: number; share: number } | null;
    weekday: { dow: number; avgBytes: number } | null;
    day: { day: string; bytes: number } | null;
    slots: { dow: number; hour: number; bytes: number; requests: number }[];
    quietWindow: { startHour: number; endHour: number; bytes: number } | null;
  };
}

type Metric = 'bytes' | 'requests' | 'accounts';
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/**
 * Vue « heures / jours » : indicateurs clés, répartition par heure et par jour
 * de semaine, carte de chaleur, tendance journalière. Utilisée par la page
 * Activité, le détail d'un compte et la page « Mon activité ».
 */
export function ActivityView({ data, showAccounts = false }: { data: ActivityData; showAccounts?: boolean }) {
  const { lang } = useAddon();
  const t = useT();
  const [metric, setMetric] = useState<Metric>('bytes');

  const fmtMetric = (n: number) => (metric === 'bytes' ? fmtBytes(n, lang) : metric === 'requests' ? fmtNum(n, lang) : fmtNum(n, lang, 1));
  const hourVals = data.hourOfDay.map((h) => (metric === 'bytes' ? h.bytes : metric === 'requests' ? h.requests : h.avgActiveAccounts));
  const peakIdx = data.hasHourly && Math.max(...hourVals) > 0 ? hourVals.indexOf(Math.max(...hourVals)) : null;
  const total = data.hourOfDay.reduce((n, h) => n + h.bytes, 0);

  const dayVals = data.weekday.map((w) => (metric === 'requests' ? w.avgRequests : w.avgBytes));
  const weekdayBars = MONDAY_FIRST.map((dow) => {
    const w = data.weekday.find((x) => x.dow === dow)!;
    return { label: weekdayName(dow, lang, 'short'), value: metric === 'requests' ? w.avgRequests : w.avgBytes, tip: `${weekdayName(dow, lang, 'long')} — ${metric === 'requests' ? fmtNum(w.avgRequests, lang) + ' ' + t('req') : fmtBytes(w.avgBytes, lang)} / ${t('perDay')}` };
  });
  // dayVals est indexé par jour de semaine (0 = dimanche) : l'indice du max EST le jour.
  const weekdayPeak = Math.max(...dayVals) > 0 ? dayVals.indexOf(Math.max(...dayVals)) : null;

  const metricTabs: { id: Metric; label: string }[] = [
    { id: 'bytes', label: t('metric.bytes') },
    { id: 'requests', label: t('metric.requests') },
    ...(showAccounts ? [{ id: 'accounts' as Metric, label: t('metric.accounts') }] : []),
  ];

  const dayMetric: 'bytes' | 'requests' = metric === 'requests' ? 'requests' : 'bytes';

  return (
    <div className="space-y-4">
      {!data.hasHourly && <Notice tone="warn">{t('activity.noHourly')}</Notice>}
      {data.hasHourly && data.hourlySince && new Date(data.hourlySince).getTime() > Date.now() - data.period.days * 86400_000 * 0.9 && (
        <Notice>{t('activity.hourlySince', { date: fmtDate(data.hourlySince, lang) })}</Notice>
      )}

      <div className="stat-grid">
        <Stat
          label={t('activity.peakHour')}
          value={data.peak.hour ? `${fmtHour(data.peak.hour.hour)} – ${fmtHour((data.peak.hour.hour + 1) % 24)}` : '—'}
          sub={data.peak.hour ? t('activity.shareOfTraffic', { pct: Math.round(data.peak.hour.share * 100) }) : t('activity.needHourly')}
        />
        <Stat
          label={t('activity.busiestWeekday')}
          value={data.peak.weekday ? weekdayName(data.peak.weekday.dow, lang, 'long') : '—'}
          sub={data.peak.weekday ? `${fmtBytes(data.peak.weekday.avgBytes, lang)} / ${t('perDay')}` : undefined}
        />
        <Stat
          label={t('activity.busiestDay')}
          value={data.peak.day ? fmtDay(data.peak.day.day, lang) : '—'}
          sub={data.peak.day ? fmtBytes(data.peak.day.bytes, lang) : undefined}
        />
        <Stat
          label={t('activity.quietWindow')}
          value={data.peak.quietWindow ? `${fmtHour(data.peak.quietWindow.startHour)} – ${fmtHour(data.peak.quietWindow.endHour)}` : '—'}
          sub={t('activity.quietHint')}
        />
      </div>

      <Card title={t('activity.byHour')} right={<Tabs tabs={metricTabs} value={metric} onChange={setMetric} />}>
        <BarChart
          data={data.hourOfDay.map((h, i) => ({ label: fmtHour(h.hour), value: hourVals[i], tip: `${fmtHour(h.hour)} — ${fmtMetric(hourVals[i])}` }))}
          fmt={fmtMetric}
          labelEvery={2}
          highlight={peakIdx}
        />
        <p className="text-xs text-muted mt-2">{t('activity.tzNote', { tz: data.period.tz })}</p>
      </Card>

      <div className="grid cols-2">
        <Card title={t('activity.byWeekday')}>
          <BarChart
            data={weekdayBars}
            fmt={(n) => (metric === 'requests' ? fmtNum(n, lang) : fmtBytes(n, lang))}
            highlight={weekdayPeak === null ? null : MONDAY_FIRST.indexOf(weekdayPeak)}
            height={140}
          />
          <p className="text-xs text-muted mt-2">{t('activity.avgPerDay')}</p>
        </Card>
        <Card title={t('activity.topSlots')}>
          {data.peak.slots.length ? (
            <HBars
              rows={data.peak.slots.map((s) => ({
                label: `${weekdayName(s.dow, lang, 'long')} ${fmtHour(s.hour)}`,
                value: dayMetric === 'requests' ? s.requests : s.bytes,
                sub: dayMetric === 'requests' ? fmtBytes(s.bytes, lang) : `${fmtNum(s.requests, lang)} ${t('req')}`,
              }))}
              fmt={(n) => (dayMetric === 'requests' ? fmtNum(n, lang) : fmtBytes(n, lang))}
            />
          ) : (
            <div className="empty text-xs">{t('activity.needHourly')}</div>
          )}
        </Card>
      </div>

      <Card title={t('activity.heatmap')}>
        {data.hasHourly ? (
          <Heatmap
            matrix={dayMetric === 'requests' ? data.heatmap.requests : data.heatmap.bytes}
            fmt={(n) => (dayMetric === 'requests' ? `${fmtNum(n, lang)} ${t('req')}` : fmtBytes(n, lang))}
            dayLabel={(d) => weekdayName(d, lang, 'short')}
            hourLabel={fmtHour}
          />
        ) : (
          <div className="empty text-xs">{t('activity.needHourly')}</div>
        )}
        {data.hasHourly && total > 0 && <p className="text-xs text-muted mt-2">{t('activity.heatHint')}</p>}
      </Card>

      <Card title={t('activity.daily')}>
        <AreaChart
          labels={data.byDay.map((d) => d.day)}
          series={[{ name: dayMetric === 'requests' ? t('metric.requests') : t('metric.bytes'), color: 'var(--primary)', values: data.byDay.map((d) => d[dayMetric]) }]}
          fmt={(n) => (dayMetric === 'requests' ? fmtNum(n, lang) : fmtBytes(n, lang))}
          xFmt={(d) => fmtDay(d, lang)}
        />
      </Card>
    </div>
  );
}
