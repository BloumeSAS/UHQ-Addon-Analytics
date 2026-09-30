import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Client HTTP de l'addon. Les URLs sont préfixées par BASE_URL ("/" en
 * déploiement classique, "/addon-proxy/analytics/" une fois embarqué dans le
 * panel) : jamais de chemin absolu "/api/..." qui ne passerait pas par le proxy.
 */
export function createApi(token: string) {
  const base = import.meta.env.BASE_URL;

  async function request<T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== null && String(v) !== '') qs.set(k, String(v));
    }
    const res = await fetch(`${base}api/${path}${qs.toString() ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (data as any)?.message ?? (data as any)?.error ?? `HTTP ${res.status}`;
      throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
    }
    return data as T;
  }

  return { get: request };
}

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
}

/** Charge `stats/<path>` (réponse { status, data, ... }) et le recharge quand les paramètres changent. */
export function useStat<T = any>(
  token: string,
  path: string,
  params: Record<string, unknown> = {},
  opts: { enabled?: boolean; raw?: boolean; nonce?: number } = {},
): FetchState<T> {
  const enabled = opts.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([path, params]);
  const seq = useRef(0);
  const fresh = useRef(false);
  // `nonce` (bouton Actualiser du panneau) : un changement force un rechargement SANS cache.
  const nonce = opts.nonce ?? 0;
  const lastNonce = useRef(nonce);
  if (nonce !== lastNonce.current) {
    lastNonce.current = nonce;
    fresh.current = true;
  }

  useEffect(() => {
    if (!enabled || !token) return;
    const ctrl = new AbortController();
    const id = ++seq.current;
    setLoading(true);
    setError('');
    createApi(token)
      .get<any>(`stats/${path}`, fresh.current ? { ...params, fresh: 1 } : params, ctrl.signal)
      .then((r) => {
        if (id !== seq.current) return;
        fresh.current = false;
        setData(opts.raw ? r : (r?.data as T));
      })
      .catch((e) => {
        if (id !== seq.current || e?.name === 'AbortError') return;
        setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key, enabled, tick, nonce]);

  const reload = useCallback(() => {
    fresh.current = true;
    setTick((t) => t + 1);
  }, []);
  return { data, loading, error, reload };
}
