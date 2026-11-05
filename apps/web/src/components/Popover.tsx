import type { ComponentChildren } from 'preact';

export function Popover({
  children,
  onClose,
  top = '100%',
  right = '0'
}: {
  children: ComponentChildren;
  onClose?: () => void;
  top?: string;
  right?: string;
}) {
  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 55 }}
        onClick={onClose}
      />
      <div className="popover" style={{ top, insetInlineEnd: right }}>
        {children}
      </div>
    </>
  );
}