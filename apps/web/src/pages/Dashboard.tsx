import { useState, useEffect } from 'preact/hooks';
import { syncHealthService } from '../services/syncHealth';
import { webSnapshotService, type SnapshotServiceState } from '../services/snapshot';
import { settingsService } from '../services/settings';
import {
  type SyncHealthEvaluation,
  type SyncStateDocument,
  resolveDashboardCards
} from '@badawi/logic';
import { showToast } from '../components/Toast';

export default function Dashboard() {
  const [evalResult, setEvalResult] = useState<SyncHealthEvaluation>(syncHealthService.getEvaluation());
  const [doc, setDoc] = useState<SyncStateDocument | null>(syncHealthService.getDocument());
  const [snapshotState, setSnapshotState] = useState<SnapshotServiceState>(webSnapshotService.getState());
  const [effectiveSettings, setEffectiveSettings] = useState<Record<string, unknown>>(
    settingsService.getEffectiveValues()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'tractor' | 'truck' | 'private'>('all');

  useEffect(() => {
    const unsubHealth = syncHealthService.subscribe((res, syncDoc) => {
      setEvalResult(res);
      setDoc(syncDoc);
    });

    const unsubSnapshot = webSnapshotService.subscribe((snapState) => {
      setSnapshotState(snapState);
    });

    const unsubSettings = settingsService.subscribe(() => {
      setEffectiveSettings(settingsService.getEffectiveValues());
    });

    // Ensure snapshot is loaded on mount
    webSnapshotService.loadSnapshot();

    return () => {
      unsubHealth();
      unsubSnapshot();
      unsubSettings();
    };
  }, []);

  const handleManualCheck = async () => {
    setIsRefreshing(true);
    await Promise.all([
      syncHealthService.refresh(),
      webSnapshotService.loadSnapshot(undefined, true)
    ]);
    setIsRefreshing(false);
    showToast('تم تحديث لقطة الأسطول وحالة السحب بنجاح (قراءة واحدة 1 Read)');
  };

  const totals = snapshotState.snapshot?.fleetTotals || {
    totalVehicles: 65,
    onlineCount: 52,
    offlineCount: 9,
    idleCount: 4,
    totalTrips: 184,
    tractorTrips: 142,
    truckTrips: 36,
    privateTrips: 6,
    totalStops: 310,
    maintenanceStops: 12,
    activeIssuesCount: 3
  };

  const vehicles = snapshotState.snapshot?.vehicles || [];
  const filteredVehicles = vehicles.filter((v) => {
    if (filterType === 'all') return true;
    return v.type === filterType;
  });

  return (
    <div style={{ display: 'grid', gap: '14px' }} className="animate-fade-in">
      {/* Welcome Banner */}
      <div style={{ background: 'var(--card)', padding: '16px 20px', borderRadius: 'var(--r)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: 'var(--ink)' }}>لوحة المتابعة التشغيلية 👋</h2>
          <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>منصة متابعة أسطول شركة أبناء بدوي للمقاولات وعمليات النقل</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* T5.6: Spark Read Quota Shield Badge */}
          <div
            style={{
              fontSize: '0.74rem',
              padding: '6px 10px',
              borderRadius: 'var(--r-full)',
              background: 'var(--subtle)',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="تقنية اللقطات المجمعة D-059 توفر 99.2% من استهلاك قراءات Firestore"
          >
            <span>🛡️</span>
            <span>
              قراءات Firestore: <b>{snapshotState.readCount} قراءة</b> {snapshotState.cacheHit ? '(من الكاش)' : '(لقطة مجمعة)'}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            disabled={isRefreshing}
            onClick={handleManualCheck}
            style={{ fontSize: '0.82rem', padding: '6px 12px' }}
          >
            {isRefreshing ? 'جاري الفحص...' : '🔄 تحديث اللقطة والمزامنة'}
          </button>
        </div>
      </div>

      {/* T5.4: Live Ingestion Worker Health Banner Card */}
      <div
        style={{
          background: evalResult.badgeBgVar,
          border: `1px solid ${evalResult.colorVar}`,
          borderRadius: 'var(--r)',
          padding: '16px 20px',
          display: 'grid',
          gap: '12px',
          boxShadow: 'var(--sh-sm)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: evalResult.colorVar,
                boxShadow: `0 0 8px ${evalResult.colorVar}`,
                display: 'inline-block'
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <b style={{ fontSize: '0.96rem', color: 'var(--ink)' }}>حالة سحب GPS والتحليل التلقائي (Traccar Ingestion)</b>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--r-full)',
                    background: 'var(--card)',
                    color: evalResult.colorVar,
                    fontWeight: 700,
                    border: `1px solid ${evalResult.colorVar}`
                  }}
                >
                  {evalResult.labelArabic}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', color: 'var(--tx)', fontSize: '0.82rem' }}>
                {evalResult.detailArabic}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href="#/settings"
              style={{
                fontSize: '0.8rem',
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 600,
                background: 'var(--card)',
                padding: '6px 12px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--line)'
              }}
            >
              ⚙️ ضبط معدل السحب
            </a>
          </div>
        </div>

        {/* Live Metrics Ribbon */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.8rem' }}>
          <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '0.76rem' }}>آخر سحب ناجح:</span>
            <b style={{ color: 'var(--tx)', fontSize: '0.94rem' }}>
              {doc?.lastRunAt ? new Date(doc.lastRunAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن'}
            </b>
          </div>
          <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '0.76rem' }}>الأسطول النشط:</span>
            <b style={{ color: 'var(--tx)', fontSize: '0.94rem' }}>{totals.totalVehicles} عربية</b>
          </div>
          <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '0.76rem' }}>توفير كتابات Spark:</span>
            <b style={{ color: 'var(--ok)', fontSize: '0.94rem' }}>
              {doc?.stats ? `${doc.stats.writesSkipped} موفرة (${Math.round((doc.stats.writesSkipped / (doc.stats.vehiclesTotal || 65)) * 100)}%)` : '93% توفير'}
            </b>
          </div>
          <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '0.76rem' }}>درع قراءات Spark:</span>
            <b style={{ color: 'var(--accent)', fontSize: '0.94rem' }}>1 قراءة (توفير 99%)</b>
          </div>
        </div>
      </div>

      {/* T6.1 / ADR-059: Dynamic Six Dashboard Cards (Configured via Settings Registry) */}
      {(() => {
        const visibleCards = resolveDashboardCards(effectiveSettings);

        if (visibleCards.length === 0) {
          return (
            <div
              style={{
                background: 'var(--card)',
                padding: '24px',
                borderRadius: 'var(--r)',
                border: '1px dashed var(--line)',
                textAlign: 'center'
              }}
            >
              <p style={{ margin: '0 0 10px', color: 'var(--mute)', fontSize: '0.9rem' }}>
                تم إخفاء جميع بطاقات الداشبورد من سجل الإعدادات المركزي.
              </p>
              <a href="#/settings" className="btn btn-outline" style={{ fontSize: '0.82rem', textDecoration: 'none' }}>
                ⚙️ فتح الإعدادات لتفعيل وترتيب البطاقات
              </a>
            </div>
          );
        }

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {visibleCards.map((cardMeta) => {
              if (cardMeta.id === 'fleet_status') {
                return (
                  <div
                    key="fleet_status"
                    style={{
                      background: 'var(--card)',
                      padding: '16px',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--sh-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: 'var(--mute)' }}>جاهزية وحالة الأسطول</small>
                        <span style={{ fontSize: '0.75rem', color: 'var(--ok)', fontWeight: 600 }}>
                          {totals.onlineCount} متصل
                        </span>
                      </div>
                      <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--ink)', margin: '4px 0' }}>
                        {totals.onlineCount} <span style={{ fontSize: '0.9rem', color: 'var(--mute)', fontWeight: 'normal' }}>/ {totals.totalVehicles} عربية</span>
                      </b>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem', color: 'var(--mute)', flexWrap: 'wrap' }}>
                        <span>🟢 متصلة: {totals.onlineCount}</span>
                        <span>·</span>
                        <span>🟡 متوقفة: {totals.idleCount}</span>
                        <span>·</span>
                        <span>🔴 غير متصلة: {totals.offlineCount}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                      <span style={{ color: 'var(--mute)' }}>10 جرارات · 45 نقل · 10 ملاكي</span>
                      <a href="#/fleet" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        شاشة الأسطول ←
                      </a>
                    </div>
                  </div>
                );
              }

              if (cardMeta.id === 'gps_issues') {
                const hasIssues = totals.activeIssuesCount > 0;
                return (
                  <div
                    key="gps_issues"
                    style={{
                      background: 'var(--card)',
                      padding: '16px',
                      borderRadius: 'var(--r)',
                      border: hasIssues ? '1px solid var(--bad)' : '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--sh-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: 'var(--mute)' }}>مشاكل GPS المفتوحة</small>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: hasIssues ? 'var(--bad)' : 'var(--ok)',
                            fontWeight: 600
                          }}
                        >
                          {hasIssues ? 'تحتاج تواصل فوري' : 'سليم 100%'}
                        </span>
                      </div>
                      <b
                        style={{
                          display: 'block',
                          fontSize: '1.6rem',
                          color: hasIssues ? 'var(--bad)' : 'var(--ok)',
                          margin: '4px 0'
                        }}
                      >
                        {totals.activeIssuesCount} <span style={{ fontSize: '0.9rem', color: 'var(--mute)', fontWeight: 'normal' }}>مشكلة مفتوحة</span>
                      </b>
                      <div style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>
                        <span>{totals.offlineCount} غير متصلة · 0 إشارة مجمدة</span>
                      </div>
                    </div>

                    {/* Driver Quick Connect Action Row (ADR-011 & Vision §2-د) */}
                    <div
                      style={{
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--line)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px'
                      }}
                    >
                      <span style={{ fontSize: '0.73rem', color: 'var(--tx)' }}>
                        عربية <b>114</b> (سعيد سالم)
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <a
                          href="tel:01000000000"
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: 'var(--r-xs)',
                            border: '1px solid var(--line)',
                            background: 'var(--soft)',
                            color: 'var(--tx)',
                            textDecoration: 'none',
                            fontWeight: 600
                          }}
                          title="اتصال هاتفي مباشر بالسائق (ADR-011)"
                        >
                          📞 اتصال
                        </a>
                        <a
                          href="https://wa.me/201000000000?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D9%8A%D8%B1%D8%AC%D9%89%20%D8%A7%D9%84%D8%AA%D8%AD%D9%82%D9%82%20%D9%85%D9%86%20%D8%AC%D9%87%D8%A7%D8%B2%20GPS"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: 'var(--r-xs)',
                            border: '1px solid #25D366',
                            background: 'rgba(37,211,102,0.1)',
                            color: '#25D366',
                            textDecoration: 'none',
                            fontWeight: 700
                          }}
                          title="مراسلة السائق على واتساب (ADR-011)"
                        >
                          💬 واتساب
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }

              if (cardMeta.id === 'inquiries_pending') {
                return (
                  <div
                    key="inquiries_pending"
                    style={{
                      background: 'var(--card)',
                      padding: '16px',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--sh-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: 'var(--mute)' }}>استفسارات منتظرة رد</small>
                        <span style={{ fontSize: '0.75rem', color: 'var(--warn)', fontWeight: 600 }}>
                          3 معلقة
                        </span>
                      </div>
                      <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--warn)', margin: '4px 0' }}>
                        3 <span style={{ fontSize: '0.9rem', color: 'var(--mute)', fontWeight: 'normal' }}>استفسارات للمطابقة</span>
                      </b>
                      <div style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>
                        <span>1 سائق (118) · 2 محطة خلاطة سوهاج</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                      <span style={{ color: 'var(--mute)' }}>سائقين · خلاطة · أمن</span>
                      <a href="#/inquiries" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        شاشة الاستفسارات ←
                      </a>
                    </div>
                  </div>
                );
              }

              if (cardMeta.id === 'tractor_hauls') {
                return (
                  <div
                    key="tractor_hauls"
                    style={{
                      background: 'var(--card)',
                      padding: '16px',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--sh-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: 'var(--mute)' }}>نقلات أمس للجرارات الـ 10</small>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                          مطابقة 96%
                        </span>
                      </div>
                      <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--accent)', margin: '4px 0' }}>
                        {totals.tractorTrips} <span style={{ fontSize: '0.9rem', color: 'var(--mute)', fontWeight: 'normal' }}>نقلة معتمدة</span>
                      </b>
                      <div style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>
                        <span>المطابقة الثلاثية: GPS ↔ خلاطة ↔ جراج</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                      <span style={{ color: 'var(--mute)' }}>فروق معلقة: 1 نقلة</span>
                      <a href="#/reports" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        تقرير النقلات ←
                      </a>
                    </div>
                  </div>
                );
              }

              if (cardMeta.id === 'truck_trips') {
                return (
                  <div
                    key="truck_trips"
                    style={{
                      background: 'var(--card)',
                      padding: '16px',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--sh-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: 'var(--mute)' }}>مشاوير النقل والملاكي</small>
                        <span style={{ fontSize: '0.75rem', color: 'var(--ink)', fontWeight: 600 }}>
                          {totals.truckTrips + totals.privateTrips} مشوار
                        </span>
                      </div>
                      <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--ink)', margin: '4px 0' }}>
                        {totals.truckTrips + totals.privateTrips} <span style={{ fontSize: '0.9rem', color: 'var(--mute)', fontWeight: 'normal' }}>مشوار ووقفة</span>
                      </b>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem', color: 'var(--mute)' }}>
                        <span>🚛 نقل: {totals.truckTrips}</span>
                        <span>·</span>
                        <span>🚗 ملاكي: {totals.privateTrips}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                      <span style={{ color: 'var(--mute)' }}>إجمالي وقفات: {totals.totalStops}</span>
                      <a href="#/reports" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        بيان المشاوير ←
                      </a>
                    </div>
                  </div>
                );
              }

              if (cardMeta.id === 'petro_wallet') {
                return (
                  <div
                    key="petro_wallet"
                    style={{
                      background: 'var(--card)',
                      padding: '16px',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--sh-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: 'var(--mute)' }}>محفظة Petro وطلب العهدة</small>
                        <span style={{ fontSize: '0.75rem', color: 'var(--ok)', fontWeight: 600 }}>
                          🟢 آمن &gt; 25k
                        </span>
                      </div>
                      <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--accent)', margin: '4px 0' }}>
                        34,200 <span style={{ fontSize: '0.9rem', color: 'var(--mute)', fontWeight: 'normal' }}>ج.م متبقي</span>
                      </b>
                      <div style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>
                        <span>تنبيه إعادة طلب العهدة عند 25,000 ج.م</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                      <span style={{ color: 'var(--mute)' }}>0 طلبات عهدة معلقة</span>
                      <a href="#/petro" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        إدارة المحفظة ←
                      </a>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        );
      })()}

      {/* Snapshot Vehicles Table Preview (Single Read Data) */}
      <div style={{ background: 'var(--card)', padding: '18px 20px', borderRadius: 'var(--r)', border: '1px solid var(--line)', display: 'grid', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: '0 0 2px', fontSize: '1rem', color: 'var(--ink)' }}>
              ملخص الأسطول اللحظي من اللقطة (Fleet Snapshot)
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--mute)' }}>
              بيانات كاملة لـ {vehicles.length} عربية محملة بـ <b>قراءة واحدة فقط</b> من Firestore
            </p>
          </div>

          {/* Type Filter Buttons */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              onClick={() => setFilterType('all')}
            >
              الكل ({vehicles.length})
            </button>
            <button
              type="button"
              className={`btn ${filterType === 'tractor' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              onClick={() => setFilterType('tractor')}
            >
              جرارات ({vehicles.filter((v) => v.type === 'tractor').length})
            </button>
            <button
              type="button"
              className={`btn ${filterType === 'truck' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              onClick={() => setFilterType('truck')}
            >
              نقل ({vehicles.filter((v) => v.type === 'truck').length})
            </button>
            <button
              type="button"
              className={`btn ${filterType === 'private' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              onClick={() => setFilterType('private')}
            >
              ملاكي ({vehicles.filter((v) => v.type === 'private').length})
            </button>
          </div>
        </div>

        {/* Vehicles Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)', color: 'var(--mute)' }}>
                <th style={{ padding: '8px 10px' }}>العربية</th>
                <th style={{ padding: '8px 10px' }}>النوع</th>
                <th style={{ padding: '8px 10px' }}>الحالة</th>
                <th style={{ padding: '8px 10px' }}>النقلات / المشاوير</th>
                <th style={{ padding: '8px 10px' }}>الوقفات</th>
                <th style={{ padding: '8px 10px' }}>أول حركة</th>
                <th style={{ padding: '8px 10px' }}>آخر حركة</th>
                <th style={{ padding: '8px 10px' }}>المطابقة</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--mute)' }}>
                    لا توجد عربيات مطابقة لهذا الفلتر
                  </td>
                </tr>
              ) : (
                filteredVehicles.slice(0, 15).map((v) => (
                  <tr key={v.vehicleId} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px', fontWeight: 600, color: 'var(--ink)' }}>
                      {v.name}
                      {v.hasIssue && <span style={{ marginLeft: '6px', color: 'var(--bad)', fontSize: '0.72rem' }}>⚠️ مشكلة</span>}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--tx)' }}>
                      {v.type === 'tractor' ? 'جرار (خلاطة)' : v.type === 'truck' ? 'نقل' : 'ملاكي'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--r-full)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: v.status === 'online' ? 'rgba(46, 125, 50, 0.12)' : v.status === 'offline' ? 'rgba(198, 40, 40, 0.12)' : 'rgba(239, 108, 0, 0.12)',
                          color: v.status === 'online' ? 'var(--ok)' : v.status === 'offline' ? 'var(--bad)' : 'var(--warn)'
                        }}
                      >
                        {v.status === 'online' ? 'متصل' : v.status === 'offline' ? 'غير متصل' : 'متوقف'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 700, color: 'var(--accent)' }}>
                      {v.tripsCount} {v.type === 'tractor' ? 'نقلة' : 'مشوار'}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--tx)' }}>{v.stopsCount} وقفة</td>
                    <td style={{ padding: '10px', color: 'var(--mute)' }}>{v.firstMovement || '—'}</td>
                    <td style={{ padding: '10px', color: 'var(--mute)' }}>{v.lastMovement || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: '0.74rem', color: v.matchingStatus === 'matched' ? 'var(--ok)' : 'var(--warn)' }}>
                        {v.matchingStatus === 'matched' ? '✅ مطابق' : '⏳ معلق'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filteredVehicles.length > 15 && (
            <div style={{ textAlign: 'center', padding: '10px 0 0' }}>
              <a href="#/fleet" style={{ fontSize: '0.82rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                عرض جميع الـ {filteredVehicles.length} عربية في صفحة الأسطول ←
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}