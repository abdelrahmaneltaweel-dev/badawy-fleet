import type { JSX, ComponentChildren } from 'preact';

export interface FieldProps extends JSX.HTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ComponentChildren;
  value?: string | number;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
}

export function Field({
  label,
  error,
  icon,
  className = '',
  id,
  type = 'text',
  placeholder,
  value,
  disabled,
  readOnly,
  required,
  min,
  max,
  step,
  ...props
}: FieldProps) {
  const inputId = id || (label ? `fld-${label}` : undefined);
  return (
    <div className="fld-wrapper">
      {label && <label htmlFor={inputId} className="fld-label">{label}</label>}
      <div className={`fld ${error ? 'has-error' : ''} ${className}`}>
        {icon && <span style={{ color: 'var(--mute)', display: 'grid' }}>{icon}</span>}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          min={min}
          max={max}
          step={step}
          {...props}
        />
      </div>
      {error && <span className="fld-error">{error}</span>}
    </div>
  );
}