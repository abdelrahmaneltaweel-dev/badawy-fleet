import { useState, useEffect } from 'preact/hooks';
import { syncHealthService } from '../services/syncHealth';
import { type SyncHealthEvaluation, type SyncStateDocument } from '@badawi/logic';
import { showToast } from './Toast';

export function SyncHealthIndicator() {
  const [evalResult, setEvalResult] = useState<SyncHealthEvaluation>(syncHealthService.getEvaluation());
  const [doc, setDoc] = useState<SyncStateDocument | null>(syncHealthService.getDocument());
  const [isOpen, setIsOpen] = useState(false);
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
    showToast('تم تحديث حالة السحب والمزامنة');
  };

  const getStatusIcon = () => {
    switch (evalResult.status) {
      case 'healthy':
        return '✓';
      case 'degraded':
        return '⏱';
      case 'error':
        return '⚠';
      default:
        return '•';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Header Pill Button */}
      <button
        type="button"
        className="pill-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={evalResult.detailArabic}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: evalResult.badgeBgVar,
          border: `1px solid ${evalResult.colorVar}`,
          color: 'var(--tx)',
          fontSize: '0.82rem',
          fontWeight: 600
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: evalResult.colorVar,
            boxShadow: `0 0 6px ${evalResult.colorVar}`,
            display: 'inline-block'
          }}
        />
        <span>{evalResult.labelArabic}</span>
      </button>

      {/* Floating Detailed Popover */}
      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: '320px',
              maxWidth: '90vw',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--sh-lg)',
              padding: '16px',
              zIndex: 999,
              display: 'grid',
              gap: '12px',
              textAlign: 'right'
            }}
            className="animate-fade-in"
          >
            {/* Popover Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: evalResult.colorVar
                  }}
                />
                <b style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>حالة سحب ومزامنة الأسطول</b>
              </div>
              <button
                type="button"
                className="ib"
                onClick={() => setIsOpen(false)}
                style={{ padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--mute)' }}
              >
                ✕
              </button>
            </div>

            {/* Status Banner */}
            <div
              style={{
                background: evalResult.badgeBgVar,
                border: `1px solid ${evalResult.colorVar}`,
                borderRadius: 'var(--r-sm)',
                padding: '10px 12px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{getStatusIcon()}</span>
              <div>
                <b style={{ color: evalResult.colorVar, display: 'block' }}>{evalResult.labelArabic}</b>
                <span style={{ color: 'var(--tx)', fontSize: '0.78rem' }}>{evalResult.detailArabic}</span>
              </div>
            </div>

            {/* Detailed Metrics */}
            <div style={{ display: 'grid', gap: '6px', fontSize: '0.8rem', background: 'var(--soft)', padding: '10px', borderRadius: 'var(--r-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--mute)' }}>آخر سحب ناجح:</span>
                <b style={{ color: 'var(--tx)' }}>
                  {doc?.lastRunAt ? new Date(doc.lastRunAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'غير محدد'}
                </b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--mute)' }}>يوم التشغيل المعتمد:</span>
                <b style={{ color: 'var(--tx)' }}>{doc?.operationalDate || 'اليوم'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--mute)' }}>عربيات الأسطول المعالجة:</span>
                <b style={{ color: 'var(--tx)' }}>{doc?.stats?.vehiclesTotal || 65} عربية</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--mute)' }}>توفير كتابات Spark (FNV-1a):</span>
                <b style={{ color: 'var(--ok)' }}>
                  {doc?.stats ? `${doc.stats.writesSkipped} موفرة / ${doc.stats.writesExecuted} مسجلة` : 'نشط'}
                </b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--mute)' }}>مدة المعالجة الأخيرة:</span>
                <b style={{ color: 'var(--tx)' }}>{doc?.stats?.lastDurationMs || 0} مللي ثانية</b>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
              <a
                href="#/settings"
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600
                }}
              >
                <span>⚙️ ضبط معدل التحديث</span>
              </a>
              <button
                type="button"
                className="btn btn-outline"
                disabled={isRefreshing}
                onClick={handleManualCheck}
                style={{ fontSize: '0.78rem', padding: '4px 10px', minHeight: '30px' }}
              >
                {isRefreshing ? 'جاري الفحص...' : '🔄 فحص الآن'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
