import { useMemo } from 'react';
import { useAddon } from '../context';
import { useT } from './index';

/**
 * Libellés des VALEURS renvoyées par le panel (fournisseur, pays, motifs…) :
 * le panel les stocke dans une seule langue ou sous forme de code — on les
 * traduit ici pour qu'aucune donnée affichée ne reste dans la mauvaise langue.
 */
export function useLabels() {
  const { lang } = useAddon();
  const t = useT();
  return useMemo(() => {
    let regions: Intl.DisplayNames | null = null;
    try {
      regions = new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      regions = null;
    }
    return {
      provider: (p: string | null | undefined) => (p ? p : t('label.unknownProvider')),
      /** Code ISO → nom du pays dans la langue de l'utilisateur ("FR" → "France (FR)"). */
      country: (c: string | null | undefined) => {
        if (!c || c === 'Unknown') return t('label.unknownCountry');
        const code = c.trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(code)) {
          try {
            const name = regions?.of(code);
            if (name && name !== code) return `${name} (${code})`;
          } catch {
            /* code non reconnu : affiché tel quel */
          }
        }
        return c;
      },
      /** Erreurs détectées côté cible (libellés écrits en anglais par le moteur). */
      reason: (r: string | null | undefined) => {
        switch (r) {
          case '403 Forbidden': return t('reason.forbidden');
          case 'Captcha detected': return t('reason.captcha');
          case 'Geo-blocked': return t('reason.geo');
          default: return r ?? '—';
        }
      },
      /** Motifs de bannissement automatiques (écrits en français par le moteur). */
      banReason: (r: string | null | undefined) => {
        if (!r) return '—';
        const auth = /^Auto-ban : (\d+)\+ échecs d'auth proxy en (\d+)s$/.exec(r);
        if (auth) return t('banreason.authFail', { n: auth[1], s: auth[2] });
        const vpn = /^Auto-ban : VPN détecté \(anti-VPN activé sur la pool "(.+)"\)$/.exec(r);
        if (vpn) return t('banreason.vpn', { pool: vpn[1] });
        return r;
      },
      actor: (email: string | null | undefined) => (email ? email : t('label.system')),
    };
  }, [lang, t]);
}
