import type { JSX, ComponentChildren } from 'preact';

export interface ChipProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children?: ComponentChildren;
}

export function Chip({ active = false, children, className = '', ...props }: ChipProps) {
  return (
    <button
      className={`chip ${active ? 'active' : ''} ${className}`}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  );
}