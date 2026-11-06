import { useState, useEffect } from 'preact/hooks';
import { syncHealthService } from '../services/syncHealth';
import { type SyncHealthEvaluation, type SyncStateDocument } from '@badawi/logic';
import { showToast } from '../components/Toast';

export default function Dashboard() {
  const [evalResult, setEvalResult] = useState<SyncHealthEvaluation>(syncHealthService.getEvaluation());
  const [doc, setDoc] = useState<SyncStateDocument | null>(syncHealthService.getDocument());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    return syncHealthService.subscribe((res, syncDoc) => {
      setEvalResult(res);
      setDoc(syncDoc);
    });
  }, []);

  const handleManualCheck = async () => {
    setIsRefreshing(true);
    await syncHealthService.refresh();
    setIsRefreshing(false);
    showToast('تم تحديث حالة السحب والمزامنة الحية');
  };

  return (
    <div style={{ display: 'grid', gap: '14px' }} className="animate-fade-in">
      {/* Welcome Banner */}
      <div style={{ background: 'var(--card)', padding: '16px 20px', borderRadius: 'var(--r)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: 'var(--ink)' }}>صباح الخير 👋</h2>
          <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>منصة متابعة الأسطول وعمليات النقل والتشغيل اليومية</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-outline"
            disabled={isRefreshing}
            onClick={handleManualCheck}
            style={{ fontSize: '0.82rem', padding: '6px 12px' }}
          >
            {isRefreshing ? 'جاري الفحص...' : '🔄 تحديث مؤشر السحب'}
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
            <b style={{ color: 'var(--tx)', fontSize: '0.94rem' }}>{doc?.stats?.vehiclesTotal || 65} عربية</b>
          </div>
          <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '0.76rem' }}>توفير كتابات Spark:</span>
            <b style={{ color: 'var(--ok)', fontSize: '0.94rem' }}>
              {doc?.stats ? `${doc.stats.writesSkipped} موفرة (${Math.round((doc.stats.writesSkipped / (doc.stats.vehiclesTotal || 65)) * 100)}%)` : '93% توفير'}
            </b>
          </div>
          <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--mute)', display: 'block', fontSize: '0.76rem' }}>زمن المعالجة:</span>
            <b style={{ color: 'var(--tx)', fontSize: '0.94rem' }}>{doc?.stats?.lastDurationMs || 1140} مللي ثانية</b>
          </div>
        </div>
      </div>

      {/* Fleet Quick Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <div style={{ background: 'var(--card)', padding: '14px', borderRadius: 'var(--r)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <small style={{ color: 'var(--mute)' }}>متصلة الآن (Online)</small>
          <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--ok)', marginTop: '4px' }}>52 / 65</b>
        </div>
        <div style={{ background: 'var(--card)', padding: '14px', borderRadius: 'var(--r)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <small style={{ color: 'var(--mute)' }}>غير متصلة (Offline)</small>
          <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--bad)', marginTop: '4px' }}>9</b>
        </div>
        <div style={{ background: 'var(--card)', padding: '14px', borderRadius: 'var(--r)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <small style={{ color: 'var(--mute)' }}>استفسارات معلقة</small>
          <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--warn)', marginTop: '4px' }}>3</b>
        </div>
        <div style={{ background: 'var(--card)', padding: '14px', borderRadius: 'var(--r)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <small style={{ color: 'var(--mute)' }}>محفظة Petro</small>
          <b style={{ display: 'block', fontSize: '1.4rem', color: 'var(--accent)', marginTop: '4px' }}>34,200 ج.م</b>
        </div>
      </div>
    </div>
  );
}