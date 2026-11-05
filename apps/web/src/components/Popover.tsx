import type { ComponentChildren } from 'preact';

export interface PopoverProps {
  children: ComponentChildren;
  onClose?: () => void;
  top?: string;
  right?: string;
}

export function Popover({
  children,
  onClose,
  top = '100%',
  right = '0'
}: PopoverProps) {
  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 55 } as any}
        onClick={onClose}
      />
      <div className="popover" style={{ top, insetInlineEnd: right } as any}>
        {children}
      </div>
    </>
  );
}