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
  onPointerDown,
  ...props
}: ButtonProps) {
  const handlePointerDown = (e: JSX.TargetedPointerEvent<HTMLButtonElement>) => {
    if (onPointerDown) onPointerDown(e);
    if (disabled || loading) return;

    // Check if reduced motion is preferred
    const isReduced =
      document.documentElement.getAttribute('data-motion') === 'reduced' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    const btn = e.currentTarget;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const ripple = document.createElement('span');
    ripple.className = 'rip';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

    btn.appendChild(ripple);
    window.setTimeout(() => {
      ripple.remove();
    }, 550);
  };

  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      onPointerDown={handlePointerDown}
      {...props}
    >
      {loading ? <span className="spinner" /> : icon}
      {children}
    </button>
  );
}