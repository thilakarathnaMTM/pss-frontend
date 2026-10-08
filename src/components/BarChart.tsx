import { useEffect, useRef, useState } from 'react';

export type BarSeries = { key: string; label: string; color: string; values: number[] };

type Props = {
  title: string;
  subtitle?: string;
  categories: string[];
  series: BarSeries[];
  format: (n: number) => string; // tooltip values
  axisFormat: (n: number) => string; // y-axis ticks
};

const HEIGHT = 250;
const M = { top: 10, right: 6, bottom: 24, left: 58 };
const GAP = 2; // surface gap between adjacent bars

function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(v);
  return ticks;
}

// Bar with a 4px rounded data-end and a square baseline.
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function BarChart({ title, subtitle, categories, series, format, axisFormat }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => M.top + innerH - (v / top) * innerH;
  const band = innerW / categories.length;
  const n = Math.max(series.length, 1);
  const barW = Math.max(3, Math.min(24, (band * 0.72 - GAP * (n - 1)) / n));
  const groupW = n * barW + (n - 1) * GAP;

  const tipLeft = active === null ? 0 : Math.min(Math.max(M.left + band * active + band / 2, 90), width - 90);

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {series.length > 1 && (
          <div className="chart-legend">
            {series.map((s) => (
              <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
            ))}
          </div>
        )}
      </div>
      <div className="chart-wrap" ref={wrap} onMouseLeave={() => setActive(null)}>
        <svg width={width} height={HEIGHT} role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="chart-gridline" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">{axisFormat(t)}</text>
            </g>
          ))}
          {categories.map((c, i) => {
            const x0 = M.left + band * i;
            return (
              <g key={c}>
                {active === i && <rect x={x0} y={M.top} width={band} height={innerH} className="chart-hover-band" />}
                {series.map((s, k) => {
                  const v = s.values[i] ?? 0;
                  const h = Math.max(0, (v / top) * innerH);
                  const x = x0 + (band - groupW) / 2 + k * (barW + GAP);
                  return v > 0 ? <path key={s.key} d={barPath(x, M.top + innerH - h, barW, h)} fill={s.color} /> : null;
                })}
                <text x={x0 + band / 2} y={HEIGHT - 6} textAnchor="middle" className="chart-axis">{c}</text>
                {/* Hit target: the whole column, bigger than the bars. */}
                <rect x={x0} y={M.top} width={band} height={innerH} fill="transparent"
                  onMouseEnter={() => setActive(i)} onTouchStart={() => setActive(i)} />
              </g>
            );
          })}
          <line x1={M.left} x2={width - M.right} y1={M.top + innerH} y2={M.top + innerH} className="chart-baseline" />
        </svg>
        {active !== null && (
          <div className="chart-tip" style={{ left: tipLeft }}>
            <b>{categories[active]}</b>
            {series.map((s) => (
              <span key={s.key}><i style={{ background: s.color }} />{s.label}<em>{format(s.values[active] ?? 0)}</em></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
