import type { JSX, ComponentChildren } from 'preact';

export interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'warning' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: ComponentChildren;
  children?: ComponentChildren;
}

export function Button({
  variant = 'secondary',
  loading = false,
  disabled = false,
  type = 'button',
  icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="spinner" /> : icon}
      {children}
    </button>
  );
}