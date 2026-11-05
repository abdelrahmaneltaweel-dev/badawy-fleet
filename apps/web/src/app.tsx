import { useState, useEffect } from 'preact/hooks';
import { useRouter } from './router';
import { getStoredTheme, applyTheme, type ThemeMode } from './theme';
import { ToastContainer } from './components/Toast';

const routes = [
  { path: '/', component: () => import('./pages/Dashboard') },
  { path: '/fleet', component: () => import('./pages/Fleet') },
  { path: '/reports', component: () => import('./pages/Reports') },
  { path: '/inquiries', component: () => import('./pages/Inquiries') },
  { path: '/petro', component: () => import('./pages/Petro') },
  { path: '/settings', component: () => import('./pages/Settings') },
  { path: '/showcase', component: () => import('./pages/Showcase') }
];

export function App() {
  const { currentPath, Component, loading } = useRouter(routes);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    const nextMode: ThemeMode = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light';
    setThemeMode(nextMode);
  };

  const navItems = [
    { path: '/', label: 'الرئيسية', icon: '📊' },
    { path: '/fleet', label: 'الأسطول', icon: '🚛' },
    { path: '/reports', label: 'التقارير', icon: '📑' },
    { path: '/inquiries', label: 'الاستفسارات', icon: '💬' },
    { path: '/petro', label: 'العهدة', icon: '💳' },
    { path: '/settings', label: 'الإعدادات', icon: '⚙️' },
    { path: '/showcase', label: 'المكونات', icon: '🎨' }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* Toast Notification Mount */}
      <ToastContainer />

      {/* Header */}
      <header style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--line)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: 'var(--sh-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="./brand/mark.png" alt="Badawi Group" style={{ height: '28px' }} />
          <b style={{ fontSize: '1.05rem', color: 'var(--acc)' }}>Badawi Fleet</b>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleTheme}
            title={`المظهر الحالي: ${themeMode === 'auto' ? 'تلقائي' : themeMode === 'dark' ? 'داكن' : 'فاتح'}`}
            style={{
              background: 'var(--soft)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              padding: '6px 10px',
              color: 'var(--ink)',
              cursor: 'pointer',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{themeMode === 'dark' ? '🌙' : themeMode === 'light' ? '☀️' : '🖥️'}</span>
            <span style={{ fontSize: '0.78rem' }}>{themeMode === 'auto' ? 'تلقائي' : themeMode === 'dark' ? 'داكن' : 'فاتح'}</span>
          </button>

          <span style={{ fontSize: '0.78rem', background: 'var(--soft)', color: 'var(--mute)', padding: '6px 10px', borderRadius: 'var(--r-full)' }}>
            Spark
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '16px', maxWidth: '1200px', width: '100%', margin: '0 auto', marginBottom: '70px' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '200px', color: 'var(--mute)' }}>
            جاري التحميل...
          </div>
        ) : (
          Component && <Component />
        )}
      </main>

      {/* Mobile Floating Bottom Dock (التنقل العائم للموبايل) */}
      <nav style={{
        position: 'fixed',
        bottom: '12px',
        left: '12px',
        right: '12px',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-xl)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 4px',
        boxShadow: 'var(--sh-float)',
        zIndex: 20
      }}>
        {navItems.map(item => {
          const isActive = currentPath === item.path;
          return (
            <a
              key={item.path}
              href={`#${item.path}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textDecoration: 'none',
                color: isActive ? 'var(--acc)' : 'var(--mute)',
                fontSize: '0.74rem',
                fontWeight: isActive ? 700 : 500,
                gap: '2px',
                padding: '4px 6px',
                borderRadius: 'var(--r-sm)',
                background: isActive ? 'var(--soft)' : 'transparent',
                transition: 'background var(--dur-fast) var(--e), color var(--dur-fast) var(--e)'
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}