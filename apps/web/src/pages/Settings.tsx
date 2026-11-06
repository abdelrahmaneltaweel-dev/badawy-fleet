import { useState, useEffect } from 'preact/hooks';
import {
  SYSTEM_SETTINGS_REGISTRY,
  CATEGORY_LABELS,
  calculateWriteQuotaImpact,
  SettingsManager,
  type SettingCategory,
  type SettingDefinition,
  type SettingDiff
} from '@badawi/logic';
import { getStoredTheme, applyTheme, type ThemeMode } from '../theme';
import { subscribePWA, type PWAState } from '../pwa';
import { authService } from '../services/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { Switch } from '../components/Switch';
import { Icon } from '../components/Icon';
import { showToast } from '../components/Toast';

const SETTINGS_STORAGE_KEY = 'badawi-platform-registry-v1';

// Global Singleton Settings Manager
const settingsManager = new SettingsManager((() => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
})());

export default function Settings() {
  const [activeCategory, setActiveCategory] = useState<SettingCategory>('appearance');
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>(() => settingsManager.getDraftSettings());
  const [hasChanges, setHasChanges] = useState<boolean>(() => settingsManager.hasDraftChanges());
  const [diffs, setDiffs] = useState<SettingDiff[]>([]);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [publishReason, setPublishReason] = useState('');
  const [pwaState, setPwaState] = useState<PWAState | null>(null);

  const canManageSettings = authService.can('settings.manage');

  useEffect(() => {
    return subscribePWA(setPwaState);
  }, []);

  const updateDraft = (key: string, value: unknown) => {
    const res = settingsManager.setDraftValue(key, value);
    if (!res.valid && res.error) {
      showToast(res.error);
      return;
    }
    setDraftValues({ ...settingsManager.getDraftSettings() });
    setHasChanges(settingsManager.hasDraftChanges());
    setDiffs(settingsManager.getDiff());

    // Instant effect for appearance themes (ADR-044 cosmetic risk)
    if (key === 'appearance.theme') {
      applyTheme(value as ThemeMode);
    }
  };

  const handlePublish = () => {
    if (!canManageSettings) {
      showToast('ليس لديك صلاحية نشر الإعدادات');
      return;
    }

    const currentUserName = authService.getCurrentUser()?.displayName || 'Super Admin';
    const published = settingsManager.publishDraft(currentUserName, publishReason);

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(published.data));
    } catch {
      // Ignore
    }

    setHasChanges(false);
    setDiffs([]);
    setShowDiffModal(false);
    setPublishReason('');
    showToast(`تم نشر الإصدار v${published.version} بنجاح!`);
  };

  const handleDiscard = () => {
    settingsManager.discardDraft();
    setDraftValues({ ...settingsManager.getDraftSettings() });
    setHasChanges(false);
    setDiffs([]);
    showToast('تم التراجع عن المسودة واستعادة الإعدادات المنشورة');
  };

  const handleExport = () => {
    const json = settingsManager.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `badawi-settings-v${settingsManager.getCurrentSettings()['version'] || 1}.json`;
    a.click();
    showToast('تم تصدير ملف الإعدادات بنجاح');
  };

  const handleRollback = (versionNumber: number) => {
    const currentUserName = authService.getCurrentUser()?.displayName || 'Super Admin';
    const ok = settingsManager.rollbackToVersion(versionNumber, currentUserName);
    if (ok) {
      setDraftValues({ ...settingsManager.getDraftSettings() });
      setHasChanges(false);
      setDiffs([]);
      setShowHistoryModal(false);
      showToast(`تم استرجاع الإصدار v${versionNumber} بنجاح`);
    }
  };

  const syncInterval = Number(draftValues['sync.intervalMinutes'] || 10);
  const writeImpact = calculateWriteQuotaImpact(syncInterval);

  return (
    <div style={{ display: 'grid', gap: '16px' }} className="animate-fade-in">
      {/* الترويسة الرئيسية */}
      <Card
        title="سجل الإعدادات المركزي (Settings Registry)"
        subtitle="التحكم الكامل في قواعد التحليل، المظهر، الفترات، والأسعار من المنصة (ADR-040, ADR-044)"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" icon={<Icon name="doc" size={16} />} onClick={() => setShowHistoryModal(true)}>
              سجل الإصدارات
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              تصدير JSON
            </Button>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>
          القاعدة: لا ثوابت مدفونة في الكود. أي تعديل يُحفظ كمسودة، ويُعاين حياً، ثم يُنشر بإصدار مرقم مع إمكانية الاسترجاع.
        </p>
      </Card>

      {/* شريط المسودة العائم عند وجود تعديلات غير منشورة */}
      {hasChanges && (
        <aside
          style={{
            background: 'var(--card)',
            border: '2px solid var(--warn)',
            borderRadius: 'var(--r)',
            padding: '12px 16px',
            boxShadow: 'var(--sh-float)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
          className="animate-slide-up"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.3rem' }}>📝</span>
            <div>
              <b style={{ color: 'var(--warn)', fontSize: '0.92rem' }}>توجد تعديلات قيد المسودة ({diffs.length} إعدادات)</b>
              <small style={{ display: 'block', color: 'var(--mute)' }}>المسودة نشطة ومطبقة للمعاينة الآن فقط؛ اضغط لنشرها لجميع المستخدمين.</small>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={handleDiscard}>
              إلغاء المسودة
            </Button>
            <Button variant="warning" onClick={() => setShowDiffModal(true)}>
              مراجعة ونشر التغييرات
            </Button>
          </div>
        </aside>
      )}

      {/* تبويبات الأقسام */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {(Object.keys(CATEGORY_LABELS) as SettingCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`chip ${activeCategory === cat ? 'active' : ''}`}
            style={{ fontSize: '0.86rem', padding: '8px 16px' }}
          >
            <span>{CATEGORY_LABELS[cat].icon}</span>
            <span>{CATEGORY_LABELS[cat].title}</span>
          </button>
        ))}
      </div>

      {/* مولّد الواجهة التلقائي حسب القسم المختار */}
      <Card title={CATEGORY_LABELS[activeCategory].title}>
        <div style={{ display: 'grid', gap: '16px' }}>
          {SYSTEM_SETTINGS_REGISTRY.filter((s) => s.category === activeCategory).map((setting: SettingDefinition) => {
            const currentValue = draftValues[setting.key] !== undefined ? draftValues[setting.key] : setting.defaultValue;

            return (
              <div
                key={setting.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--soft)',
                  borderRadius: 'var(--r-sm)',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <b style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>{setting.label}</b>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '1px 7px',
                        borderRadius: 'var(--r-full)',
                        background: setting.risk === 'cosmetic' ? 'var(--ok-soft)' : 'var(--warn-soft)',
                        color: setting.risk === 'cosmetic' ? 'var(--ok)' : 'var(--warn)',
                        fontWeight: 700
                      }}
                    >
                      {setting.risk === 'cosmetic' ? 'شكلي (فوري)' : 'منطقي (قواعد)'}
                    </span>
                  </div>
                  <small style={{ color: 'var(--mute)', fontSize: '0.78rem', display: 'block' }}>{setting.description}</small>
                </div>

                {/* عنصر التحكم الديناميكي بحسب نوع الإعداد */}
                <div style={{ minWidth: '180px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {setting.type === 'boolean' && (
                    <Switch
                      checked={Boolean(currentValue)}
                      disabled={!canManageSettings}
                      onChange={(checked) => updateDraft(setting.key, checked)}
                    />
                  )}

                  {setting.type === 'number' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Field
                        type="number"
                        style={{ width: '100px', textAlign: 'center' }}
                        value={currentValue as number}
                        min={setting.min}
                        max={setting.max}
                        step={setting.step || 1}
                        disabled={!canManageSettings}
                        onInput={(e) => updateDraft(setting.key, Number((e.currentTarget as HTMLInputElement).value))}
                      />
                      {setting.unit && <span style={{ fontSize: '0.8rem', color: 'var(--mute)' }}>{setting.unit}</span>}
                    </div>
                  )}

                  {setting.type === 'select' && setting.options && (
                    <div style={{ width: '220px' }}>
                      <Select
                        value={String(currentValue)}
                        options={setting.options.map((o) => ({ value: String(o.value), label: o.label }))}
                        onChange={(val) => {
                          const parsed = setting.key.includes('interval') || setting.key.includes('Day') ? Number(val) : val;
                          updateDraft(setting.key, parsed);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* حاسبة حصة الكتابات التلقائية عند اختيار قسم الفترات والمزامنة (ADR-049) */}
        {activeCategory === 'periods_sync' && (
          <div style={{ marginTop: '16px', padding: '14px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.88rem', color: 'var(--acc)' }}>
              📊 مؤشر أمان استهلاك حصة الكتابات في Firebase Spark (ADR-049):
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', textAlign: 'center' }}>
              <div style={{ background: 'var(--soft)', padding: '10px', borderRadius: 'var(--r-xs)' }}>
                <small style={{ color: 'var(--mute)' }}>دورات السحب اليومية</small>
                <b style={{ display: 'block', fontSize: '1.2rem', marginTop: '2px' }}>{writeImpact.dailyRuns} مرة/يوم</b>
              </div>
              <div style={{ background: 'var(--soft)', padding: '10px', borderRadius: 'var(--r-xs)' }}>
                <small style={{ color: 'var(--mute)' }}>الكتابات التقديرية</small>
                <b style={{ display: 'block', fontSize: '1.2rem', marginTop: '2px' }}>~{writeImpact.estimatedWritesPerDay.toLocaleString('en-US')}</b>
              </div>
              <div style={{ background: 'var(--soft)', padding: '10px', borderRadius: 'var(--r-xs)' }}>
                <small style={{ color: 'var(--mute)' }}>النسبة من سقف الـ 20 ألف</small>
                <b style={{ display: 'block', fontSize: '1.2rem', marginTop: '2px', color: writeImpact.safetyStatus === 'safe' ? 'var(--ok)' : 'var(--bad)' }}>
                  {writeImpact.quotaPercentage}% ({writeImpact.safetyStatus === 'safe' ? 'آمن ومستدام' : 'مرتفع'})
                </b>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* قسم PWA والتثبيت على الهاتف */}
      <Card title="📱 تطبيق الهاتف (PWA)">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <b style={{ fontSize: '0.92rem' }}>تثبيت المنصة كتطبيق مستقل (ADR-014)</b>
            <small style={{ display: 'block', color: 'var(--mute)' }}>تصفح النقلات والتقارير بدون انقطاع حتى في وضع عدم الاتصال بالإنترنت.</small>
          </div>
          {pwaState?.canInstall ? (
            <Button variant="primary" onClick={pwaState.install}>
              📲 تثبيت التطبيق الآن
            </Button>
          ) : (
            <span style={{ fontSize: '0.82rem', color: 'var(--ok)', fontWeight: 600 }}>
              ✅ التطبيق مثبت ومحفوظ في ذاكرة الهاتف.
            </span>
          )}
        </div>
      </Card>

      {/* نافذة مراجعة الفروق والنشر بإصدار مرقم */}
      {showDiffModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '520px' }}>
            <Card title="مراجعة وتأكيد نشر الإعدادات (Publish Settings)">
              <p style={{ margin: '0 0 12px', color: 'var(--mute)', fontSize: '0.84rem' }}>
                سيتم تطبيق هذه التغييرات لجميع مستخدمي المنصة وحفظ نسخة جديدة في سجل الإصدارات:
              </p>

              <div style={{ display: 'grid', gap: '8px', maxHeight: '40vh', overflowY: 'auto', marginBottom: '14px' }}>
                {diffs.map((d) => (
                  <div key={d.key} style={{ background: 'var(--soft)', padding: '10px', borderRadius: 'var(--r-xs)', fontSize: '0.84rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{d.label}</span>
                      <small style={{ color: d.risk === 'cosmetic' ? 'var(--ok)' : 'var(--warn)' }}>
                        {d.risk === 'cosmetic' ? 'شكلي' : 'منطقي'}
                      </small>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', color: 'var(--mute)', marginTop: '4px', fontSize: '0.8rem' }}>
                      <span>السابق: <del>{String(d.oldValue)}</del></span>
                      <span>←</span>
                      <span style={{ color: 'var(--acc)', fontWeight: 700 }}>الجديد: {String(d.newValue)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Field
                label="سبب التعديل (لتوثيقه في سجل المراجعة)"
                placeholder="مثال: ضبط زمن وقفة النقلة وتحديث أسعار الساحلي"
                value={publishReason}
                onInput={(e) => setPublishReason((e.currentTarget as HTMLInputElement).value)}
              />

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setShowDiffModal(false)}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={handlePublish}>
                  تأكيد النشر فورياً
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* نافذة استعراض الإصدارات السابقة والاسترجاع */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '520px' }}>
            <Card title="سجل إصدارات الإعدادات (Settings History)">
              <div style={{ display: 'grid', gap: '8px', maxHeight: '50vh', overflowY: 'auto', padding: '4px' }}>
                {settingsManager.getVersionHistory().map((ver) => (
                  <div
                    key={ver.version}
                    style={{
                      background: 'var(--soft)',
                      padding: '10px 14px',
                      borderRadius: 'var(--r-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                  >
                    <div>
                      <b style={{ color: 'var(--acc)', fontSize: '0.9rem' }}>الإصدار v{ver.version}</b>
                      <small style={{ display: 'block', color: 'var(--mute)', marginTop: '2px' }}>{ver.reason}</small>
                      <small style={{ color: 'var(--mute)', fontSize: '0.74rem' }}>
                        بواسطة: {ver.publishedBy} · {new Date(ver.publishedAt).toLocaleDateString('ar-EG')}
                      </small>
                    </div>

                    <Button
                      variant="outline"
                      style={{ minHeight: '32px', fontSize: '0.78rem' }}
                      onClick={() => handleRollback(ver.version)}
                    >
                      استرجاع
                    </Button>
                  </div>
                ))}
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