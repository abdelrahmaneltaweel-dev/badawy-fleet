import type { JSX, ComponentChildren } from 'preact';

export interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'warning' | 'danger' | 'ghost';
  loading?: boolean;
  icon?: ComponentChildren;
  children?: ComponentChildren;
}

export function Button({
  variant = 'secondary',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="spinner" /> : icon}
      {children}
    </button>
  );
}