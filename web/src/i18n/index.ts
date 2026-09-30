import { useCallback } from 'react';
import { useAddon } from '../context';
import { fmtBytes, fmtDay, fmtHour, fmtMs, fmtNum, fmtPct, timeAgo, weekdayName, Lang } from '../lib/format';
import { fr } from './fr';
import { en } from './en';

const DICT: Record<Lang, Record<string, string>> = { fr, en };

export type Params = Record<string, string | number | null | undefined>;

/**
 * Gabarits : `{name}` = valeur brute ; `{bytes:name}` octets, `{num:name}` nombre,
 * `{pct:name}` pourcentage, `{hour:name}` heure (14 → 14h), `{ms:name}` durée,
 * `{day:name}` jour AAAA-MM-JJ, `{dow:name}` jour de semaine (0 = dimanche),
 * `{ago:name}` date relative.
 */
export function translate(lang: Lang, key: string, params: Params = {}): string {
  const tpl = DICT[lang][key] ?? DICT.fr[key] ?? key;
  return tpl.replace(/\{(?:(\w+):)?(\w+)\}/g, (_m, kind: string | undefined, name: string) => {
    const v = params[name];
    if (v === undefined || v === null) return '';
    switch (kind) {
      case 'bytes': return fmtBytes(Number(v), lang);
      case 'num': return fmtNum(Number(v), lang);
      case 'pct': return fmtPct(Number(v), lang);
      case 'hour': return fmtHour(Number(v));
      case 'ms': return fmtMs(Number(v), lang);
      case 'day': return fmtDay(String(v), lang, true);
      case 'dow': return weekdayName(Number(v), lang, 'long');
      case 'ago': return timeAgo(String(v), lang);
      default: return String(v);
    }
  });
}

export function useT() {
  const { lang } = useAddon();
  return useCallback((key: string, params?: Params) => translate(lang, key, params), [lang]);
}
