import type { ComponentChildren } from 'preact';

export function Table({ children, className = '' }: { children: ComponentChildren; className?: string }) {
  return (
    <div className={`table-wrap ${className}`}>
      <table className="data-table">{children}</table>
    </div>
  );
}

export function StatusBadge({ status }: { status: 'online' | 'offline' | 'idle' }) {
  const labels = { online: 'متصلة', offline: 'Offline', idle: 'واقفة' };
  return (
    <span className={`status-badge ${status}`}>
      <span className="status-dot" />
      <span>{labels[status]}</span>
    </span>
  );
}

export function ProgressBar({ current, max }: { current: number; max: number }) {
  const percent = Math.min(100, Math.round((current / (max || 1)) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '110px' }}>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: `${percent}%` }} />
      </div>
      <span style={{ fontSize: '0.78rem', color: 'var(--mute)', direction: 'ltr' }}>
        {current}/{max}
      </span>
    </div>
  );
}