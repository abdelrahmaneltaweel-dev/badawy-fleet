import { useState, useEffect } from 'preact/hooks';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  title?: string;
  placeholder?: string;
}

export function Select({
  options,
  value,
  onChange,
  title = 'اختر من القائمة',
  placeholder = 'اختر...'
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <span style={{ fontSize: '0.74rem', color: 'var(--mute)' }}>▼</span>
      </button>

      {open && (
        <>
          {/* Backdrop for Mobile Bottom Sheet */}
          <div className="bottom-sheet-backdrop" onClick={() => setOpen(false)} />

          {/* Desktop Dropdown & Mobile Bottom Sheet */}
          <div className="custom-select-popover" role="listbox">
            <div className="bottom-sheet-handle" />
            <div style={{ padding: '0 8px 8px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--mute)' }}>
              {title}
            </div>
            {options.map(opt => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`select-option ${opt.value === value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {opt.value === value && <span>✓</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}