/** Formatage des nombres, octets (Go décimal, comme le panel), durées et dates. */

export type Lang = 'fr' | 'en';

const UNITS: Record<Lang, string[]> = {
  fr: ['o', 'Ko', 'Mo', 'Go', 'To'],
  en: ['B', 'KB', 'MB', 'GB', 'TB'],
};

/** 1 Go = 1 000 000 000 octets (unité du panel depuis la v2.4.65). */
export function fmtBytes(bytes: number | null | undefined, lang: Lang = 'fr'): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return `0 ${UNITS[lang][0]}`;
  const i = Math.min(UNITS[lang].length - 1, Math.floor(Math.log(n) / Math.log(1000)));
  const v = n / 1000 ** i;
  return `${v.toLocaleString(lang, { maximumFractionDigits: i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2 })} ${UNITS[lang][i]}`;
}

/** Libellé de l'unité « Go » selon la langue (les valeurs sont en Go décimaux, comme le panel). */
export function gbUnit(lang: Lang = 'fr'): string {
  return lang === 'fr' ? 'Go' : 'GB';
}

export function fmtNum(n: number | null | undefined, lang: Lang = 'fr', digits = 0): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(lang, { maximumFractionDigits: digits });
}

/** Nombre compact (1,2 k / 3,4 M) pour les axes et les petites cartes. */
export function fmtCompact(n: number | null | undefined, lang: Lang = 'fr'): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

export function fmtPct(n: number | null | undefined, lang: Lang = 'fr', digits = 0): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${v.toLocaleString(lang, { maximumFractionDigits: digits })} %`;
}

export function fmtMs(ms: number | null | undefined, lang: Lang = 'fr'): string {
  const v = Number(ms);
  if (!Number.isFinite(v)) return '—';
  return v >= 1000 ? `${(v / 1000).toLocaleString(lang, { maximumFractionDigits: 1 })} s` : `${Math.round(v)} ms`;
}

export function fmtDuration(ms: number | null | undefined, lang: Lang = 'fr'): string {
  const v = Number(ms);
  if (!Number.isFinite(v) || v <= 0) return '—';
  const s = Math.round(v / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60 ? `${s % 60} s` : ''}`.trim();
  const h = Math.floor(m / 60);
  return lang === 'fr' ? `${h} h ${m % 60} min` : `${h}h ${m % 60}m`;
}

/** Débit (octets/s). */
export function fmtRate(bps: number | null | undefined, lang: Lang = 'fr'): string {
  return `${fmtBytes(bps, lang)}/s`;
}

export function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}h`;
}

/** Jour de semaine (0 = dimanche). */
export function weekdayName(dow: number, lang: Lang, style: 'short' | 'long' = 'short'): string {
  return new Date(2023, 0, 1 + dow).toLocaleDateString(lang, { weekday: style });
}

/** "2026-09-30" → "30 sept." (date calendaire locale, sans décalage de fuseau). */
export function fmtDay(day: string, lang: Lang, withYear = false): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString(lang, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

export function fmtDateTime(iso: string | Date | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso: string | Date | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "il y a 5 min" / "5 min ago". */
export function timeAgo(iso: string | Date | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Math.round((t - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 60) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / (86400 * 30)), 'month');
}

/** Variation en % entre deux valeurs (null si pas de base de comparaison). */
export function deltaPct(cur: number, prev: number): number | null {
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

/** Échappe une cellule CSV (séparateur ;, compatible Excel FR). */
export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, rows: unknown[][]): void {
  const body = '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Décale un jour calendaire "AAAA-MM-JJ" de `delta` jours (arithmétique UTC : pas de dérive d'heure d'été). */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** "mer. 14:00" — instant (ISO) affiché dans le fuseau du navigateur. */
export function fmtStamp(iso: string | Date, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Somme cumulée d'une série. */
export function cumulative(values: number[]): number[] {
  let acc = 0;
  return values.map((v) => (acc += v || 0));
}
