export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked ? 'true' : 'false'}
        className="sw"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
      />
      {label && <span style={{ fontSize: '0.86rem', color: 'var(--ink)' }}>{label}</span>}
    </div>
  );
}