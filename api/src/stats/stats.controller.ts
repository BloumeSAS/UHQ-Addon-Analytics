import { Controller, ForbiddenException, Get, NotFoundException, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { InsightsService } from './insights.service';
import { PanelClient, authenticate } from './panel-client.service';

/** Sections exposées par le panel sous /api/panel/analytics/<section>. */
const SECTIONS = new Set(['overview', 'accounts', 'activity', 'categories', 'pool', 'checker', 'scraper', 'security']);
/** Paramètres de requête transmis tels quels au panel (liste blanche). */
const FORWARDED = ['days', 'tz', 'q', 'sort', 'order', 'limit', 'offset', 'pool', 'status', 'accountId'];

function isStaff(role?: string): boolean {
  return role === 'ADMIN' || role === 'SUPPORT';
}

/**
 * API de l'addon. Toutes les routes relaient l'API d'analyse du panel avec le
 * JWT de l'appelant (le panel applique les rôles : ADMIN/SUPPORT pour les
 * statistiques globales, propriétaire pour « mon activité »).
 */
@Controller('api/stats')
export class StatsController {
  constructor(
    private readonly panel: PanelClient,
    private readonly insights: InsightsService,
  ) {}

  /** `?fresh=1` (bouton Actualiser) : contourne le cache mémoire de l'addon. */
  private isFresh(req: Request): boolean {
    return req.query['fresh'] === '1';
  }

  private forward(req: Request) {
    const q: Record<string, unknown> = {};
    for (const k of FORWARDED) if (req.query[k] !== undefined) q[k] = req.query[k];
    return q;
  }

  /** GET /api/stats/insights — constats et alertes calculés sur l'ensemble du panel. */
  @Get('insights')
  async getInsights(@Req() req: Request, @Query('days') days = '30', @Query('tz') tz = 'UTC') {
    const { token, payload } = authenticate(req);
    if (!isStaff(payload.role)) throw new ForbiddenException('Accès refusé');
    const d = Math.max(1, Math.min(365, parseInt(days, 10) || 30));
    return { status: 'success', data: await this.insights.build(token, payload.sub, d, tz) };
  }

  /**
   * GET /api/stats/me — activité de MES comptes proxy (tout utilisateur).
   * Liste les comptes assignés puis charge, pour chacun, son activité
   * (heures / jours) et son usage journalier. Plafonné à 12 comptes.
   */
  @Get('me')
  async mine(@Req() req: Request, @Query('days') days = '30', @Query('tz') tz = 'UTC') {
    const { token, payload } = authenticate(req);
    const list: any = await this.panel.get('/api/panel/me/proxies', token, {}, payload.sub);
    const accounts: any[] = (list?.data ?? []).slice(0, 12);
    const period = Number(days) <= 7 ? 'week' : Number(days) <= 30 ? 'month' : Number(days) <= 365 ? 'year' : 'all';

    const detailed = await Promise.all(
      accounts.map(async (a) => {
        const [activity, usage] = await Promise.allSettled([
          this.panel.get<any>(`/api/panel/me/proxies/${a.id}/activity`, token, { days, tz }, payload.sub),
          this.panel.get<any>(`/api/panel/me/proxies/${a.id}/usage`, token, { period }, payload.sub),
        ]);
        return {
          id: a.id,
          username: a.username,
          label: a.label,
          pool: a.pool ?? null,
          isBlocked: !!a.is_blocked,
          expiresAt: a.expires_at ?? null,
          trafficLimit: a.traffic_limit ?? null,
          bytesSent: a.bytes_sent ?? 0,
          bytesReceived: a.bytes_received ?? 0,
          threadsLimit: a.threads_limit ?? null,
          activity: activity.status === 'fulfilled' ? activity.value?.data ?? null : null,
          usage: usage.status === 'fulfilled' ? usage.value : null,
        };
      }),
    );
    return { status: 'success', data: { accounts: detailed, period: { days: Number(days) || 30, tz } } };
  }

  /** GET /api/stats/accounts/:id — détail complet d'un compte (staff). */
  @Get('accounts/:id')
  async account(@Req() req: Request, @Param('id') id: string) {
    const { token, payload } = authenticate(req);
    if (!isStaff(payload.role)) throw new ForbiddenException('Accès refusé');
    return this.panel.get(`/api/panel/analytics/accounts/${encodeURIComponent(id)}`, token, this.forward(req), payload.sub, this.isFresh(req));
  }

  /** GET /api/stats/:section — relais d'un agrégat global du panel (staff). */
  @Get(':section')
  async section(@Req() req: Request, @Param('section') section: string) {
    if (!SECTIONS.has(section)) throw new NotFoundException('Section inconnue');
    const { token, payload } = authenticate(req);
    if (!isStaff(payload.role)) throw new ForbiddenException('Accès refusé');
    return this.panel.get(`/api/panel/analytics/${section}`, token, this.forward(req), payload.sub, this.isFresh(req));
  }
}
