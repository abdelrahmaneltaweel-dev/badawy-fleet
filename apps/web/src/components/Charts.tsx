export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  totalLabel = 'عربية'
}: {
  segments: DonutSegment[];
  totalLabel?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <div style={{ position: 'relative' }}>
        <svg className="donut-svg" viewBox="0 0 42 42">
          <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--line)" strokeWidth="4.5" />
          {segments.map((s, i) => {
            const percent = (s.value / total) * 100;
            const dashArray = `${percent} ${100 - percent}`;
            const currentOffset = offset;
            offset += percent;
            return (
              <circle
                key={i}
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke={s.color}
                strokeWidth="4.5"
                strokeDasharray={dashArray}
                strokeDashoffset={-currentOffset}
              />
            );
          })}
        </svg>
        <div className="donut-center">
          <b>{total}</b>
          <small>{totalLabel}</small>
        </div>
      </div>

      <div className="chart-legend">
        {segments.map((s, i) => (
          <div key={i} className="chart-legend-item">
            <span className="chart-legend-color" style={{ background: s.color }} />
            <span>{s.label}</span>
            <b style={{ marginInlineStart: 'auto', paddingInlineStart: '12px' }}>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  data,
  labels,
  goal,
  goalLabel = 'الهدف 45'
}: {
  data: number[];
  labels: string[];
  goal?: number;
  goalLabel?: string;
}) {
  const max = Math.max(...data, goal || 0) || 1;
  const goalPercent = goal ? (goal / max) * 100 : 0;

  return (
    <div>
      <div className="bars-wrap">
        {goal && (
          <div
            className="bars-goal"
            style={{ bottom: `${goalPercent}%` }}
            data-label={goalLabel}
          />
        )}
        {data.map((v, i) => {
          const height = Math.round((v / max) * 100);
          return (
            <div key={i} className="bar-col">
              <div
                className={`bar-fill ${v === Math.max(...data) ? 'active' : ''}`}
                style={{ height: `${height}%` }}
                title={`${v} نقلة`}
              />
            </div>
          );
        })}
      </div>
      <div className="bars-labels">
        {labels.map((lbl, i) => (
          <span key={i}>{lbl}</span>
        ))}
      </div>
    </div>
  );
}

export function RingProgress({
  percent,
  title = 'المطابقة',
  subtitle
}: {
  percent: number;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="ring-gauge" style={{ '--percent': percent } as any}>
        <div className="ring-gauge-circle" />
        <div className="donut-center">
          <b>{percent}%</b>
          <small>{title}</small>
        </div>
      </div>
      {subtitle && <p style={{ margin: '8px 0 0', color: 'var(--mute)', fontSize: '0.82rem' }}>{subtitle}</p>}
    </div>
  );
}