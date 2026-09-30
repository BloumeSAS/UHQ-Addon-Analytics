import { useState } from 'react';
import { useAddon } from '../context';
import { useT } from '../i18n';
import { PeriodPicker, Tabs, Notice } from '../components/ui';
import Overview from './admin/Overview';
import Activity from './admin/Activity';
import Accounts from './admin/Accounts';
import Categories from './admin/Categories';
import Pool from './admin/Pool';
import Checker from './admin/Checker';
import Scraper from './admin/Scraper';
import Security from './admin/Security';

type TabId = 'overview' | 'activity' | 'accounts' | 'categories' | 'pool' | 'checker' | 'scraper' | 'security';

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
  const TABS: TabId[] = ['overview', 'activity', 'accounts', 'categories', 'pool', 'checker', 'scraper', 'security'];
  const [tab, setTab] = useState<TabId>(() => saved<TabId>('ana.tab', 'overview', (v) => TABS.includes(v as TabId)));
  const [days, setDays] = useState<number>(() => saved<number>('ana.days', 30, (v) => [1, 7, 30, 90, 365].includes(Number(v))));
  const [nonce, setNonce] = useState(0);

  const pickTab = (id: TabId) => {
    setTab(id);
    try { sessionStorage.setItem('ana.tab', id); } catch { /* stockage indisponible : sans conséquence */ }
  };
  const pickDays = (d: number) => {
    setDays(d);
    try { sessionStorage.setItem('ana.days', String(d)); } catch { /* idem */ }
  };

  if (role !== 'ADMIN' && role !== 'SUPPORT') {
    return <div className="page"><Notice tone="warn">{t('noAdmin')}</Notice></div>;
  }

  const props = { days, nonce };
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="section-title">{t('admin.title')}</h1>
        <div className="toolbar">
          <PeriodPicker value={days} onChange={pickDays} />
          <button className="btn btn-outline btn-sm" onClick={() => setNonce((n) => n + 1)}>↻ {t('refresh')}</button>
        </div>
      </div>

      <Tabs tabs={TABS.map((id) => ({ id, label: t(`tab.${id}`) }))} value={tab} onChange={pickTab} />

      {tab === 'overview' && <Overview {...props} />}
      {tab === 'activity' && <Activity {...props} />}
      {tab === 'accounts' && <Accounts {...props} />}
      {tab === 'categories' && <Categories {...props} />}
      {tab === 'pool' && <Pool {...props} />}
      {tab === 'checker' && <Checker {...props} />}
      {tab === 'scraper' && <Scraper {...props} />}
      {tab === 'security' && <Security {...props} />}
    </div>
  );
}
