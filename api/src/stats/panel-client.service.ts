import { HttpException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function extractToken(req: Request): string {
  const auth = req.headers['authorization'] ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return (req.query['token'] as string) ?? '';
}

/** Décode le JWT de la requête (sans en vérifier la signature : c'est le panel qui l'authentifie à chaque appel). */
export function authenticate(req: Request): { token: string; payload: JwtPayload } {
  const token = extractToken(req);
  if (!token) throw new UnauthorizedException('Token manquant');
  const payload = decodeJwt(token);
  if (!payload?.sub) throw new UnauthorizedException('Token invalide');
  if (payload.exp && Date.now() / 1000 > payload.exp) throw new UnauthorizedException('Token expiré');
  return { token, payload };
}

interface CacheEntry {
  at: number;
  value?: unknown;
  pending?: Promise<unknown>;
}

/**
 * Client HTTP vers l'API d'analyse du panel (`/api/panel/analytics/*` et
 * `/api/panel/me/*`), avec le JWT de l'utilisateur — le panel applique
 * lui-même les rôles. Un petit cache mémoire (20 s par défaut, par
 * utilisateur) mutualise les requêtes identiques : plusieurs onglets ou
 * widgets qui demandent les mêmes agrégats ne refont pas les requêtes SQL.
 */
@Injectable()
export class PanelClient {
  private readonly logger = new Logger(PanelClient.name);
  private readonly cache = new Map<string, CacheEntry>();

  private get panelUrl(): string {
    return (process.env.PANEL_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
  }
  private get ttlMs(): number {
    const s = Number(process.env.CACHE_TTL_SECONDS ?? 20);
    return (Number.isFinite(s) && s >= 0 ? s : 20) * 1000;
  }

  async get<T = any>(path: string, token: string, query: Record<string, unknown> = {}, userKey = '', fresh = false): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && String(v) !== '') qs.set(k, String(v));
    }
    const url = `${this.panelUrl}${path}${qs.toString() ? `?${qs}` : ''}`;
    const key = `${userKey}|${url}`;
    const now = Date.now();

    const hit = this.cache.get(key);
    if (!fresh && hit && now - hit.at < this.ttlMs) return (await (hit.pending ?? hit.value)) as T;

    const pending = this.fetchJson<T>(url, token);
    this.cache.set(key, { at: now, pending });
    try {
      const value = await pending;
      this.cache.set(key, { at: Date.now(), value });
      this.prune();
      return value;
    } catch (e) {
      this.cache.delete(key); // ne jamais mettre une erreur en cache
      throw e;
    }
  }

  private async fetchJson<T>(url: string, token: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e: any) {
      this.logger.warn(`Panel injoignable (${url}) : ${e?.message ?? e}`);
      throw new HttpException(`Panel injoignable : ${e?.message ?? e}`, 502);
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? `HTTP ${res.status}`;
      throw new HttpException(String(msg), res.status);
    }
    return body as T;
  }

  private prune() {
    if (this.cache.size <= 400) return;
    const cutoff = Date.now() - this.ttlMs;
    for (const [k, v] of this.cache) if (v.at < cutoff) this.cache.delete(k);
  }
}
