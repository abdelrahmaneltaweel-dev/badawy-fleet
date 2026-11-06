import { useState, useEffect } from 'preact/hooks';
import { useRouter } from './router';
import { appearanceService } from './services/appearance';
import { authService, type UserProfile } from './services/auth';
import { auditService } from './services/audit';
import { ToastContainer, showToast } from './components/Toast';
import { Icon, type IconName } from './components/Icon';
import { Switch } from './components/Switch';
import { PWAUpdateBanner } from './components/PWAUpdateBanner';
import { SyncHealthIndicator } from './components/SyncHealthIndicator';
import Login from './pages/Login';

const routes = [
  { path: '/', component: () => import('./pages/Dashboard') },
  { path: '/fleet', component: () => import('./pages/Fleet') },
  { path: '/reports', component: () => import('./pages/Reports') },
  { path: '/inquiries', component: () => import('./pages/Inquiries') },
  { path: '/petro', component: () => import('./pages/Petro') },
  { path: '/users', component: () => import('./pages/Users') },
  { path: '/audit', component: () => import('./pages/AuditLog') },
  { path: '/excel-upload', component: () => import('./pages/ExcelUpload') },
  { path: '/settings', component: () => import('./pages/Settings') },
  { path: '/showcase', component: () => import('./pages/Showcase') }
];

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: number;
  permission?: string;
}

export function App() {
  const { currentPath, Component, loading } = useRouter(routes);
  const [themeMode, setThemeMode] = useState<'auto' | 'light' | 'dark'>(
    appearanceService.getPreferences().themeMode
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(authService.getCurrentUser());
  const [activeOnBehalf, setActiveOnBehalf] = useState<UserProfile | null>(auditService.getActiveOnBehalfUser());
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('badawi-sidebar-col') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    return appearanceService.subscribe((pref) => {
      setThemeMode(pref.themeMode);
    });
  }, []);

  useEffect(() => {
    return authService.subscribe(setCurrentUser);
  }, []);

  useEffect(() => {
    return auditService.subscribe(() => {
      setActiveOnBehalf(auditService.getActiveOnBehalfUser());
    });
  }, []);

  const toggleTheme = () => {
    appearanceService.toggleThemeMode();
  };

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('badawi-sidebar-col', next ? '1' : '0');
    } catch {
      // Ignore
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    showToast('تم تسجيل الخروج بنجاح');
  };

  const allNavItems: NavItem[] = [
    { path: '/', label: 'الرئيسية', icon: 'home' },
    { path: '/fleet', label: 'الأسطول', icon: 'truck' },
    { path: '/reports', label: 'التقارير', icon: 'doc', permission: 'report.view' },
    { path: '/inquiries', label: 'الاستفسارات', icon: 'chat', badge: 3 },
    { path: '/petro', label: 'طلبات العهدة', icon: 'wallet', permission: 'petro.request' },
    { path: '/users', label: 'المستخدمون', icon: 'user', permission: 'users.manage' },
    { path: '/audit', label: 'سجل المراجعة', icon: 'shield', permission: 'audit.view' },
    { path: '/excel-upload', label: 'رفع Excel البديل', icon: 'upload', permission: 'report.view' },
    { path: '/showcase', label: 'المكونات', icon: 'showcase' },
    { path: '/settings', label: 'الإعدادات', icon: 'set' }
  ];

  // Filter navigation items according to current user permissions (ADR-013)
  const navItems = allNavItems.filter((item) => {
    if (!item.permission) return true;
    return authService.can(item.permission as any);
  });

  const handleNavClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch {
      // Ignore
    }
  };

  // If not authenticated, display login view
  if (!currentUser) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <ToastContainer />
        <Login onLoginSuccess={setCurrentUser} />
      </div>
    );
  }

  return (
    <div className={`app-layout ${isCollapsed ? 'col' : ''}`}>
      <PWAUpdateBanner />
      <ToastContainer />

      {/* Desktop Collapsible Sidebar (ADR-029) */}
      <aside className="side" id="side">
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

        {/* Petro Quick Widget */}
        {authService.can('petro.request') && (
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
          </div>
        )}

        {/* Theme Mode Quick Switch */}
        <div className="sdg" style={{ borderTop: '1px solid var(--line)', borderBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name={appearanceService.getResolvedTheme() === 'dark' ? 'moon' : 'sun'} size={18} />
              <span className="lb" style={{ fontSize: '0.86rem', fontWeight: 500 }}>
                {themeMode === 'dark' ? 'الوضع الداكن' : themeMode === 'light' ? 'الوضع الفاتح' : 'مظهر النظام'}
              </span>
            </div>
            <div className="lb">
              <Switch
                checked={appearanceService.getResolvedTheme() === 'dark'}
                onChange={() => toggleTheme()}
              />
            </div>
          </div>
        </div>

        {/* Current User Profile Card */}
        <div className="usr" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="av">
              {currentUser.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="usr-tx">
              <b>{currentUser.displayName}</b>
              <small>{authService.getRoleLabel(currentUser.role)}</small>
            </div>
          </div>
          <button
            type="button"
            className="ib lb"
            onClick={handleLogout}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
          >
            <span style={{ fontSize: '1rem' }}>🚪</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="top-bar">
          <div>
            <h1>مرحباً، {currentUser.displayName} 👋</h1>
            <p>الدور: {authService.getRoleLabel(currentUser.role)}</p>
          </div>

          <div className="top-sp" />

          <button
            type="button"
            className="pill-btn"
            onClick={() => showToast('تحديد فترة التقرير')}
          >
            <Icon name="cal" size={16} />
            <span>1 – 30 أكتوبر 2026</span>
          </button>

          <button
            type="button"
            className="pill-btn dot"
            title="التنبيهات"
            onClick={() => showToast('لا توجد إشعارات جديدة')}
          >
            <Icon name="bell" size={16} />
          </button>

          <button
            type="button"
            className="pill-btn"
            onClick={toggleTheme}
            title={`المظهر: ${themeMode === 'auto' ? 'تلقائي' : themeMode === 'dark' ? 'داكن' : 'فاتح'}`}
          >
            <Icon name={appearanceService.getResolvedTheme() === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>

          <SyncHealthIndicator />

          <span style={{ fontSize: '0.78rem', background: 'var(--soft)', color: 'var(--mute)', padding: '6px 12px', borderRadius: 'var(--r-full)', fontWeight: 600 }}>
            Spark
          </span>
        </header>

        {/* Global On-Behalf Indicator Banner (ADR-018) */}
        {activeOnBehalf && (
          <div
            style={{
              background: 'var(--soft)',
              border: '1px solid var(--accent)',
              padding: '10px 18px',
              margin: '12px 20px 0 20px',
              borderRadius: 'var(--r-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '0.86rem',
              boxShadow: 'var(--sh-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="shield" size={18} />
              <span>
                <b>وضع الإدخال بالنيابة نشط (ADR-018):</b> أنت تعمل الآن بالنيابة عن{' '}
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  {activeOnBehalf.displayName}
                </span>{' '}
                ({authService.getRoleLabel(activeOnBehalf.role)})
              </span>
            </div>
            <button
              type="button"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                padding: '4px 10px',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--tx)',
                fontWeight: 600
              }}
              onClick={() => {
                auditService.setActiveOnBehalfUser(null);
                showToast('تم إنهاء وضع الإدخال بالنيابة. العمليات الآن باسمك المباشر.');
              }}
            >
              إنهاء النيابة
            </button>
          </div>
        )}

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