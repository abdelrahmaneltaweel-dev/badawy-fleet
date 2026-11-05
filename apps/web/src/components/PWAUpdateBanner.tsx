import { useState, useEffect } from 'preact/hooks';
import { subscribePWA, type PWAState } from '../pwa';
import { Button } from './Button';

export function PWAUpdateBanner() {
  const [pwaState, setPwaState] = useState<PWAState | null>(null);

  useEffect(() => {
    return subscribePWA(setPwaState);
  }, []);

  if (!pwaState || !pwaState.updateAvailable) return null;

  return (
    <aside
      aria-label="تنبيه تحديث المنصة"
      style={{
        position: 'fixed',
        top: '14px',
        insetInline: '14px',
        marginInline: 'auto',
        maxWidth: '480px',
        background: 'var(--card)',
        border: '1px solid var(--acc)',
        borderRadius: 'var(--r-sm)',
        boxShadow: 'var(--sh-float)',
        padding: '10px 14px',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.2rem' }}>🚀</span>
        <div>
          <b style={{ display: 'block', fontSize: '0.86rem', color: 'var(--ink)' }}>يتوفر تحديث جديد للمنصة</b>
          <small style={{ color: 'var(--mute)', fontSize: '0.76rem' }}>اضغط لتطبيق التحديث فورياً</small>
        </div>
      </div>
      <Button
        variant="primary"
        onClick={pwaState.update}
        style={{ minHeight: '32px', padding: '4px 14px', fontSize: '0.8rem' }}
      >
        تحديث الآن
      </Button>
    </aside>
  );
}