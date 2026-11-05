import type { ComponentChildren } from 'preact';

export interface KPIProps {
  label: string;
  value: string | number;
  icon?: ComponentChildren;
  delta?: string;
  deltaType?: 'good' | 'bad' | 'neu';
  sparkline?: number[];
  sparkColor?: string;
}

export function KPI({
  label,
  value,
  icon,
  delta,
  deltaType = 'neu',
  sparkline,
  sparkColor = 'var(--acc)'
}: KPIProps) {
  // Generate smooth SVG Sparkline
  let sparkPath = '';
  if (sparkline && sparkline.length > 1) {
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline) || 1;
    const width = 100;
    const height = 32;
    const points = sparkline.map((v, i) => [
      (i * width) / (sparkline.length - 1),
      height - 4 - ((v - min) / (max - min || 1)) * (height - 8)
    ]);
    sparkPath = `M${points[0][0]},${points[0][1]}` +
      points.slice(1).map(p => ` L${p[0]},${p[1]}`).join('');
  }

  return (
    <div className="kpi">
      <div className="kpi-header">
        {icon && <div className="kpi-tile">{icon}</div>}
        {delta && <span className={`kpi-delta ${deltaType}`}>{delta}</span>}
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-label">{label}</div>
      {sparkPath && (
        <svg className="kpi-spark" viewBox="0 0 100 32" preserveAspectRatio="none">
          <path d={sparkPath} fill="none" stroke={sparkColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}