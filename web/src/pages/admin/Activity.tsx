import { useState } from 'react';
import { useAddon } from '../../context';
import { useT } from '../../i18n';
import { useStat } from '../../lib/api';
import { ActivityView, ActivityData } from '../../components/ActivityView';
import { Card, ErrorBox, Loading } from '../../components/ui';
import type { PageProps } from './types';

/** Heures / jours les plus actifs — global, par catégorie ou par compte. */
export default function Activity({ days, nonce }: PageProps) {
  const { token, tz } = useAddon();
  const t = useT();
  const [pool, setPool] = useState('');
  const [account, setAccount] = useState('');

  const cats = useStat<any>(token, 'categories', { days, tz }, { nonce });
  const accounts = useStat<any>(token, 'accounts', { days, tz, sort: 'bytes', limit: 200 }, { raw: true, nonce });
  const act = useStat<ActivityData>(token, 'activity', { days, tz, pool: pool || undefined, accountId: account || undefined }, { nonce });

  const categories: any[] = cats.data?.categories ?? [];
  const list: any[] = accounts.data?.data ?? [];

  return (
    <div className="space-y-4">
      <Card title={t('activity.scope')}>
        <div className="toolbar">
          <label className="text-xs text-muted">{t('activity.category')}</label>
          <select className="input" value={pool} onChange={(e) => { setPool(e.target.value); setAccount(''); }}>
            <option value="">{t('activity.all')}</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>{c.name ?? t('categories.default')}</option>
            ))}
          </select>
          <label className="text-xs text-muted">{t('activity.account')}</label>
          <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">{t('activity.all')}</option>
            {list
              .filter((a) => !pool || (pool === '__default__' ? !a.pool : a.pool === pool))
              .map((a) => (
                <option key={a.id} value={a.id}>{a.name && a.name !== a.username ? `${a.name} (${a.username})` : a.username}</option>
              ))}
          </select>
        </div>
      </Card>

      {act.loading && !act.data ? <Loading /> : act.error ? <ErrorBox message={act.error} onRetry={act.reload} /> : act.data ? <ActivityView data={act.data} showAccounts={!account} /> : null}
    </div>
  );
}
