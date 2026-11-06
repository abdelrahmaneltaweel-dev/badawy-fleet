import { useState, useEffect, useMemo } from 'preact/hooks';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { Icon } from '../components/Icon';
import { showToast } from '../components/Toast';
import { auditService } from '../services/audit';
import { authService, type UserProfile } from '../services/auth';
import type {
  AuditLogItem,
  AuditAction,
  CollectionName,
  AuditFilterParams
} from '@badawi/logic';

const COLLECTION_OPTIONS = [
  { value: 'all', label: 'كافة المجموعات' },
  { value: 'vehicles', label: 'العربيات (vehicles)' },
  { value: 'drivers', label: 'السائقين (drivers)' },
  { value: 'assignments', label: 'إسناد السائقين (assignments)' },
  { value: 'sites', label: 'المواقع (sites)' },
  { value: 'inquiries', label: 'الاستفسارات (inquiries)' },
  { value: 'statements', label: 'البيانات المساندة (statements)' },
  { value: 'settings', label: 'الإعدادات (settings)' },
  { value: 'period_snapshots', label: 'لقطات الفترات (period_snapshots)' }
];

const ACTION_OPTIONS = [
  { value: 'all', label: 'كافة العمليات' },
  { value: 'create', label: 'إنشاء (create)' },
  { value: 'update', label: 'تعديل (update)' },
  { value: 'delete', label: 'حذف (delete)' },
  { value: 'close_period', label: 'إغلاق فترة (close_period)' },
  { value: 'open_period', label: 'فتح فترة (open_period)' },
  { value: 'override', label: 'تعديل يدوي (override)' }
];

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogItem[]>(auditService.getLogs());
  const [currentUser] = useState<UserProfile | null>(authService.getCurrentUser());
  const [platformUsers] = useState<UserProfile[]>(authService.listUsers());
  const [activeOnBehalf, setActiveOnBehalf] = useState<UserProfile | null>(auditService.getActiveOnBehalfUser());

  // Filter state
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [onBehalfOnly, setOnBehalfOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Selected Log for detail modal / view
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Representation selector state
  const [selectedRepresenteeUid, setSelectedRepresenteeUid] = useState<string>('');

  useEffect(() => {
    return auditService.subscribe(() => {
      setLogs(auditService.getLogs());
      setActiveOnBehalf(auditService.getActiveOnBehalfUser());
    });
  }, []);

  const filteredLogs = useMemo(() => {
    const params: AuditFilterParams = {
      collection: selectedCollection as CollectionName | 'all',
      action: selectedAction as AuditAction | 'all',
      onBehalfOnly,
      search: searchQuery,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };
    return auditService.getLogs(params);
  }, [logs, selectedCollection, selectedAction, onBehalfOnly, searchQuery, startDate, endDate]);

  const stats = useMemo(() => {
    const total = logs.length;
    const onBehalfCount = logs.filter((l) => Boolean(l.onBehalfOf)).length;
    const updatesAndDeletes = logs.filter((l) => l.action === 'update' || l.action === 'delete').length;
    return { total, onBehalfCount, updatesAndDeletes };
  }, [logs]);

  // Activate On-Behalf representation (ADR-018)
  const handleActivateOnBehalf = () => {
    if (!selectedRepresenteeUid) {
      showToast('يرجى اختيار المستخدم المراد الإدخال بالنيابة عنه');
      return;
    }
    const target = platformUsers.find((u) => u.uid === selectedRepresenteeUid);
    if (!target) return;

    auditService.setActiveOnBehalfUser(target);
    setActiveOnBehalf(target);
    showToast(`تم تفعيل وضع الإدخال بالنيابة عن: ${target.displayName} (${authService.getRoleLabel(target.role)})`);
  };

  const handleDeactivateOnBehalf = () => {
    auditService.setActiveOnBehalfUser(null);
    setActiveOnBehalf(null);
    setSelectedRepresenteeUid('');
    showToast('تم إنهاء وضع الإدخال بالنيابة. العمليات الآن باسمك المباشر.');
  };

  const handleRetentionCheck = () => {
    const removed = auditService.cleanupExpiredLogs(24);
    if (removed > 0) {
      showToast(`تم تنظيف ${removed} سجلاً تجاوزت فترة الاحتفاظ (24 شهراً) بنجاح.`);
    } else {
      showToast('جميع السجلات الحالية تقع ضمن فترة الاحتفاظ المعتمدة (24 شهراً - ADR-056).');
    }
  };

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'create':
        return (
          <span style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', padding: '3px 8px', borderRadius: 'var(--r-full)', fontSize: '0.78rem', fontWeight: 600 }}>
            إنشاء
          </span>
        );
      case 'update':
        return (
          <span style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', padding: '3px 8px', borderRadius: 'var(--r-full)', fontSize: '0.78rem', fontWeight: 600 }}>
            تعديل
          </span>
        );
      case 'delete':
        return (
          <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', padding: '3px 8px', borderRadius: 'var(--r-full)', fontSize: '0.78rem', fontWeight: 600 }}>
            حذف
          </span>
        );
      case 'close_period':
      case 'open_period':
        return (
          <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '3px 8px', borderRadius: 'var(--r-full)', fontSize: '0.78rem', fontWeight: 600 }}>
            فترة مالية
          </span>
        );
      default:
        return (
          <span style={{ background: 'var(--soft)', color: 'var(--tx)', padding: '3px 8px', borderRadius: 'var(--r-full)', fontSize: '0.78rem', fontWeight: 600 }}>
            {action}
          </span>
        );
    }
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* Header & ADR References */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--tx)' }}>
            سجل المراجعة والتدقيق (Audit Log)
          </h2>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--mute)' }}>
            توثيق تاريخي غير قابل للتعديل لكل عملية مع تسجيل المنفّذ الفعلي (enteredBy) والإدخال بالنيابة (onBehalfOf) وفروق القيم (ADR-018, ADR-056).
          </p>
        </div>

        {isSuperAdmin && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="outline"
              icon={<Icon name="refresh" size={16} />}
              onClick={handleRetentionCheck}
            >
              فحص الاحتفاظ (24 شهراً)
            </Button>
          </div>
        )}
      </div>

      {/* KPI Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--mute)' }}>إجمالي العمليات المسجلة</span>
            <b style={{ fontSize: '1.5rem', color: 'var(--tx)' }}>{stats.total}</b>
            <small style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>سجلات تدقيق نشطة</small>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--mute)' }}>عمليات بالنيابة (onBehalfOf)</span>
            <b style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>{stats.onBehalfCount}</b>
            <small style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>موثقة بسجل المشغل والوكيل</small>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--mute)' }}>تعديلات وحذف (Before/After)</span>
            <b style={{ fontSize: '1.5rem', color: 'var(--tx)' }}>{stats.updatesAndDeletes}</b>
            <small style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>مع بصمة الفروق التفصيلية</small>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--mute)' }}>سياسة الاحتفاظ بالبيانات</span>
            <b style={{ fontSize: '1.3rem', color: 'var(--tx)' }}>24 شهراً</b>
            <small style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>خطة Spark المجانية (ADR-056)</small>
          </div>
        </Card>
      </div>

      {/* On-Behalf Mode Banner & Switcher (ADR-018) */}
      {isSuperAdmin && (
        <div
          className="card"
          style={{
            border: activeOnBehalf ? '2px solid var(--accent)' : '1px solid var(--line)',
            background: activeOnBehalf ? 'var(--soft)' : 'var(--card)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="user" size={20} />
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {activeOnBehalf
                    ? `⚠️ وضع الإدخال بالنيابة نشط: أنت تعمل الآن باسم «${activeOnBehalf.displayName}» (${authService.getRoleLabel(activeOnBehalf.role)})`
                    : 'الإدخال بالنيابة عن مستخدم (On-Behalf Of Mode - ADR-018)'}
                </span>
              </div>

              {activeOnBehalf && (
                <Button variant="danger" onClick={handleDeactivateOnBehalf}>
                  إنهاء وضع النيابة
                </Button>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--mute)' }}>
              يستطيع الـ Super Admin إدخال أو تعديل أي بيان أو عربية أو رد نيابة عن أي مستخدم (سائق، مدير خلاطة، أمن الجراج)، مع توثيق هوية المنفّذ وهوية المستهدف تلقائياً في السجل.
            </p>

            {!activeOnBehalf && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '260px', flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', fontWeight: 500 }}>
                    اختر المستخدم المراد تمثيله:
                  </label>
                  <select
                    className="inp"
                    style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: 'var(--r-md)', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--tx)' }}
                    value={selectedRepresenteeUid}
                    onChange={(e) => setSelectedRepresenteeUid((e.target as HTMLSelectElement).value)}
                  >
                    <option value="">-- اختر مستخدم من المنصة --</option>
                    {platformUsers
                      .filter((u) => u.uid !== currentUser?.uid)
                      .map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName} ({authService.getRoleLabel(u.role)}) - {u.email}
                        </option>
                      ))}
                  </select>
                </div>

                <Button
                  variant="primary"
                  onClick={handleActivateOnBehalf}
                  disabled={!selectedRepresenteeUid}
                >
                  تفعيل الإدخال بالنيابة
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>تصفية السجلات والبحث</span>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedCollection('all');
                setSelectedAction('all');
                setOnBehalfOnly(false);
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
              }}
            >
              إعادة تعيين
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--mute)' }}>المجموعة</label>
              <Select
                options={COLLECTION_OPTIONS}
                value={selectedCollection}
                onChange={setSelectedCollection}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--mute)' }}>العملية</label>
              <Select
                options={ACTION_OPTIONS}
                value={selectedAction}
                onChange={setSelectedAction}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--mute)' }}>من تاريخ</label>
              <Field
                type="date"
                value={startDate}
                onChange={(e) => setStartDate((e.target as HTMLInputElement).value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--mute)' }}>إلى تاريخ</label>
              <Field
                type="date"
                value={endDate}
                onChange={(e) => setEndDate((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <Field
                placeholder="بحث برقم المعرف، اسم المنفّذ، أو نص البيان..."
                value={searchQuery}
                onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem' }}>
              <input
                type="checkbox"
                checked={onBehalfOnly}
                onChange={(e) => setOnBehalfOnly((e.target as HTMLInputElement).checked)}
              />
              <span>عرض عمليات الإدخال بالنيابة فقط (onBehalfOf)</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Audit Logs Table / Feed */}
      <Card title={`قائمة السجلات المعروضة (${filteredLogs.length})`}>
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
            لا توجد سجلات مطابقة لشروط البحث
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--mute)' }}>
                  <th style={{ padding: '10px 8px' }}>التاريخ والوقت</th>
                  <th style={{ padding: '10px 8px' }}>العملية</th>
                  <th style={{ padding: '10px 8px' }}>المجموعة</th>
                  <th style={{ padding: '10px 8px' }}>المعرّف</th>
                  <th style={{ padding: '10px 8px' }}>دخل بواسطة (enteredBy)</th>
                  <th style={{ padding: '10px 8px' }}>بالنيابة عن (onBehalfOf)</th>
                  <th style={{ padding: '10px 8px' }}>التفاصيل والفروق</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const hasOnBehalf = Boolean(log.onBehalfOf);
                  const hasDiff = Object.keys(log.diff || {}).length > 0;
                  const formattedTime = new Date(log.timestamp).toLocaleString('en-GB', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  });

                  return (
                    <tr
                      key={log.logId}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        background: hasOnBehalf ? 'rgba(var(--accent-rgb), 0.03)' : undefined
                      }}
                    >
                      <td style={{ padding: '12px 8px', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>
                        {formattedTime}
                      </td>

                      <td style={{ padding: '12px 8px' }}>
                        {getActionBadge(log.action)}
                      </td>

                      <td style={{ padding: '12px 8px' }}>
                        <code style={{ fontSize: '0.8rem', background: 'var(--soft)', padding: '2px 6px', borderRadius: '4px' }}>
                          {log.collection}
                        </code>
                      </td>

                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                        {log.documentId}
                      </td>

                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{log.enteredByName || log.userName}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 8px' }}>
                        {hasOnBehalf ? (
                          <span style={{ color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Icon name="user" size={14} />
                            {log.onBehalfOfName || log.onBehalfOf}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--mute)' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 8px' }}>
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedLog(log)}
                        >
                          {hasDiff ? `فحص الفروق (${Object.keys(log.diff).length})` : 'عرض السجل'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detailed Diff & Before/After Modal */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            style={{
              background: 'var(--card)',
              color: 'var(--tx)',
              borderRadius: 'var(--r-lg)',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: 'var(--sh-lg)',
              border: '1px solid var(--line)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem' }}>
                  تفاصيل سجل المراجعة: {selectedLog.title}
                </h3>
                <small style={{ color: 'var(--mute)', direction: 'ltr', display: 'inline-block' }}>
                  {new Date(selectedLog.timestamp).toISOString()}
                </small>
              </div>

              <button
                type="button"
                className="ib"
                onClick={() => setSelectedLog(null)}
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* Operator and On-Behalf Card */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                padding: '12px',
                background: 'var(--soft)',
                borderRadius: 'var(--r-md)',
                marginBottom: '16px'
              }}
            >
              <div>
                <small style={{ color: 'var(--mute)', display: 'block' }}>المنفّذ الحقيقي (enteredBy):</small>
                <b>{selectedLog.enteredByName}</b> <small style={{ color: 'var(--mute)' }}>({selectedLog.enteredBy})</small>
              </div>

              <div>
                <small style={{ color: 'var(--mute)', display: 'block' }}>الإدخال بالنيابة عن (onBehalfOf):</small>
                {selectedLog.onBehalfOf ? (
                  <b style={{ color: 'var(--accent)' }}>
                    {selectedLog.onBehalfOfName} <small>({selectedLog.onBehalfOf})</small>
                  </b>
                ) : (
                  <span style={{ color: 'var(--mute)' }}>لا يوجد (إجراء مباشر)</span>
                )}
              </div>
            </div>

            {/* Diff Viewer (Before vs After) */}
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.96rem' }}>فروق القيم المحفوظة (Diff):</h4>
            {Object.keys(selectedLog.diff || {}).length === 0 ? (
              <p style={{ fontSize: '0.86rem', color: 'var(--mute)' }}>
                لا توجد فروق قيم مسجلة لهذا الإجراء (إنشاء جديد أو حفظ أولي).
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {Object.entries(selectedLog.diff).map(([key, val]) => (
                  <div
                    key={key}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      padding: '10px',
                      background: 'var(--bg)'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--tx)', marginBottom: '6px' }}>
                      الحقل: <code>{key}</code>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.82rem' }}>
                      <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '6px 8px', borderRadius: '4px' }}>
                        <span style={{ color: '#ef4444', fontWeight: 600, display: 'block', marginBottom: '2px' }}>قبل (Before):</span>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                          {val.before !== null ? JSON.stringify(val.before, null, 2) : 'null (غير موجود)'}
                        </pre>
                      </div>

                      <div style={{ background: 'rgba(34, 197, 94, 0.08)', padding: '6px 8px', borderRadius: '4px' }}>
                        <span style={{ color: '#22c55e', fontWeight: 600, display: 'block', marginBottom: '2px' }}>بعد (After):</span>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                          {val.after !== null ? JSON.stringify(val.after, null, 2) : 'null (محذوف)'}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Raw Record JSON */}
            <details style={{ marginTop: '12px', fontSize: '0.82rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--mute)', fontWeight: 500 }}>
                عرض مستند السجل الكامل الخام (JSON)
              </summary>
              <pre
                style={{
                  background: 'var(--soft)',
                  padding: '12px',
                  borderRadius: 'var(--r-md)',
                  overflowX: 'auto',
                  marginTop: '8px',
                  direction: 'ltr',
                  textAlign: 'left'
                }}
              >
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </details>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Button variant="primary" onClick={() => setSelectedLog(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
