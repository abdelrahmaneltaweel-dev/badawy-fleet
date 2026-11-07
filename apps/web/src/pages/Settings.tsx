import { useState, useEffect } from 'preact/hooks';
import {
  SETTINGS_REGISTRY,
  SETTING_SECTION_LABELS,
  type SettingSection,
  type SettingDefinition,
  type CuratedFontId,
  type UserPersonalPreferences,
  calculateWriteBudget,
  DASHBOARD_CARDS_CATALOG,
  CANONICAL_DASHBOARD_CARDS_ORDER,
  moveDashboardCard,
  type DashboardCardId
} from '@badawi/logic';
import { settingsService } from '../services/settings';
import { appearanceService } from '../services/appearance';
import { authService } from '../services/auth';
import { repositoryService } from '../services/repository';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Switch } from '../components/Switch';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { Table } from '../components/Table';
import { showToast } from '../components/Toast';
import { firebaseService } from '../services/firebase';
import { traccarService, type SyncProgressUpdate } from '../services/traccar';
import { entitiesService } from '../services/entities';
import { getOperationalDateString } from '@badawi/logic';

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingSection>('appearance');
  const [activeRepoName, setActiveRepoName] = useState<string>(repositoryService.getActiveProvider());
  const [effectiveValues, setEffectiveValues] = useState<Record<string, unknown>>(
    settingsService.getEffectiveValues()
  );
  const [hasDraft, setHasDraft] = useState<boolean>(settingsService.hasDraft());
  const [publishedVersion, setPublishedVersion] = useState<number>(settingsService.getSettings().version);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showRiskModal, setShowRiskModal] = useState<boolean>(false);
  const [superAdminConfirmed, setSuperAdminConfirmed] = useState<boolean>(false);

  // User Local Appearance Preferences (T3.5)
  const [userPrefs, setUserPrefs] = useState<UserPersonalPreferences>(
    appearanceService.getPreferences()
  );

  // Firebase configuration state
  const existingFb = firebaseService.getConfig();
  const [fbProjectId, setFbProjectId] = useState(existingFb?.projectId || '');
  const [fbApiKey, setFbApiKey] = useState(existingFb?.apiKey || '');
  const [fbAuthDomain, setFbAuthDomain] = useState(existingFb?.authDomain || '');
  const [isFbTesting, setIsFbTesting] = useState(false);
  const [fbTestStatus, setFbTestStatus] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null);

  // Traccar configuration & live sync state
  const existingTraccar = traccarService.getConfig();
  const [traccarUrl, setTraccarUrl] = useState(existingTraccar.url || 'http://196.221.144.183:8080');
  const [traccarToken, setTraccarToken] = useState(existingTraccar.token || '');
  const [traccarUser, setTraccarUser] = useState(existingTraccar.username || 'it');
  const [traccarPass, setTraccarPass] = useState(existingTraccar.password || '');
  const [useTraccarProxy, setUseTraccarProxy] = useState(existingTraccar.useProxy !== false);
  const [isTraccarTesting, setIsTraccarTesting] = useState(false);
  const [traccarTestStatus, setTraccarTestStatus] = useState<any>(null);
  const [isSyncingFleet, setIsSyncingFleet] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressUpdate | null>(null);
  const [syncTargetDate, setSyncTargetDate] = useState(getOperationalDateString(new Date()));

  const canManageSettings = authService.can('settings.manage');

  useEffect(() => {
    const unsubSettings = settingsService.subscribe(() => {
      setEffectiveValues(settingsService.getEffectiveValues());
      setHasDraft(settingsService.hasDraft());
      setPublishedVersion(settingsService.getSettings().version);
    });

    const unsubAppearance = appearanceService.subscribe(setUserPrefs);

    return () => {
      unsubSettings();
      unsubAppearance();
    };
  }, []);

  const handleFieldChange = (def: SettingDefinition, newValue: unknown, isConfirmed = superAdminConfirmed) => {
    const res = settingsService.updateDraftValue(def.key, newValue, {
      superAdminConfirmed: isConfirmed
    });
    if (!res.valid) {
      showToast(res.error || 'قيمة غير مقبولة');
    }
  };

  const handlePublish = () => {
    if (!canManageSettings) {
      showToast('ليس لديك صلاحية نشر الإعدادات');
      return;
    }

    const intervalVal = effectiveValues['ingestion.refresh_interval_minutes'];
    if (intervalVal !== undefined) {
      const budget = calculateWriteBudget(Number(intervalVal));
      if (budget.requiresSuperAdminConfirmation && !superAdminConfirmed) {
        showToast('⚠️ تحذير: معدل التحديث يستهلك > 90% من حد الكتابة؛ يجب تأكيد موافقة Super Admin أولاً (ADR-049)');
        return;
      }
    }

    const state = settingsService.publish(authService.getCurrentUser()?.displayName || 'Super Admin');
    setShowRiskModal(false);
    showToast(`تم نشر الإعدادات بنجاح (الإصدار v${state.version})`);
  };

  const handleDiscard = () => {
    settingsService.discardDraft();
    showToast('تم إلغاء المسودة والعودة للإعدادات المنشورة');
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من رغبتك في إعادة ضبط جميع الإعدادات للقيم الافتراضية؟')) {
      settingsService.resetToDefault();
      showToast('تمت إعادة الضبط للقيم الافتراضية');
    }
  };

  const handleExport = () => {
    const json = settingsService.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `badawi-settings-v${publishedVersion}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير ملف الإعدادات');
  };

  const handleImportFile = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = settingsService.importJSON(content);
      showToast(res.message);
    };
    reader.readAsText(file);
  };

  const currentSectionSettings = SETTINGS_REGISTRY.filter((s) => s.section === activeSection);
  const sections = Object.keys(SETTING_SECTION_LABELS) as SettingSection[];
  const curatedFonts = appearanceService.getCuratedFonts();

  return (
    <div style={{ display: 'grid', gap: '16px' }} className="animate-fade-in">
      {/* Header Card */}
      <Card
        title="سجل الإعدادات والمظهر (Settings & Preferences)"
        subtitle={`الإصدار المركزي المنشور: v${publishedVersion} · تحكم فوري بالخطوط والمظهر (ADR-040, ADR-045, ADR-058)`}
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setShowHistoryModal(true)}>
              📜 سجل الإصدارات
            </Button>
            <Button variant="outline" onClick={handleExport}>
              📥 تصدير JSON
            </Button>
            <label className="btn btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
              📤 استيراد
              <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
            </label>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>
          يمكنك تخصيص مظهر جهازك الشخصي بحرية تامة فورياً، بينما يدير مسؤول الأسطول الإعدادات العامة لجميع المستخدمين.
        </p>
      </Card>

      {/* 1. Dedicated Personal Preferences Card (T3.5 - Available to Any User) */}
      <Card
        title="🎨 تفضيلاتي الشخصية لهذا الجهاز (Personal Preferences)"
        subtitle="تُحفظ على جهازك وتطبق فورياً دون التأثير على الآخرين (ADR-044)"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* Personal Theme Switcher */}
          <div style={{ background: 'var(--soft)', padding: '14px', borderRadius: 'var(--r-sm)' }}>
            <b style={{ fontSize: '0.88rem', display: 'block', marginBottom: '8px' }}>مظهر النظام الشخصي:</b>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { mode: 'auto' as const, label: '🖥️ تلقائي' },
                { mode: 'light' as const, label: '☀️ فاتح' },
                { mode: 'dark' as const, label: '🌙 داكن' }
              ].map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  className={`chip ${userPrefs.themeMode === opt.mode ? 'active' : ''}`}
                  onClick={() => appearanceService.setThemeMode(opt.mode)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Personal Curated Font Selector (ADR-058) */}
          <div style={{ background: 'var(--soft)', padding: '14px', borderRadius: 'var(--r-sm)' }}>
            <b style={{ fontSize: '0.88rem', display: 'block', marginBottom: '8px' }}>الخط العربي المفضل (ADR-058):</b>
            <div style={{ display: 'grid', gap: '6px' }}>
              {curatedFonts.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip ${userPrefs.fontFamily === f.id ? 'active' : ''}`}
                  onClick={() => appearanceService.setFontFamily(f.id as CuratedFontId)}
                  style={{
                    fontFamily: f.cssFamily,
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--r-xs)'
                  }}
                >
                  <span>{f.arabicName}</span>
                  {userPrefs.fontFamily === f.id && <span style={{ color: 'var(--acc)', fontWeight: 700 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Base Font Size Selector with Safety Bounds */}
          <div style={{ background: 'var(--soft)', padding: '14px', borderRadius: 'var(--r-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <b style={{ fontSize: '0.88rem' }}>حجم الخط الأساسي:</b>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--acc)' }}>
                {userPrefs.baseFontSizePx}px
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {[13, 14, 15, 16, 17, 18].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`chip ${userPrefs.baseFontSizePx === size ? 'active' : ''}`}
                  onClick={() => appearanceService.setBaseFontSize(size)}
                  style={{ flex: 1, justifyContent: 'center', padding: '6px 2px' }}
                >
                  {size}
                </button>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--mute)' }}>
              معاينة فورية: منصة بدوي لمتابعة الأسطول (عربية 116 - 8 نقلات).
            </p>
          </div>

          {/* Personal Motion Preference */}
          <div style={{ background: 'var(--soft)', padding: '14px', borderRadius: 'var(--r-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <b style={{ fontSize: '0.88rem', display: 'block', marginBottom: '4px' }}>تفضيل تقليل الحركة:</b>
              <small style={{ color: 'var(--mute)', display: 'block', marginBottom: '10px' }}>
                لراحة العين وتوفير طاقة بطارية الهاتف (ADR-028)
              </small>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>إيقاف الحركات السريعة والتموج:</span>
              <Switch
                checked={userPrefs.motionReduced}
                onChange={(checked) => appearanceService.setMotionReduced(checked)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Real Cloud Integrations: Firebase Firestore & Traccar Live Sync */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        {/* Firebase Firestore & Auth Card */}
        <Card
          title="🔥 قاعدة بيانات Firebase Firestore والمصادقة (Real Firebase)"
          subtitle="اتصال حقيقي وسحب وتخزين CRUD على سحابة Google Firebase (ADR-004, ADR-013)"
          action={
            <span
              style={{
                fontSize: '0.78rem',
                padding: '3px 10px',
                borderRadius: 'var(--r-full)',
                fontWeight: 700,
                background: repositoryService.isFirestore() ? 'var(--ok-soft)' : 'var(--warn-soft)',
                color: repositoryService.isFirestore() ? 'var(--ok)' : 'var(--warn)'
              }}
            >
              {repositoryService.isFirestore() ? `● متصل بـ Firestore (${activeRepoName})` : `○ وضع التخزين التجريبي (${activeRepoName})`}
            </span>
          }
        >
          <div style={{ display: 'grid', gap: '12px' }}>
            <Field
              label="معرّف المشروع (Firebase Project ID)"
              placeholder="e.g. badawi-fleet-prod"
              value={fbProjectId}
              onInput={(e) => setFbProjectId((e.currentTarget as HTMLInputElement).value)}
            />

            <Field
              label="مفتاح الـ API العام (Firebase Web API Key)"
              placeholder="AIzaSy..."
              type="password"
              value={fbApiKey}
              onInput={(e) => setFbApiKey((e.currentTarget as HTMLInputElement).value)}
            />

            <Field
              label="نطاق المصادقة (Auth Domain - اختياري)"
              placeholder="project-id.firebaseapp.com"
              value={fbAuthDomain}
              onInput={(e) => setFbAuthDomain((e.currentTarget as HTMLInputElement).value)}
            />

            {fbTestStatus && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--r-xs)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  background: fbTestStatus.ok ? 'var(--ok-soft)' : 'var(--bad-soft)',
                  color: fbTestStatus.ok ? 'var(--ok)' : 'var(--bad)'
                }}
              >
                {fbTestStatus.message} {fbTestStatus.ok && `(${fbTestStatus.latencyMs}ms)`}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
              <Button
                variant="primary"
                onClick={() => {
                  if (!fbProjectId || !fbApiKey) {
                    showToast('يرجى كتابة Project ID و API Key أولاً');
                    return;
                  }
                  const res = firebaseService.saveConfig({
                    projectId: fbProjectId.trim(),
                    apiKey: fbApiKey.trim(),
                    authDomain: fbAuthDomain.trim() || `${fbProjectId.trim()}.firebaseapp.com`
                  });
                  if (res.success) {
                    repositoryService.setProvider({
                      provider: 'firestore',
                      projectId: fbProjectId.trim(),
                      apiKey: fbApiKey.trim()
                    });
                    setActiveRepoName(repositoryService.getActiveProvider());
                    showToast('تم تفعيل الاتصال بـ Firebase Firestore الحقيقي بنجاح!');
                  } else {
                    showToast(`خطأ في الإعداد: ${res.error}`);
                  }
                }}
              >
                💾 حفظ وتفعيل Firestore
              </Button>

              <Button
                variant="outline"
                loading={isFbTesting}
                onClick={async () => {
                  setIsFbTesting(true);
                  const result = await firebaseService.testConnection();
                  setFbTestStatus(result);
                  setIsFbTesting(false);
                }}
              >
                ⚡ فحص الاتصال بـ Firestore
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  repositoryService.setProvider({ provider: 'local' });
                  setActiveRepoName(repositoryService.getActiveProvider());
                  showToast('تم التبديل إلى التخزين المحلي التجريبي');
                }}
              >
                تبديل للمخزن المحلي
              </Button>

              <Button
                variant="outline"
                onClick={async () => {
                  const vehicles = entitiesService.getVehicles();
                  showToast(`جاري مزامنة ${vehicles.length} عربية إلى Firestore...`);
                  for (const v of vehicles) {
                    await repositoryService.getRepository().create('vehicles', v.vehicleId, v).catch(() => {});
                  }
                  showToast('تمت مزامنة بيانات الأسطول إلى Firestore بنجاح');
                }}
              >
                📤 مزامنة بيانات المركبات إلى Firestore
              </Button>
            </div>
          </div>
        </Card>

        {/* Traccar Live Pull & Ingestion Card */}
        <Card
          title="📡 سيرفر Traccar وسحب بيانات الأسطول الحية (Traccar Ingestion)"
          subtitle="اتصال وسحب إحداثيات GPS حقيقية وتحليل النقلات واللقطات (ADR-005, ADR-023, ADR-049)"
          action={
            <span
              style={{
                fontSize: '0.78rem',
                padding: '3px 10px',
                borderRadius: 'var(--r-full)',
                fontWeight: 700,
                background: traccarTestStatus?.ok ? 'var(--ok-soft)' : 'var(--soft)',
                color: traccarTestStatus?.ok ? 'var(--ok)' : 'var(--mute)'
              }}
            >
              {traccarTestStatus?.ok ? `● Traccar متصل (${traccarTestStatus.deviceCount} جهاز)` : '○ سيرفر Traccar'}
            </span>
          }
        >
          <div style={{ display: 'grid', gap: '12px' }}>
            <Field
              label="رابط سيرفر Traccar (URL)"
              placeholder="http://traccar.example.com:8082"
              value={traccarUrl}
              onInput={(e) => setTraccarUrl((e.currentTarget as HTMLInputElement).value)}
            />

            <Field
              label="رمز الدخول (API Bearer Token - مفضل)"
              placeholder="Bearer Token من شاشة مستخدم Traccar"
              type="password"
              value={traccarToken}
              onInput={(e) => setTraccarToken((e.currentTarget as HTMLInputElement).value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field
                label="اسم المستخدم (اختياري)"
                placeholder="User / Email"
                value={traccarUser}
                onInput={(e) => setTraccarUser((e.currentTarget as HTMLInputElement).value)}
              />
              <Field
                label="كلمة السر (اختياري)"
                placeholder="Password"
                type="password"
                value={traccarPass}
                onInput={(e) => setTraccarPass((e.currentTarget as HTMLInputElement).value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--soft)', borderRadius: 'var(--r-xs)', gap: '12px' }}>
              <div>
                <b style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink)' }}>
                  <span>🛡️ توجيه الاتصال عبر البروكسي الداخلي</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'var(--ok-soft)', color: 'var(--ok)', fontWeight: 700 }}>
                    مفعل تلقائياً
                  </span>
                </b>
                <small style={{ color: 'var(--mute)', fontSize: '0.74rem' }}>
                  يتولى خادم Node.js سحب البيانات من السيرفر مباشرة، ويتجاوز حظر المتصفح لـ CORS و Mixed Content (HTTPS ↔ HTTP).
                </small>
              </div>
              <Switch checked={useTraccarProxy} onChange={setUseTraccarProxy} />
            </div>

            {traccarTestStatus && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--r-xs)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  background: traccarTestStatus.ok ? 'var(--ok-soft)' : 'var(--bad-soft)',
                  color: traccarTestStatus.ok ? 'var(--ok)' : 'var(--bad)',
                  border: `1px solid ${traccarTestStatus.ok ? 'var(--ok)' : 'var(--bad)'}`
                }}
              >
                {traccarTestStatus.ok ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span>✓ تم الاتصال بسيرفر Traccar بنجاح!</span>
                      <span style={{ fontSize: '0.74rem', opacity: 0.85 }}>({traccarTestStatus.latencyMs}ms)</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                      إصدار السيرفر: <b>Traccar v{traccarTestStatus.serverVersion}</b> · الأجهزة المسجلة: <b>{traccarTestStatus.deviceCount} جهاز</b> · طريقة المصادقة: <b>{traccarTestStatus.authMethodUsed}</b>
                    </div>
                  </div>
                ) : (
                  <div>
                    <b style={{ display: 'block', marginBottom: '2px' }}>✕ خطأ في الاتصال بسيرفر Traccar:</b>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{traccarTestStatus.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Live Progress Bar when Syncing */}
            {syncProgress && (
              <div style={{ background: 'var(--soft)', padding: '12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                  <b>{syncProgress.message}</b>
                  <span>{syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: syncProgress.phase === 'error' ? 'var(--bad)' : 'var(--acc)',
                      width: `${syncProgress.total > 0 ? Math.min(100, Math.round((syncProgress.current / syncProgress.total) * 100)) : 0}%`,
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
              <Button
                variant="outline"
                onClick={() => {
                  traccarService.saveConfig({
                    url: traccarUrl.trim(),
                    token: traccarToken.trim(),
                    username: traccarUser.trim(),
                    password: traccarPass.trim(),
                    useProxy: useTraccarProxy
                  });
                  showToast('تم حفظ إعدادات Traccar');
                }}
              >
                💾 حفظ الإعدادات
              </Button>

              <Button
                variant="outline"
                loading={isTraccarTesting}
                onClick={async () => {
                  setIsTraccarTesting(true);
                  const res = await traccarService.testConnection({
                    url: traccarUrl.trim(),
                    token: traccarToken.trim(),
                    username: traccarUser.trim(),
                    password: traccarPass.trim(),
                    useProxy: useTraccarProxy
                  });
                  setTraccarTestStatus(res);
                  setIsTraccarTesting(false);
                }}
              >
                ⚡ فحص اتصال Traccar
              </Button>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1, minWidth: '240px' }}>
                <input
                  type="date"
                  className="field-input"
                  value={syncTargetDate}
                  onChange={(e) => setSyncTargetDate((e.currentTarget as HTMLInputElement).value)}
                  style={{ minHeight: '38px', padding: '4px 8px', fontSize: '0.84rem' }}
                />
                <Button
                  variant="primary"
                  loading={isSyncingFleet}
                  onClick={async () => {
                    traccarService.saveConfig({
                      url: traccarUrl.trim(),
                      token: traccarToken.trim(),
                      username: traccarUser.trim(),
                      password: traccarPass.trim(),
                      useProxy: useTraccarProxy
                    });
                    setIsSyncingFleet(true);
                    const unsub = traccarService.subscribeSync((prog) => setSyncProgress(prog));
                    try {
                      await traccarService.runLiveFleetSync(syncTargetDate);
                    } finally {
                      unsub();
                      setIsSyncingFleet(false);
                    }
                  }}
                >
                  🚀 سحب وتحليل الأسطول الآن
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Draft Notification Banner */}
      {hasDraft && (
        <div
          style={{
            background: 'var(--warn-soft)',
            border: '1px solid var(--warn)',
            borderRadius: 'var(--r-sm)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <b style={{ color: 'var(--warn)', display: 'block', fontSize: '0.92rem' }}>
              ⚠️ توجد تعديلات غير منشورة في المسودة الحالية (Live Preview Mode)
            </b>
            <small style={{ color: 'var(--ink)', fontSize: '0.78rem' }}>
              التعديلات مطبقة في جلستك الحالية للمعاينة فقط، انقر نشر لاعتمادها رسمياً بإصدار جديد.
            </small>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={handleDiscard} style={{ minHeight: '34px' }}>
              إلغاء المسودة
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowRiskModal(true)}
              style={{ minHeight: '34px', background: 'var(--warn)', borderColor: 'var(--warn)' }}
            >
              🚀 نشر كإصدار جديد
            </Button>
          </div>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {sections.map((sec) => {
          const info = SETTING_SECTION_LABELS[sec];
          const isActive = activeSection === sec;
          return (
            <button
              key={sec}
              type="button"
              className={`chip ${isActive ? 'active' : ''}`}
              onClick={() => setActiveSection(sec)}
              style={{ padding: '8px 14px', fontSize: '0.86rem', whiteSpace: 'nowrap' }}
            >
              <span>{info.icon}</span>
              <span>{info.label}</span>
            </button>
          );
        })}
      </div>

      {/* T6.1 / ADR-059: Interactive Visual Dashboard Cards Order & Visibility Manager */}
      {activeSection === 'navigation_dashboard' && (() => {
        const rawOrderStr = typeof effectiveValues['dashboard_cards_order'] === 'string'
          ? (effectiveValues['dashboard_cards_order'] as string)
          : CANONICAL_DASHBOARD_CARDS_ORDER.join(',');

        const currentOrderList = rawOrderStr
          .split(',')
          .map((s) => s.trim())
          .filter((id): id is DashboardCardId => id in DASHBOARD_CARDS_CATALOG);

        for (const c of CANONICAL_DASHBOARD_CARDS_ORDER) {
          if (!currentOrderList.includes(c)) currentOrderList.push(c);
        }

        const handleMove = (cardId: DashboardCardId, direction: 'up' | 'down') => {
          if (!canManageSettings) return;
          const updated = moveDashboardCard(rawOrderStr, cardId, direction);
          settingsService.updateDraftValue('dashboard_cards_order', updated);
        };

        const handleToggle = (meta: (typeof DASHBOARD_CARDS_CATALOG)[DashboardCardId], checked: boolean) => {
          if (!canManageSettings) return;
          settingsService.updateDraftValue(meta.settingKey, checked);
        };

        const handleResetOrder = () => {
          if (!canManageSettings) return;
          settingsService.updateDraftValue(
            'dashboard_cards_order',
            CANONICAL_DASHBOARD_CARDS_ORDER.join(',')
          );
          for (const c of CANONICAL_DASHBOARD_CARDS_ORDER) {
            settingsService.updateDraftValue(DASHBOARD_CARDS_CATALOG[c].settingKey, true);
          }
          showToast('تمت استعادة الترتيب والتفعيل الافتراضي لجميع البطاقات الست');
        };

        return (
          <Card
            title="إدارة وترتيب بطاقات الداشبورد الست (ADR-059 & Decision D-059)"
            subtitle="تحكّم في إظهار أو إخفاء أي بطاقة وإعادة ترتيب أولوية ظهورها بالأسهم 🔼 و 🔽 مع مسودة ونشر فوري."
            action={
              canManageSettings ? (
                <Button variant="outline" onClick={handleResetOrder} style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
                  ↺ استعادة الترتيب الافتراضي
                </Button>
              ) : undefined
            }
          >
            <div style={{ display: 'grid', gap: '8px' }}>
              {currentOrderList.map((cardId, index) => {
                const meta = DASHBOARD_CARDS_CATALOG[cardId];
                if (!meta) return null;

                const isVisible = effectiveValues[meta.settingKey] !== undefined
                  ? Boolean(effectiveValues[meta.settingKey])
                  : meta.defaultVisible;

                const isFirst = index === 0;
                const isLast = index === currentOrderList.length - 1;

                return (
                  <div
                    key={cardId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: isVisible ? 'var(--card)' : 'var(--soft)',
                      opacity: isVisible ? 1 : 0.65,
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      gap: '12px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          width: '24px',
                          height: '24px',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 'var(--r-full)',
                          background: 'var(--soft)',
                          color: 'var(--mute)'
                        }}
                      >
                        #{index + 1}
                      </span>
                      <span style={{ fontSize: '1.4rem' }}>{meta.icon}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <b style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>{meta.title}</b>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: 'var(--r-full)',
                              background: isVisible ? 'var(--ok-soft)' : 'var(--soft)',
                              color: isVisible ? 'var(--ok)' : 'var(--mute)',
                              fontWeight: 600
                            }}
                          >
                            {isVisible ? 'معروضة' : 'مخفية'}
                          </span>
                        </div>
                        <small style={{ color: 'var(--mute)', fontSize: '0.78rem', display: 'block' }}>
                          {meta.subtitle}
                        </small>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Button
                          variant="outline"
                          disabled={!canManageSettings || isFirst}
                          onClick={() => handleMove(cardId, 'up')}
                          style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.8rem' }}
                          title="تحريك لأعلى"
                        >
                          🔼
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!canManageSettings || isLast}
                          onClick={() => handleMove(cardId, 'down')}
                          style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.8rem' }}
                          title="تحريك لأسفل"
                        >
                          🔽
                        </Button>
                      </div>

                      <div style={{ marginRight: '6px' }}>
                        <Switch
                          checked={isVisible}
                          disabled={!canManageSettings}
                          onChange={(checked) => handleToggle(meta, checked)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Active Section Auto-Generated Fields */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {currentSectionSettings
          .filter((def) => {
            if (activeSection === 'navigation_dashboard') {
              return !def.key.startsWith('dashboard_show_') && def.key !== 'dashboard_cards_order';
            }
            return true;
          })
          .map((def) => {
          const currentValue = effectiveValues[def.key] ?? def.defaultValue;
          const isDraftModified = settingsService.getDraftValues()[def.key] !== undefined;

          return (
            <div
              key={def.key}
              style={{
                background: 'var(--card)',
                border: '1px solid ' + (isDraftModified ? 'var(--warn)' : 'var(--line)'),
                borderRadius: 'var(--r-sm)',
                padding: '16px',
                display: 'grid',
                gap: '12px',
                boxShadow: 'var(--sh-sm)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <b style={{ fontSize: '0.94rem', color: 'var(--ink)' }}>{def.label}</b>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: 'var(--r-full)',
                        background: def.riskLevel === 'visual' ? 'var(--ok-soft)' : 'var(--warn-soft)',
                        color: def.riskLevel === 'visual' ? 'var(--ok)' : 'var(--warn)',
                        fontWeight: 700
                      }}
                    >
                      {def.riskLevel === 'visual' ? 'تأثير شكلي' : 'أثر منطقي'}
                    </span>
                    {isDraftModified && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--warn)', fontWeight: 700 }}>
                        ● معدل في المسودة
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0', color: 'var(--mute)', fontSize: '0.82rem' }}>
                    {def.description}
                  </p>
                </div>

                <div style={{ minWidth: '160px', display: 'flex', justifyContent: 'flex-end' }}>
                  {def.type === 'boolean' && (
                    <Switch
                      checked={Boolean(currentValue)}
                      disabled={!canManageSettings}
                      onChange={(checked) => handleFieldChange(def, checked)}
                    />
                  )}

                  {def.type === 'number' && (
                    <div style={{ width: '130px' }}>
                      <Field
                        type="number"
                        min={def.min}
                        max={def.max}
                        step={def.step || 1}
                        value={Number(currentValue)}
                        disabled={!canManageSettings}
                        onInput={(e) => handleFieldChange(def, Number((e.currentTarget as HTMLInputElement).value))}
                      />
                    </div>
                  )}

                  {def.type === 'select' && def.options && (
                    <div style={{ width: '220px' }}>
                      <Select
                        value={String(currentValue)}
                        onChange={(val) => handleFieldChange(def, val)}
                        options={def.options.map((o) => ({ value: String(o.value), label: o.label }))}
                      />
                    </div>
                  )}

                  {def.type === 'string' && (
                    <div style={{ width: '180px' }}>
                      <Field
                        type="text"
                        value={String(currentValue ?? '')}
                        disabled={!canManageSettings}
                        onInput={(e) => handleFieldChange(def, (e.currentTarget as HTMLInputElement).value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Specialized Live Spark Write Budget Meter for Refresh Rate (ADR-049) */}
              {def.key === 'ingestion.refresh_interval_minutes' && (() => {
                const budget = calculateWriteBudget(Number(currentValue));
                const isOver90 = budget.worstCasePercentOfQuota >= 90;
                const isOver70 = budget.worstCasePercentOfQuota >= 70;
                const statusColor = isOver90 ? 'var(--bad)' : isOver70 ? 'var(--warn)' : 'var(--ok)';
                const statusBg = isOver90 ? 'var(--bad-soft)' : isOver70 ? 'var(--warn-soft)' : 'var(--ok-soft)';

                return (
                  <div style={{ marginTop: '10px', borderTop: '1px solid var(--line)', paddingTop: '12px', display: 'grid', gap: '10px' }}>
                    {/* Quick Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--mute)', fontWeight: 600 }}>فترات شائعة:</span>
                      {[60, 30, 15, 10, 5].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          disabled={!canManageSettings}
                          className={`chip ${Number(currentValue) === mins ? 'active' : ''}`}
                          onClick={() => handleFieldChange(def, mins)}
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          {mins === 15 ? `${mins} دقيقة (الموصى به)` : mins === 5 ? `${mins} دقائق (حرج 95%)` : `${mins} دقيقة`}
                        </button>
                      ))}
                    </div>

                    {/* Live Spark Quota Meter */}
                    <div style={{ background: statusBg, border: `1px solid ${statusColor}`, borderRadius: 'var(--r-sm)', padding: '14px', display: 'grid', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>{isOver90 ? '🚨' : isOver70 ? '⚠️' : '🛡️'}</span>
                          <div>
                            <b style={{ color: statusColor, fontSize: '0.88rem', display: 'block' }}>
                              {isOver90
                                ? 'تحذير حرج: تجاوز 90% من ميزانية الكتابات اليومية (ADR-049)'
                                : isOver70
                                ? 'تنبيه اقتراب من الحد المالي المجاني (70%+)'
                                : 'معدل آمن ومستدام لحصة Firebase Spark (20,000 كتابة/يوم)'}
                            </b>
                            <small style={{ color: 'var(--mute)', fontSize: '0.76rem' }}>
                              ميزانية خطة Spark المجانية: 20,000 كتابة/يوم لأسطول من 65 عربية
                            </small>
                          </div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: statusColor }}>
                            {budget.worstCasePercentOfQuota}%
                          </span>
                          <small style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mute)' }}>من إجمالي الحصة</small>
                        </div>
                      </div>

                      {/* Progress Bar with Milestones */}
                      <div style={{ width: '100%', height: '12px', background: 'var(--card)', borderRadius: 'var(--r-full)', overflow: 'hidden', border: '1px solid var(--line)', position: 'relative' }}>
                        <div
                          style={{
                            width: `${Math.min(100, budget.worstCasePercentOfQuota)}%`,
                            height: '100%',
                            background: statusColor,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>

                      {/* Numbers Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '0.78rem' }}>
                        <div style={{ background: 'var(--card)', padding: '8px 10px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
                          <span style={{ color: 'var(--mute)', display: 'block' }}>دورات السحب:</span>
                          <b style={{ color: 'var(--tx)', fontSize: '0.92rem' }}>{budget.runsPerDay} سحبة/يوم</b>
                        </div>
                        <div style={{ background: 'var(--card)', padding: '8px 10px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
                          <span style={{ color: 'var(--mute)', display: 'block' }}>أقصى كتابات محتملة:</span>
                          <b style={{ color: statusColor, fontSize: '0.92rem' }}>{budget.worstCaseDailyWrites.toLocaleString('en-US')} / 20k</b>
                        </div>
                        <div style={{ background: 'var(--card)', padding: '8px 10px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
                          <span style={{ color: 'var(--mute)', display: 'block' }}>الواقعي (بتقنية FNV-1a):</span>
                          <b style={{ color: 'var(--ok)', fontSize: '0.92rem' }}>~{budget.realisticDailyWrites.toLocaleString('en-US')} ({budget.realisticPercentOfQuota}%)</b>
                        </div>
                        <div style={{ background: 'var(--card)', padding: '8px 10px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
                          <span style={{ color: 'var(--mute)', display: 'block' }}>رصيد الأمان المتبقي:</span>
                          <b style={{ color: 'var(--tx)', fontSize: '0.92rem' }}>~{Math.max(0, 20000 - budget.worstCaseDailyWrites).toLocaleString('en-US')}</b>
                        </div>
                      </div>

                      {/* Super Admin Confirmation Checkbox if > 90% */}
                      {isOver90 && (
                        <div style={{ marginTop: '4px', padding: '12px', background: 'var(--card)', borderRadius: 'var(--r-xs)', border: '1px solid var(--bad)', boxShadow: 'var(--sh-sm)' }}>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--tx)' }}>
                            <input
                              type="checkbox"
                              checked={superAdminConfirmed}
                              disabled={!canManageSettings}
                              onChange={(e) => {
                                const isChecked = (e.target as HTMLInputElement).checked;
                                setSuperAdminConfirmed(isChecked);
                                if (isChecked) {
                                  handleFieldChange(def, Number(currentValue), true);
                                  showToast('تم اعتماد إقرار Super Admin لمعدل التحديث الحرج (ADR-049)');
                                }
                              }}
                              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: 'var(--bad)' }}
                            />
                            <span style={{ lineHeight: 1.5 }}>
                              <b style={{ color: 'var(--bad)', display: 'block' }}>إقرار وموافقة Super Admin الصريحة (ADR-049 & D-049):</b>
                              أقر بصفتي مسؤول النظام بالموافقة على اختيار معدل سحب كل {budget.intervalMinutes} دقيقة واستنزاف ما يصل إلى {budget.worstCasePercentOfQuota}% ({budget.worstCaseDailyWrites.toLocaleString('en-US')} كتابة) من حصة Firebase Spark اليومية، وأتحمل مسؤولية توقف السحب المجدول في حال نفاد الحصة.
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        <Button variant="danger" onClick={handleReset} style={{ fontSize: '0.82rem' }}>
          إعادة ضبط جميع الإعدادات للافتراضي
        </Button>
        {hasDraft && (
          <Button variant="primary" onClick={() => setShowRiskModal(true)}>
            🚀 نشر التعديلات كإصدار جديد
          </Button>
        )}
      </div>

      {/* Modal: Publish Risk Confirmation (ADR-044) */}
      {showRiskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '440px' }}>
            <Card title="تأكيد نشر التعديلات">
              <p style={{ fontSize: '0.86rem', color: 'var(--ink)', lineHeight: 1.6 }}>
                أنت على وشك نشر تعديلات مسودة الإعدادات الحالية لتصبح الإصدار <b>v{publishedVersion + 1}</b> لجميع المستخدمين.
              </p>
              <div style={{ background: 'var(--soft)', padding: '10px 14px', borderRadius: 'var(--r-xs)', fontSize: '0.8rem', color: 'var(--mute)', margin: '10px 0' }}>
                🛡️ <b>حماية الفترات المقفولة:</b> التعديلات المنطقية تسري فقط على الفترات المفتوحة والعمليات اللاحقة، ولن تمس أي فترة معتمدة ومقفولة إطلاقاً (ADR-036).
              </div>
              {(() => {
                const intervalVal = effectiveValues['ingestion.refresh_interval_minutes'];
                if (intervalVal !== undefined) {
                  const b = calculateWriteBudget(Number(intervalVal));
                  if (b.worstCasePercentOfQuota >= 90) {
                    return (
                      <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', padding: '10px 14px', borderRadius: 'var(--r-xs)', fontSize: '0.8rem', color: 'var(--bad)', margin: '10px 0' }}>
                        🚨 <b>تنبيه ميزانية Spark (ADR-049):</b> معدل التحديث المضبوط ({b.intervalMinutes} دقيقة) يستهلك {b.worstCasePercentOfQuota}% من حصة الـ 20,000 كتابة اليومية. تأكيد النشر هنا يمثل تفويضاً نهائياً.
                      </div>
                    );
                  }
                }
                return null;
              })()}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
                <Button variant="ghost" onClick={() => setShowRiskModal(false)}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={handlePublish}>
                  تأكيد ونشر الآن
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modal: History & Rollback (ADR-044) */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '520px' }}>
            <Card
              title="سجل إصدارات الإعدادات (Rollback)"
              subtitle="يمكنك استرجاع أي إصدار سابق بنقرة واحدة"
            >
              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                <Table>
                  <thead>
                    <tr>
                      <th>الإصدار</th>
                      <th>تاريخ النشر</th>
                      <th>بواسطة</th>
                      <th>الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: 'var(--acc-soft)' }}>
                      <td><b>v{publishedVersion}</b> (الحالي)</td>
                      <td>الآن</td>
                      <td>{settingsService.getSettings().publishedBy}</td>
                      <td><span style={{ fontSize: '0.78rem', color: 'var(--ok)', fontWeight: 700 }}>نشط</span></td>
                    </tr>
                    {settingsService.getHistory().map((rec) => (
                      <tr key={rec.version}>
                        <td>v{rec.version}</td>
                        <td style={{ fontSize: '0.76rem', color: 'var(--mute)' }}>
                          {new Date(rec.publishedAt).toLocaleDateString('ar-EG')}
                        </td>
                        <td>{rec.publishedBy}</td>
                        <td>
                          <Button
                            variant="secondary"
                            style={{ minHeight: '28px', padding: '2px 8px', fontSize: '0.74rem' }}
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من استرجاع الإصدار v${rec.version}؟`)) {
                                settingsService.rollback(rec.version);
                                setShowHistoryModal(false);
                                showToast(`تم استرجاع الإصدار v${rec.version}`);
                              }
                            }}
                          >
                            استرجاع
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <Button variant="primary" onClick={() => setShowHistoryModal(false)}>
                  إغلاق
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}