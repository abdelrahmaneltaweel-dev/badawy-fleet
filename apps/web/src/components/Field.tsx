import type { JSX, ComponentChildren } from 'preact';

export interface FieldProps extends JSX.HTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ComponentChildren;
}

export function Field({ label, error, icon, className = '', id, ...props }: FieldProps) {
  const inputId = id || (label ? `fld-${label}` : undefined);
  return (
    <div className="fld-wrapper">
      {label && <label htmlFor={inputId} className="fld-label">{label}</label>}
      <div className={`fld ${error ? 'has-error' : ''} ${className}`}>
        {icon && <span style={{ color: 'var(--mute)', display: 'grid' }}>{icon}</span>}
        <input id={inputId} {...props} />
      </div>
      {error && <span className="fld-error">{error}</span>}
    </div>
  );
}