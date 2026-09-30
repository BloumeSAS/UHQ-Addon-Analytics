import { ReactNode, useEffect, useState } from 'react';
import { useT } from '../i18n';

export function Card({ title, right, children, className = '', pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`} style={pad ? undefined : { padding: 0, overflow: 'hidden' }}>
      {(title || right) && (
        <header className="card-head" style={pad ? undefined : { padding: '1rem 1.25rem 0' }}>
          <h3 className="card-title">{title}</h3>
          {right && <div className="flex items-center gap-2">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label, value, sub, delta, tone,
}: { label: string; value: ReactNode; sub?: ReactNode; delta?: number | null; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="card card-sm stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone ? { color: tone === 'good' ? 'var(--green)' : tone === 'bad' ? 'var(--red)' : '#f59e0b' } : undefined}>{value}</div>
      <div className="stat-sub">
        {delta !== undefined && delta !== null && (
          <span className={delta >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 600, marginRight: 6 }}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} %
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

export function Badge({ tone = 'muted', children, title }: { tone?: 'muted' | 'good' | 'bad' | 'warn' | 'info'; children: ReactNode; title?: string }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tb) => (
        <button key={tb.id} role="tab" aria-selected={tb.id === value} className={`tab ${tb.id === value ? 'active' : ''}`} onClick={() => onChange(tb.id)}>
          {tb.label}
        </button>
      ))}
    </div>
  );
}

export function PeriodPicker({ value, onChange, options = [1, 7, 30, 90, 365] }: { value: number; onChange: (d: number) => void; options?: number[] }) {
  const t = useT();
  return (
    <div className="seg" role="group" aria-label={t('period')}>
      {options.map((d) => (
        <button key={d} className={`seg-btn ${d === value ? 'active' : ''}`} onClick={() => onChange(d)}>
          {d === 1 ? t('period.24h') : d === 365 ? t('period.1y') : t('period.days', { n: d })}
        </button>
      ))}
    </div>
  );
}

export function Loading() {
  const t = useT();
  return <div className="loading">{t('loading')}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="alert alert-error flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && <button className="btn btn-outline btn-sm" onClick={onRetry}>{t('retry')}</button>}
    </div>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  const t = useT();
  return <div className="empty">{children ?? t('noData')}</div>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

/** En-tête de colonne triable. */
export function SortTh({ id, sort, order, onSort, children, right }: { id: string; sort: string; order: 'asc' | 'desc'; onSort: (id: string) => void; children: ReactNode; right?: boolean }) {
  const active = sort === id;
  return (
    <th className={`sortable ${active ? 'active' : ''}`} style={right ? { textAlign: 'right' } : undefined} onClick={() => onSort(id)} aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {children} <span className="sort-ind">{active ? (order === 'asc' ? '▲' : '▼') : ''}</span>
    </th>
  );
}

export function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  const t = useT();
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between" style={{ padding: '0.75rem 1rem' }}>
      <span className="text-xs text-muted">{t('pageOf', { page, pages, total })}</span>
      <div className="flex gap-2">
        <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))}>{t('previous')}</button>
        <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(offset + limit)}>{t('next')}</button>
      </div>
    </div>
  );
}

/** Valeur qui ne change qu'après `ms` d'inactivité (recherche au clavier). */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
