import { useState, useEffect } from 'preact/hooks';
import { useRouter } from './router';
import { getStoredTheme, applyTheme, type ThemeMode } from './theme';
import { ToastContainer, showToast } from './components/Toast';
import { Icon, type IconName } from './components/Icon';
import { Switch } from './components/Switch';
import { PWAUpdateBanner } from './components/PWAUpdateBanner';

const routes = [
  { path: '/', component: () => import('./pages/Dashboard') },
  { path: '/fleet', component: () => import('./pages/Fleet') },
  { path: '/reports', component: () => import('./pages/Reports') },
  { path: '/inquiries', component: () => import('./pages/Inquiries') },
  { path: '/petro', component: () => import('./pages/Petro') },
  { path: '/settings', component: () => import('./pages/Settings') },
  { path: '/showcase', component: () => import('./pages/Showcase') }
];

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: number;
}

export function App() {
  const { currentPath, Component, loading } = useRouter(routes);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('badawi-sidebar-col') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    const nextMode: ThemeMode = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light';
    setThemeMode(nextMode);
  };

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('badawi-sidebar-col', next ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
  };

  const navItems: NavItem[] = [
    { path: '/', label: 'الرئيسية', icon: 'home' },
    { path: '/fleet', label: 'الأسطول', icon: 'truck' },
    { path: '/reports', label: 'التقارير', icon: 'doc' },
    { path: '/inquiries', label: 'الاستفسارات', icon: 'chat', badge: 3 },
    { path: '/petro', label: 'طلبات العهدة', icon: 'wallet' },
    { path: '/showcase', label: 'المكونات', icon: 'showcase' },
    { path: '/settings', label: 'الإعدادات', icon: 'set' }
  ];

  const handleNavClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch {
      // Ignore vibration error
    }
  };

  return (
    <div className={`app-layout ${isCollapsed ? 'col' : ''}`}>
      {/* PWA Update Notification Banner */}
      <PWAUpdateBanner />

      {/* Toast Notification Mount */}
      <ToastContainer />

      {/* Desktop Collapsible Sidebar (ADR-029) */}
      <aside className="side" id="side">
        {/* Brand & Collapse Button */}
        <div className="sdg brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="./brand/mark.png" alt="Badawi Group" style={{ height: '30px' }} />
            <span className="brand-title">Badawi Fleet</span>
          </div>
          <button
            type="button"
            className="ib"
            id="col"
            onClick={toggleSidebar}
            title={isCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
            aria-label="طي القائمة"
          >
            <Icon name="panel" size={18} />
          </button>
        </div>

        {/* Quick Search */}
        <div className="sdg">
          <button
            type="button"
            className="sq"
            onClick={() => showToast('البحث السريع (Ctrl+K)')}
          >
            <Icon name="search" size={17} />
            <span className="lb">بحث سريع</span>
            <kbd className="lb">K</kbd>
          </button>
        </div>

        {/* Nav List */}
        <div className="sdg mid">
          <div className="sg lb">القائمة</div>
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={`#${item.path}`}
                className={`nv ${isActive ? 'on' : ''}`}
                onClick={handleNavClick}
                title={item.label}
              >
                <Icon name={item.icon} size={18} />
                <span className="lb">{item.label}</span>
                {item.badge && <span className="cnt">{item.badge}</span>}
              </a>
            );
          })}
        </div>

        {/* Petro Wallet Quick Card (ADR-021) */}
        <div className="promo2">
          <div className="promo2-header">
            <span className="promo2-icon">
              <Icon name="wallet" size={18} />
            </span>
            <div>
              <small>رصيد محفظة Petro</small>
              <b>34,200 ج.م</b>
            </div>
          </div>
          <div className="pbar">
            <div className="pbar-fill" style={{ width: '68%' }} />
          </div>
          <button
            type="button"
            className="btn btn-warning"
            style={{ width: '100%', minHeight: '34px', fontSize: '0.82rem', marginTop: '6px' }}
            onClick={() => showToast('فتح طلب عهدة جديد (ADR-021)')}
          >
            طلب عهدة جديد
          </button>
        </div>

        {/* Theme Mode Quick Switch */}
        <div className="sdg" style={{ borderTop: '1px solid var(--line)', borderBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name={themeMode === 'dark' ? 'moon' : 'sun'} size={18} />
              <span className="lb" style={{ fontSize: '0.86rem', fontWeight: 500 }}>
                {themeMode === 'dark' ? 'الوضع الداكن' : themeMode === 'light' ? 'الوضع الفاتح' : 'مظهر النظام'}
              </span>
            </div>
            <div className="lb">
              <Switch
                checked={themeMode === 'dark'}
                onChange={() => toggleTheme()}
              />
            </div>
          </div>
        </div>

        {/* Super Admin Profile */}
        <div className="usr">
          <div className="av">SA</div>
          <div className="usr-tx">
            <b>Super Admin</b>
            <small>مسؤول الأسطول</small>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Sticky Top Bar Header */}
        <header className="top-bar">
          <div>
            <h1>صباح الخير 👋</h1>
            <p>منصة متابعة أسطول شركة أبناء بدوي (65 عربية)</p>
          </div>

          <div className="top-sp" />

          {/* Date Filter Pill */}
          <button
            type="button"
            className="pill-btn"
            onClick={() => showToast('تحديد فترة التقرير')}
          >
            <Icon name="cal" size={16} />
            <span>1 – 30 أكتوبر 2026</span>
          </button>

          {/* Notifications */}
          <button
            type="button"
            className="pill-btn dot"
            title="التنبيهات"
            onClick={() => showToast('لا توجد إشعارات جديدة')}
          >
            <Icon name="bell" size={16} />
          </button>

          {/* Quick Theme Switch */}
          <button
            type="button"
            className="pill-btn"
            onClick={toggleTheme}
            title={`المظهر: ${themeMode === 'auto' ? 'تلقائي' : themeMode === 'dark' ? 'داكن' : 'فاتح'}`}
          >
            <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>

          {/* Spark Plan Badge */}
          <span style={{ fontSize: '0.78rem', background: 'var(--soft)', color: 'var(--mute)', padding: '6px 12px', borderRadius: 'var(--r-full)', fontWeight: 600 }}>
            خطة Spark (مجاني)
          </span>
        </header>

        {/* Dynamic Page Component */}
        <main style={{ minHeight: '400px' }}>
          {loading ? (
            <div style={{ display: 'grid', placeItems: 'center', height: '240px', color: 'var(--mute)' }}>
              جاري التحميل...
            </div>
          ) : (
            Component && <Component />
          )}
        </main>
      </div>

      {/* Mobile Floating Bottom Dock (ADR-014, ADR-029) */}
      <nav className="dock">
        {navItems.slice(0, 5).map((item) => {
          const isActive = currentPath === item.path;
          return (
            <a
              key={item.path}
              href={`#${item.path}`}
              className={isActive ? 'on' : ''}
              onClick={handleNavClick}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
              {item.badge && <span className="dot-badge" />}
            </a>
          );
        })}
      </nav>
    </div>
  );
}