import { useState } from 'react';
import { useAddon } from '../context';
import { useT } from '../i18n';
import { Icon, IconName } from '../components/icons';
import { PeriodPicker, Notice } from '../components/ui';
import Overview from './admin/Overview';
import Activity from './admin/Activity';
import Accounts from './admin/Accounts';
import Categories from './admin/Categories';
import Pool from './admin/Pool';
import Checker from './admin/Checker';
import Scraper from './admin/Scraper';
import Security from './admin/Security';

/**
 * Sections, regroupées comme dans Paramètres du panel : le menu latéral
 * affiche un titre de groupe puis, pour chaque section, icône + libellé +
 * courte description ; le panneau actif commence par un chapeau (icône, titre,
 * description).
 */
const SECTIONS = [
  { id: 'overview', icon: 'overview', group: 'overview' },
  { id: 'activity', icon: 'activity', group: 'usage' },
  { id: 'accounts', icon: 'accounts', group: 'usage' },
  { id: 'categories', icon: 'categories', group: 'usage' },
  { id: 'pool', icon: 'pool', group: 'infra' },
  { id: 'checker', icon: 'checker', group: 'infra' },
  { id: 'scraper', icon: 'scraper', group: 'infra' },
  { id: 'security', icon: 'security', group: 'security' },
] as const satisfies readonly { id: string; icon: IconName; group: string }[];

const GROUPS = ['overview', 'usage', 'infra', 'security'] as const;

type TabId = (typeof SECTIONS)[number]['id'];

function saved<T extends string | number>(key: string, def: T, valid: (v: unknown) => boolean): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return def;
    const v = (typeof def === 'number' ? Number(raw) : raw) as T;
    return valid(v) ? v : def;
  } catch {
    return def;
  }
}

/** Panneau d'analyse complet (ADMIN / SUPPORT) : 8 sections, fenêtre de 1 j à 1 an, actualisation sans cache. */
export default function Admin() {
  const { role } = useAddon();
  const t = useT();
  const ids = SECTIONS.map((s) => s.id) as string[];
  const [tab, setTab] = useState<TabId>(() => saved<TabId>('ana.tab', 'overview', (v) => ids.includes(v as string)));
  const [days, setDays] = useState<number>(() => saved<number>('ana.days', 30, (v) => [1, 7, 30, 90, 365].includes(Number(v))));
  const [nonce, setNonce] = useState(0);

  const pickTab = (id: TabId) => {
    setTab(id);
    window.scrollTo({ top: 0 });
    try { sessionStorage.setItem('ana.tab', id); } catch { /* stockage indisponible : sans conséquence */ }
  };
  const pickDays = (d: number) => {
    setDays(d);
    try { sessionStorage.setItem('ana.days', String(d)); } catch { /* idem */ }
  };

  if (role !== 'ADMIN' && role !== 'SUPPORT') {
    return <div className="page"><Notice tone="warn">{t('noAdmin')}</Notice></div>;
  }

  const active = SECTIONS.find((s) => s.id === tab)!;
  const props = { days, nonce };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="section-title">{t('admin.title')}</h1>
          <p className="text-sm text-muted">{t('admin.subtitle')}</p>
        </div>
        <div className="toolbar">
          <PeriodPicker value={days} onChange={pickDays} />
          <button className="btn btn-outline btn-sm" onClick={() => setNonce((n) => n + 1)}>↻ {t('refresh')}</button>
        </div>
      </div>

      <div className="settings">
        {/* ── Menu latéral (groupes → sections), comme Paramètres ── */}
        <nav className="snav" aria-label={t('admin.title')}>
          {GROUPS.map((g) => (
            <div key={g} className="snav-group">
              <p className="snav-group-title">{t(`group.${g}`)}</p>
              {SECTIONS.filter((s) => s.group === g).map((s) => (
                <button key={s.id} type="button" className={`snav-item ${s.id === tab ? 'active' : ''}`} aria-current={s.id === tab ? 'page' : undefined} onClick={() => pickTab(s.id)}>
                  <span style={{ marginTop: 2 }}><Icon name={s.icon} /></span>
                  <span>
                    <span className="snav-label">{t(`tab.${s.id}`)}</span>
                    <span className="snav-desc">{t(`tab.${s.id}Desc`)}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Panneau actif ── */}
        <div className="settings-main space-y-4">
          <div className="section-head">
            <div className="section-icon"><Icon name={active.icon} size={18} /></div>
            <div>
              <h2>{t(`tab.${active.id}`)}</h2>
              <p>{t(`tab.${active.id}Desc`)}</p>
            </div>
          </div>

          {tab === 'overview' && <Overview {...props} />}
          {tab === 'activity' && <Activity {...props} />}
          {tab === 'accounts' && <Accounts {...props} />}
          {tab === 'categories' && <Categories {...props} />}
          {tab === 'pool' && <Pool {...props} />}
          {tab === 'checker' && <Checker {...props} />}
          {tab === 'scraper' && <Scraper {...props} />}
          {tab === 'security' && <Security {...props} />}
        </div>
      </div>
    </div>
  );
}
