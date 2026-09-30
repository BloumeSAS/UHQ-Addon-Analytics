import { useMemo, useRef, useState, ReactNode } from 'react';

/** Palette catégorielle (la 1re suit la couleur primaire du panel). */
export const PALETTE = ['var(--primary)', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#84cc16', '#64748b'];
export const colorAt = (i: number) => PALETTE[i % PALETTE.length];

// ───────────────────────────────────────────────────────────────────────────
// Barres verticales
// ───────────────────────────────────────────────────────────────────────────
export interface BarDatum {
  label: string;
  value: number;
  /** Texte de l'infobulle (défaut : label + valeur formatée). */
  tip?: string;
  color?: string;
}

export function BarChart({
  data, height = 150, fmt, labelEvery = 1, highlight, color = 'var(--primary)',
}: {
  data: BarDatum[];
  height?: number;
  fmt: (n: number) => string;
  labelEvery?: number;
  /** Indice à mettre en valeur (ex. heure de pointe). */
  highlight?: number | null;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="bars" style={{ height }}>
        {data.map((d, i) => {
          const pct = d.value <= 0 ? 0 : Math.max(2, (d.value / max) * 100);
          const hi = highlight === i;
          return (
            <div key={i} className="bar-col" title={d.tip ?? `${d.label} — ${fmt(d.value)}`}>
              <div
                className="bar-fill"
                style={{ height: `${pct}%`, background: d.color ?? color, opacity: highlight == null || hi ? 1 : 0.55, outline: hi ? '2px solid var(--fg)' : undefined }}
              />
            </div>
          );
        })}
      </div>
      <div className="bar-labels">
        {data.map((d, i) => (
          <span key={i}>{i % labelEvery === 0 ? d.label : ''}</span>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Courbes / aires (empilées ou non) avec infobulle
// ───────────────────────────────────────────────────────────────────────────
export interface Series {
  name: string;
  color: string;
  values: number[];
}

export function AreaChart({
  labels, series, height = 200, fmt, stacked = false, xFmt, yFmt, area = true,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  fmt: (n: number) => string;
  stacked?: boolean;
  xFmt?: (label: string) => string;
  yFmt?: (n: number) => string;
  area?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;

  const { max, layers } = useMemo(() => {
    const acc = new Array(n).fill(0);
    const layers = series.map((s) => {
      const base = stacked ? [...acc] : new Array(n).fill(0);
      const top = s.values.map((v, i) => base[i] + (v || 0));
      if (stacked) top.forEach((v, i) => (acc[i] = v));
      return { s, base, top };
    });
    const max = Math.max(1, ...layers.flatMap((l) => l.top));
    return { max, layers };
  }, [series, n, stacked]);

  if (n === 0) return <div className="empty text-xs">—</div>;

  const W = 1000;
  const H = 100;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(ratio * (n - 1)));
  };

  const yLabel = yFmt ?? fmt;
  const tick = Math.max(1, Math.ceil(n / 6));
  const hx = hover === null ? 0 : (hover / Math.max(1, n - 1)) * 100;

  return (
    <div className="area-wrap">
      <div className="area-y">
        {[1, 0.75, 0.5, 0.25, 0].map((f) => (
          <span key={f}>{yLabel(max * f)}</span>
        ))}
      </div>
      <div className="area-main">
        <div ref={ref} className="area-plot" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%">
            {[0, 25, 50, 75, 100].map((g) => (
              <line key={g} x1="0" x2={W} y1={g} y2={g} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {layers.map(({ s, base, top }, k) => (
              <g key={k}>
                {area && (
                  <path
                    d={`${line(top)} L${x(n - 1)},${y(stacked ? base[n - 1] : 0)} ${[...base].reverse().map((v, j) => `L${x(n - 1 - j).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} Z`}
                    fill={s.color}
                    opacity={stacked ? 0.55 : 0.16}
                  />
                )}
                <path d={line(top)} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </g>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="var(--fg2)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          </svg>
          {hover !== null && (
            <div className="tooltip" style={{ left: `${hx}%`, transform: `translateX(${hx > 60 ? '-105%' : '8%'})` }}>
              <div className="tooltip-title">{xFmt ? xFmt(labels[hover]) : labels[hover]}</div>
              {series.map((s, i) => (
                <div key={i} className="tooltip-row">
                  <span className="dot" style={{ background: s.color }} /> {s.name}
                  <b>{fmt(s.values[hover] || 0)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="area-x">
          {labels.map((l, i) => (
            <span key={i}>{i % tick === 0 ? (xFmt ? xFmt(l) : l) : ''}</span>
          ))}
        </div>
        {series.length > 1 && <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Carte de chaleur jours × heures
// ───────────────────────────────────────────────────────────────────────────
export function Heatmap({
  matrix, fmt, dayLabel, hourLabel = (h) => `${h}`,
}: {
  /** matrix[dow][hour], dow 0 = dimanche. */
  matrix: number[][];
  fmt: (n: number) => string;
  dayLabel: (dow: number) => string;
  hourLabel?: (h: number) => string;
}) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="heat">
      <div className="heat-row heat-head">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h}>{h % 3 === 0 ? hourLabel(h) : ''}</span>
        ))}
      </div>
      {order.map((dow) => (
        <div key={dow} className="heat-row">
          <span className="heat-day">{dayLabel(dow)}</span>
          {Array.from({ length: 24 }, (_, h) => {
            const v = matrix[dow]?.[h] ?? 0;
            const a = v <= 0 ? 0 : 10 + 90 * Math.pow(v / max, 0.6);
            return (
              <span
                key={h}
                className="heat-cell"
                title={`${dayLabel(dow)} ${hourLabel(h)} — ${fmt(v)}`}
                style={{ background: v <= 0 ? 'var(--bg2)' : `color-mix(in srgb, var(--primary) ${a.toFixed(0)}%, transparent)` }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Barres horizontales (classements)
// ───────────────────────────────────────────────────────────────────────────
export interface HRow {
  label: ReactNode;
  value: number;
  sub?: ReactNode;
  color?: string;
  tip?: string;
}

export function HBars({ rows, fmt, empty = '—' }: { rows: HRow[]; fmt: (n: number) => string; empty?: string }) {
  if (!rows.length) return <div className="empty text-xs">{empty}</div>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r, i) => (
        <div key={i} className="hbar" title={r.tip}>
          <div className="hbar-label">{r.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / max) * 100)}%`, background: r.color ?? colorAt(0) }} />
          </div>
          <div className="hbar-value">
            {fmt(r.value)}
            {r.sub && <span className="hbar-sub">{r.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Anneau + barre segmentée + légende
// ───────────────────────────────────────────────────────────────────────────
export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <span key={i} className="legend-item">
          <span className="dot" style={{ background: it.color }} />
          {it.label}
          {it.value !== undefined && <b>{it.value}</b>}
        </span>
      ))}
    </div>
  );
}

export function Donut({ slices, center, fmt, size = 150 }: { slices: Slice[]; center?: ReactNode; fmt: (n: number) => string; size?: number }) {
  const total = slices.reduce((n, s) => n + Math.max(0, s.value), 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="donut">
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg2)" strokeWidth="14" />
          {total > 0 &&
            slices.map((s, i) => {
              const len = (Math.max(0, s.value) / total) * C;
              const el = (
                <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}>
                  <title>{`${s.label} — ${fmt(s.value)} (${Math.round((s.value / total) * 100)} %)`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
        </svg>
        {center && <div className="donut-center">{center}</div>}
      </div>
      <Legend items={slices.map((s) => ({ label: s.label, color: s.color, value: `${fmt(s.value)}${total ? ` · ${Math.round((s.value / total) * 100)} %` : ''}` }))} />
    </div>
  );
}

export function SegBar({ slices, fmt }: { slices: Slice[]; fmt: (n: number) => string }) {
  const total = slices.reduce((n, s) => n + Math.max(0, s.value), 0);
  return (
    <div>
      <div className="segbar">
        {total > 0 &&
          slices.filter((s) => s.value > 0).map((s, i) => (
            <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label} — ${fmt(s.value)}`} />
          ))}
      </div>
      <Legend items={slices.map((s) => ({ label: s.label, color: s.color, value: fmt(s.value) }))} />
    </div>
  );
}

/** Jauge de quota : vert → orange → rouge. */
export function Gauge({ pct, label }: { pct: number | null; label?: string }) {
  if (pct === null) return <span className="text-muted text-xs">∞</span>;
  const c = pct >= 100 ? 'var(--red)' : pct >= 80 ? '#f59e0b' : 'var(--green)';
  return (
    <div className="gauge" title={label}>
      <div className="gauge-track"><div style={{ width: `${Math.min(100, pct)}%`, background: c }} /></div>
      <span className="text-xs">{Math.round(pct)} %</span>
    </div>
  );
}
