import { Request } from 'express';

export type Lang = 'fr' | 'en';

/** Langue de l'appelant : en-tête `x-lang` (envoyé par l'interface), sinon `?lang=`, sinon Accept-Language, sinon français. */
export function langOf(req: Pick<Request, 'headers' | 'query'>): Lang {
  const raw = String(req.headers['x-lang'] ?? req.query?.['lang'] ?? req.headers['accept-language'] ?? 'fr').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'fr';
}

const MESSAGES = {
  tokenMissing: { fr: 'Token manquant', en: 'Missing token' },
  tokenInvalid: { fr: 'Token invalide', en: 'Invalid token' },
  tokenExpired: { fr: 'Token expiré', en: 'Expired token' },
  forbidden: { fr: 'Accès refusé', en: 'Access denied' },
  unknownSection: { fr: 'Section inconnue', en: 'Unknown section' },
  panelDown: { fr: 'Panel injoignable', en: 'Panel unreachable' },
} as const;

export type MessageKey = keyof typeof MESSAGES;

export function msg(lang: Lang, key: MessageKey): string {
  return MESSAGES[key][lang];
}
