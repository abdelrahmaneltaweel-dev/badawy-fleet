import { useState, useEffect } from 'preact/hooks';
import {
  SETTINGS_REGISTRY,
  SETTING_SECTION_LABELS,
  type SettingSection,
  type SettingDefinition,
  type CuratedFontId,
  type UserPersonalPreferences
} from '@badawi/logic';
import { settingsService } from '../services/settings';
import { appearanceService } from '../services/appearance';
import { authService } from '../services/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Switch } from '../components/Switch';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { Table } from '../components/Table';
import { showToast } from '../components/Toast';

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingSection>('appearance');
  const [effectiveValues, setEffectiveValues] = useState<Record<string, unknown>>(
    settingsService.getEffectiveValues()
  );
  const [hasDraft, setHasDraft] = useState<boolean>(settingsService.hasDraft());
  const [publishedVersion, setPublishedVersion] = useState<number>(settingsService.getSettings().version);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showRiskModal, setShowRiskModal] = useState<boolean>(false);

  // User Local Appearance Preferences (T3.5)
  const [userPrefs, setUserPrefs] = useState<UserPersonalPreferences>(
    appearanceService.getPreferences()
  );

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

  const handleFieldChange = (def: SettingDefinition, newValue: unknown) => {
    const res = settingsService.updateDraftValue(def.key, newValue);
    if (!res.valid) {
      showToast(res.error || 'قيمة غير مقبولة');
    }
  };

  const handlePublish = () => {
    if (!canManageSettings) {
      showToast('ليس لديك صلاحية نشر الإعدادات');
      return;
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

      {/* Active Section Auto-Generated Fields */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {currentSectionSettings.map((def) => {
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
                </div>
              </div>
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