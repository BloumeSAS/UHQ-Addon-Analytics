import { Injectable } from '@nestjs/common';
import { PanelClient } from './panel-client.service';

export type InsightLevel = 'crit' | 'warn' | 'info' | 'ok';

export interface Insight {
  id: string;
  level: InsightLevel;
  /** Clé i18n côté front (`insight.<key>`), params = valeurs brutes (formatées par le front). */
  key: string;
  params: Record<string, string | number>;
}

const RANK: Record<InsightLevel, number> = { crit: 0, warn: 1, info: 2, ok: 3 };

/**
 * Règles d'analyse : transforme les agrégats du panel en constats lisibles
 * (alertes, tendances, conseils). Chaque règle est indépendante et tolère
 * l'absence de données (un agrégat en erreur n'empêche pas les autres).
 */
@Injectable()
export class InsightsService {
  constructor(private readonly panel: PanelClient) {}

  async build(token: string, userKey: string, days: number, tz: string): Promise<Insight[]> {
    const base = '/api/panel/analytics';
    const q = { days, tz };
    const get = (p: string, query: Record<string, unknown> = q) =>
      this.panel.get<any>(`${base}/${p}`, token, query, userKey).then((r) => r?.data);

    const [ov, act, cat, pool, chk, scr, sec] = (
      await Promise.allSettled([
        get('overview'), get('activity'), get('categories'), get('pool', {}), get('checker'), get('scraper'), get('security'),
      ])
    ).map((r) => (r.status === 'fulfilled' ? r.value : null));

    const out: Insight[] = [];
    const add = (level: InsightLevel, key: string, params: Record<string, string | number> = {}) =>
      out.push({ id: `${key}:${Object.values(params).join('|')}`, level, key, params });

    // ── Trafic : tendance, concentration, anomalies ─────────────────────────
    if (ov) {
      const cur = ov.traffic.total as number;
      const prev = ov.traffic.previous?.bytes as number;
      if (prev > 0 && cur > 0) {
        const pct = Math.round(((cur - prev) / prev) * 100);
        if (pct >= 25) add('info', 'trafficUp', { pct, current: cur, previous: prev });
        else if (pct <= -25) add('warn', 'trafficDown', { pct: Math.abs(pct), current: cur, previous: prev });
      } else if (prev > 0 && cur === 0) {
        add('crit', 'trafficNone', { previous: prev });
      }

      const top = (ov.topAccounts ?? []) as { name: string; username: string; bytes: number }[];
      const totalActive = ov.traffic.activeAccounts as number;
      if (cur > 0 && top.length && totalActive >= 3) {
        const share = Math.round((top[0].bytes / cur) * 100);
        if (share >= 50) add('warn', 'topAccountShare', { name: top[0].name || top[0].username, pct: share });
      }
      if (cur > 0 && totalActive >= 10) {
        const top10 = top.reduce((n, a) => n + a.bytes, 0);
        const pct = Math.round((top10 / cur) * 100);
        if (pct >= 80) add('info', 'concentration', { pct, n: top.length });
      }

      const a = ov.accounts;
      if (a.overQuota > 0) add('crit', 'overQuota', { count: a.overQuota });
      if (a.nearQuota > 0) add('warn', 'nearQuota', { count: a.nearQuota });
      if (a.blocked > 0) add('info', 'blockedAccounts', { count: a.blocked });
      if (a.expired > 0) add('info', 'expiredAccounts', { count: a.expired });
      const inactive = (a.total as number) - (ov.traffic.activeAccounts as number);
      if (a.total >= 5 && inactive / a.total >= 0.5) add('info', 'inactiveAccounts', { count: inactive, total: a.total });

      // Anomalies journalières : z-score sur ≥ 7 jours.
      const daily = (ov.daily ?? []) as { day: string; sent: number; received: number }[];
      const vals = daily.map((d) => d.sent + d.received);
      if (vals.length >= 7) {
        const mean = vals.reduce((n, v) => n + v, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((n, v) => n + (v - mean) ** 2, 0) / vals.length);
        if (sd > 0) {
          const worst = daily
            .map((d, i) => ({ day: d.day, v: vals[i], z: (vals[i] - mean) / sd }))
            .filter((d) => d.z >= 2.5)
            .sort((x, y) => y.z - x.z)[0];
          if (worst) add('warn', 'anomalyHigh', { day: worst.day, bytes: worst.v, avg: Math.round(mean) });
        }
        const last2 = vals.slice(-2);
        if (mean > 0 && last2.length === 2 && last2.every((v) => v === 0)) add('warn', 'anomalyDrop', {});
      }

      if (ov.live?.threads > 0) add('ok', 'liveNow', { threads: ov.live.threads, accounts: ov.live.accounts });
    }

    // ── Heures / jours ──────────────────────────────────────────────────────
    if (act) {
      if (!act.hasHourly) {
        add('info', 'noHourlyYet', {});
      } else {
        if (act.peak.hour) add('info', 'peakHour', { hour: act.peak.hour.hour, share: Math.round(act.peak.hour.share * 100) });
        if (act.peak.weekday) add('info', 'busiestWeekday', { dow: act.peak.weekday.dow, bytes: Math.round(act.peak.weekday.avgBytes) });
        if (act.peak.quietWindow) add('info', 'quietWindow', { from: act.peak.quietWindow.startHour, to: act.peak.quietWindow.endHour });
        if (act.hourlySince && Date.now() - new Date(act.hourlySince).getTime() < days * 86400_000 * 0.8) {
          add('info', 'hourlyPartial', { since: String(act.hourlySince).slice(0, 10) });
        }
      }
      if (act.peak.day) add('info', 'busiestDay', { day: act.peak.day.day, bytes: act.peak.day.bytes });
    }

    // ── Catégories ──────────────────────────────────────────────────────────
    if (cat) {
      for (const c of cat.categories as any[]) {
        if (c.isDefault) continue;
        if (c.accounts.total > 0 && c.upstream.working === 0 && !c.alwaysOnline) {
          add('crit', 'categoryNoUpstream', { name: c.name, accounts: c.accounts.total });
        }
        if (c.trafficMultiplier !== 1) add('info', 'categoryMultiplier', { name: c.name, x: c.trafficMultiplier });
      }
    }

    // ── Pool amont ──────────────────────────────────────────────────────────
    if (pool) {
      const s = pool.status;
      const live = s.total - s.archived;
      if (s.total > 0 && s.working === 0) {
        add('crit', 'poolNoWorking', { total: s.total });
      } else if (live > 0 && s.working / live < 0.1) {
        add('warn', 'poolLowHealth', { working: s.working, total: live, pct: Math.round((s.working / live) * 100) });
      }
      if (s.avgLatencyMs > 3000) add('warn', 'poolSlow', { ms: Math.round(s.avgLatencyMs) });
      const ag = pool.ageing;
      const stale = (ag?.d7 ?? 0) + (ag?.older ?? 0);
      if (live > 0 && stale / live > 0.3) add('warn', 'poolStale', { count: stale, pct: Math.round((stale / live) * 100) });
    }

    // ── Checker ─────────────────────────────────────────────────────────────
    if (chk) {
      const interval = chk.intervalSec as number;
      const last = chk.status?.lastRun ? new Date(chk.status.lastRun).getTime() : 0;
      if (chk.status?.loopActive && last && Date.now() - last > interval * 3 * 1000 && !chk.status.running) {
        add('warn', 'checkerStale', { minutes: Math.round((Date.now() - last) / 60000) });
      }
      if (!chk.status?.loopActive && !chk.status?.running) add('info', 'checkerOff', {});
      if (chk.summary?.cycles === 0 && chk.status?.loopActive) add('warn', 'checkerNoCycles', { days });
    }

    // ── Scraper ─────────────────────────────────────────────────────────────
    if (scr) {
      const sources = scr.sources as any[];
      const failing = sources.filter((s) => s.enabled && s.failCount > 0).length;
      const disabled = sources.filter((s) => !s.enabled).length;
      if (failing > 0) add('warn', 'scraperFailing', { count: failing, total: sources.length });
      if (disabled > 0) add('info', 'scraperDisabled', { count: disabled });
      const dead = sources.filter((s) => s.enabled && s.total > 0 && s.working === 0).length;
      if (dead > 0) add('info', 'scraperUseless', { count: dead });
      const last = scr.status?.lastRun ? new Date(scr.status.lastRun).getTime() : 0;
      if (scr.status?.loopActive && last && Date.now() - last > 24 * 3600_000) {
        add('warn', 'scraperStale', { hours: Math.round((Date.now() - last) / 3600_000) });
      }
    }

    // ── Sécurité ────────────────────────────────────────────────────────────
    if (sec) {
      if (sec.bans.active > 0) add('info', 'bansActive', { count: sec.bans.active, auto: sec.bans.auto });
      if (sec.bans.createdInPeriod >= 10) add('warn', 'bansSurge', { count: sec.bans.createdInPeriod });
      const top = (sec.errors as any[])[0];
      if (top && top.count >= 50) add('info', 'targetErrors', { reason: top.reason, count: top.count });
    }

    if (!out.some((i) => i.level === 'crit' || i.level === 'warn')) add('ok', 'allGood', {});
    return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
  }
}
