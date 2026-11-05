import { useRouter } from './router';

// Code-Splitting: تحميل كل صفحة ديناميكياً عند الانتقال إليها فقط
const routes = [
  { path: '/', component: () => import('./pages/Dashboard') },
  { path: '/fleet', component: () => import('./pages/Fleet') },
  { path: '/reports', component: () => import('./pages/Reports') },
  { path: '/inquiries', component: () => import('./pages/Inquiries') },
  { path: '/petro', component: () => import('./pages/Petro') },
  { path: '/settings', component: () => import('./pages/Settings') }
];

export function App() {
  const { currentPath, Component, loading } = useRouter(routes);

  const navItems = [
    { path: '/', label: 'الرئيسية', icon: '📊' },
    { path: '/fleet', label: 'الأسطول', icon: '🚛' },
    { path: '/reports', label: 'التقارير', icon: '📑' },
    { path: '/inquiries', label: 'الاستفسارات', icon: '💬' },
    { path: '/petro', label: 'العهدة', icon: '💳' },
    { path: '/settings', label: 'الإعدادات', icon: '⚙️' }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
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
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="./brand/mark.png" alt="Badawi Group" style={{ height: '28px' }} />
          <b style={{ fontSize: '1.05rem', color: 'var(--acc)' }}>Badawi Fleet</b>
        </div>
        <span style={{ fontSize: '0.8rem', background: 'var(--soft)', padding: '4px 10px', borderRadius: '99px' }}>
          خطة Spark (مجاني)
        </span>
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
        borderRadius: '24px',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 4px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
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
                padding: '4px 8px',
                borderRadius: '12px',
                background: isActive ? 'var(--soft)' : 'transparent'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}