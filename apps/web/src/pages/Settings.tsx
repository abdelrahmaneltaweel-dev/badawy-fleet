import { useState } from 'preact/hooks';
import { getStoredTheme, applyTheme, type ThemeMode } from '../theme';

interface ThemeOption {
  mode: ThemeMode;
  label: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'light', label: '☀️ النمط الفاتح (Light)' },
  { mode: 'dark', label: '🌙 النمط الداكن (Dark)' },
  { mode: 'auto', label: '🖥️ تلقائي حسب جهازك (System)' }
];

export default function Settings() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode);
  };

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={{ background: 'var(--card)', padding: '16px', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh-sm)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem', color: 'var(--ink)' }}>سجل الإعدادات (Settings Registry)</h2>
        <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>إدارة المظهر، الصلاحيات، الفترات، والأسعار (ADR-040)</p>
      </div>

      {/* قسم المظهر والـ Theme Tokens */}
      <div style={{ background: 'var(--card)', padding: '16px', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh-sm)' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: 'var(--ink)' }}>🎨 مظهر المنصة (Design Tokens)</h3>
        <p style={{ margin: '0 0 12px', color: 'var(--mute)', fontSize: '0.84rem' }}>اختر مظهر المنصة المفضل لديك؛ يتم الحفظ والتطبيق فورياً بدون وميض:</p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {THEME_OPTIONS.map(item => (
            <button
              key={item.mode}
              onClick={() => handleThemeChange(item.mode)}
              style={{
                background: themeMode === item.mode ? 'var(--acc)' : 'var(--soft)',
                color: themeMode === item.mode ? 'var(--acc-ink)' : 'var(--ink)',
                border: '1px solid ' + (themeMode === item.mode ? 'var(--acc)' : 'var(--line)'),
                borderRadius: 'var(--r-sm)',
                padding: '8px 14px',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--dur-fast) var(--e)'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* استعراض عينات ألوان الهوية والحالة */}
      <div style={{ background: 'var(--card)', padding: '16px', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh-sm)' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: 'var(--ink)' }}>🏷️ ألوان الحالة المعتمدة (Status Tokens)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
          <div style={{ background: 'var(--ok-soft)', color: 'var(--ok)', padding: '10px', borderRadius: 'var(--r-sm)', textAlign: 'center', fontWeight: 700 }}>
            Online (متصلة)
          </div>
          <div style={{ background: 'var(--bad-soft)', color: 'var(--bad)', padding: '10px', borderRadius: 'var(--r-sm)', textAlign: 'center', fontWeight: 700 }}>
            Offline (غير متصلة)
          </div>
          <div style={{ background: 'var(--warn-soft)', color: 'var(--warn)', padding: '10px', borderRadius: 'var(--r-sm)', textAlign: 'center', fontWeight: 700 }}>
            Standing (واقفة +30د)
          </div>
        </div>
      </div>
    </div>
  );
}