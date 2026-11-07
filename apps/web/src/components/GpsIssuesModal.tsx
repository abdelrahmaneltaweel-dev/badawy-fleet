/**
 * Badawi Fleet Platform - GPS Issues Management Modal Component
 * Ref: ADR-019 (المشاكل = مشاكل GPS فقط، دورة حياة: مفتوحة ← تم التواصل ← محلولة)
 * Ref: ADR-011 (أزرار اتصال tel: وواتساب wa.me برقم السائق المسجل)
 * Ref: ADR-018 (تسجيل العمليات في audit_logs مع onBehalfOf)
 */

import { useState } from 'preact/hooks';
import type { IssueDocument, IssueType } from '@badawi/logic';
import { getIssueStatusMeta, getIssueTypeLabel } from '@badawi/logic';
import { issuesService } from '../services/issues';
import { entitiesService } from '../services/entities';
import { showToast } from './Toast';
import { Button } from './Button';

interface GpsIssuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialVehicleId?: string;
}

export function GpsIssuesModal({ isOpen, onClose, initialVehicleId }: GpsIssuesModalProps) {
  if (!isOpen) return null;

  const [issues, setIssues] = useState<IssueDocument[]>(() => issuesService.getIssues());
  const [filter, setFilter] = useState<'all' | 'open' | 'contacted' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState(initialVehicleId || '');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Note dialog state for lifecycle actions
  const [activeAction, setActiveAction] = useState<{
    issue: IssueDocument;
    mode: 'contact' | 'resolve' | 'reopen';
  } | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  // Manual issue creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newType, setNewType] = useState<IssueType>('offline');
  const [newNotes, setNewNotes] = useState('');
  const [newMinutes, setNewMinutes] = useState(30);

  const registeredVehicles = entitiesService.getVehicles();

  const reloadIssues = () => {
    setIssues(issuesService.getIssues());
  };

  const filteredIssues = issues.filter((iss) => {
    if (filter !== 'all' && iss.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchVehicle = iss.vehicleId.toLowerCase().includes(q);
      const matchDriver = (iss.driverName || '').toLowerCase().includes(q);
      const matchNotes = (iss.notes || '').toLowerCase().includes(q);
      if (!matchVehicle && !matchDriver && !matchNotes) return false;
    }
    return true;
  });

  const counts = {
    all: issues.length,
    open: issues.filter((i) => i.status === 'open').length,
    contacted: issues.filter((i) => i.status === 'contacted').length,
    resolved: issues.filter((i) => i.status === 'resolved').length
  };

  const handleOpenActionDialog = (issue: IssueDocument, mode: 'contact' | 'resolve' | 'reopen') => {
    setActiveAction({ issue, mode });
    if (mode === 'contact') {
      setActionNotes('تم التواصل هاتفياً وواتساب بالسائق وأفاد بفحص فيشة الـ GPS وتوصيلاتها');
    } else if (mode === 'resolve') {
      setActionNotes('تم حل المشكلة وتأكيد استئناف الإشارة وتحديث الإحداثيات');
    } else {
      setActionNotes('إعادة فتح المشكلة لملاحظة تكرار انقطاع الإشارة');
    }
  };

  const handleExecuteAction = () => {
    if (!activeAction) return;
    const { issue, mode } = activeAction;

    try {
      if (mode === 'contact') {
        issuesService.markContacted(issue.issueId, actionNotes);
        showToast(`تم تسجيل التواصل مع السائق للعربية ${issue.vehicleId}`);
      } else if (mode === 'resolve') {
        issuesService.markResolved(issue.issueId, actionNotes);
        showToast(`تم حل مشكلة العربية ${issue.vehicleId} بنجاح`);
      } else if (mode === 'reopen') {
        issuesService.reopenIssue(issue.issueId, actionNotes);
        showToast(`تم إعادة فتح مشكلة العربية ${issue.vehicleId}`);
      }
      reloadIssues();
      setActiveAction(null);
      setActionNotes('');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'حدث خطأ أثناء تعديل حالة المشكلة');
    }
  };

  const handleCreateIssue = (e: Event) => {
    e.preventDefault();
    if (!newVehicleId) {
      showToast('يرجى اختيار العربية أولاً');
      return;
    }

    try {
      issuesService.openIssue({
        vehicleId: newVehicleId,
        type: newType,
        notes: newNotes.trim() || undefined,
        offlineMinutes: newMinutes
      });
      showToast(`تم فتح مشكلة GPS للعربية ${newVehicleId}`);
      reloadIssues();
      setShowCreateForm(false);
      setNewVehicleId('');
      setNewNotes('');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'حدث خطأ أثناء فتح المشكلة');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(3px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          color: 'var(--tx)',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--sh-lg)',
          border: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--subtle)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛰️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--ink)' }}>
                متابعة وإدارة مشاكل أجهزة GPS (ADR-019 & ADR-011)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--mute)' }}>
                رصد تلقائي لانقطاع الإشارة وتجمد الإحداثيات مع دورة حياة: مفتوحة ← تم التواصل ← محلولة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.3rem',
              cursor: 'pointer',
              color: 'var(--mute)',
              padding: '4px 8px'
            }}
            title="إغلاق النافذة"
          >
            ✕
          </button>
        </div>

        {/* Action & Filter Toolbar */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            background: 'var(--card)'
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderRadius: 'var(--r-full)',
                border: filter === 'all' ? '1px solid var(--accent)' : '1px solid var(--line)',
                background: filter === 'all' ? 'var(--accent)' : 'var(--soft)',
                color: filter === 'all' ? '#fff' : 'var(--tx)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              الكل ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilter('open')}
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderRadius: 'var(--r-full)',
                border: filter === 'open' ? '1px solid var(--bad)' : '1px solid var(--line)',
                background: filter === 'open' ? 'var(--bad)' : 'var(--soft)',
                color: filter === 'open' ? '#fff' : 'var(--tx)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              🔴 مفتوحة ({counts.open})
            </button>
            <button
              type="button"
              onClick={() => setFilter('contacted')}
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderRadius: 'var(--r-full)',
                border: filter === 'contacted' ? '1px solid var(--warn)' : '1px solid var(--line)',
                background: filter === 'contacted' ? 'var(--warn)' : 'var(--soft)',
                color: filter === 'contacted' ? '#fff' : 'var(--tx)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              🟠 تم التواصل ({counts.contacted})
            </button>
            <button
              type="button"
              onClick={() => setFilter('resolved')}
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderRadius: 'var(--r-full)',
                border: filter === 'resolved' ? '1px solid var(--ok)' : '1px solid var(--line)',
                background: filter === 'resolved' ? 'var(--ok)' : 'var(--soft)',
                color: filter === 'resolved' ? '#fff' : 'var(--tx)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              🟢 محلولة ({counts.resolved})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="ابحث برقم العربية أو السائق..."
              value={searchQuery}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              style={{
                fontSize: '0.8rem',
                padding: '6px 12px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--line)',
                background: 'var(--soft)',
                color: 'var(--tx)',
                width: '180px'
              }}
            />
            <Button
              variant="outline"
              style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }}
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'إلغاء' : '➕ فتح مشكلة يدوياً'}
            </Button>
          </div>
        </div>

        {/* Manual Creation Form Drawer */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateIssue}
            style={{
              padding: '14px 20px',
              background: 'var(--subtle)',
              borderBottom: '1px solid var(--line)',
              display: 'grid',
              gap: '10px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
            }}
          >
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                العربية
              </label>
              <select
                value={newVehicleId}
                onChange={(e) => setNewVehicleId((e.target as HTMLSelectElement).value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)',
                  background: 'var(--card)',
                  color: 'var(--tx)',
                  fontSize: '0.82rem'
                }}
              >
                <option value="">-- اختر العربية --</option>
                {registeredVehicles.map((v) => (
                  <option key={v.vehicleId} value={v.vehicleId}>
                    {v.name} ({v.plateNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                نوع المشكلة (ADR-019)
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType((e.target as HTMLSelectElement).value as IssueType)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)',
                  background: 'var(--card)',
                  color: 'var(--tx)',
                  fontSize: '0.82rem'
                }}
              >
                <option value="offline">انقطاع إشارة GPS (Offline)</option>
                <option value="frozen_signal">إشارة متجمدة بنفس الإحداثيات</option>
                <option value="no_power">فصل مصدر الكهرباء</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                مدة الانقطاع المقدرة (بالدقائق)
              </label>
              <input
                type="number"
                min="5"
                max="1440"
                value={newMinutes}
                onInput={(e) => setNewMinutes(Number((e.target as HTMLInputElement).value) || 30)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)',
                  background: 'var(--card)',
                  color: 'var(--tx)',
                  fontSize: '0.82rem'
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                ملاحظات المشكلة
              </label>
              <input
                type="text"
                placeholder="تفاصيل المشكلة أو موقع آخر ظهور..."
                value={newNotes}
                onInput={(e) => setNewNotes((e.target as HTMLInputElement).value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)',
                  background: 'var(--card)',
                  color: 'var(--tx)',
                  fontSize: '0.82rem'
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button type="button" variant="outline" style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }} onClick={() => setShowCreateForm(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }}>
                فتح المشكلة الآن
              </Button>
            </div>
          </form>
        )}

        {/* Issues List Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'grid', gap: '12px' }}>
          {filteredIssues.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mute)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
              <b style={{ fontSize: '1rem', color: 'var(--tx)' }}>لا توجد مشاكل مطابقة</b>
              <p style={{ fontSize: '0.84rem', margin: '4px 0 0' }}>جميع أجهزة الـ GPS في هذه الفئة تعمل بشكل منتظم وسليم.</p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const statusMeta = getIssueStatusMeta(issue.status);
              const contactInfo = issuesService.getContactInfo(issue);
              const isExpanded = expandedHistoryId === issue.issueId;

              return (
                <div
                  key={issue.issueId}
                  style={{
                    background: 'var(--card)',
                    borderRadius: 'var(--r-md)',
                    border: `1px solid ${issue.status === 'open' ? 'var(--bad)' : issue.status === 'contacted' ? 'var(--warn)' : 'var(--line)'}`,
                    boxShadow: 'var(--sh-sm)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Issue Main Header */}
                  <div
                    style={{
                      padding: '12px 16px',
                      background: issue.status === 'open' ? 'rgba(198, 40, 40, 0.05)' : issue.status === 'contacted' ? 'rgba(239, 108, 0, 0.05)' : 'var(--subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          padding: '3px 8px',
                          borderRadius: 'var(--r-full)',
                          background: statusMeta.colorVar,
                          color: '#fff',
                          fontWeight: 700
                        }}
                      >
                        {statusMeta.label}
                      </span>
                      <b style={{ fontSize: '1rem', color: 'var(--ink)' }}>عربية {issue.vehicleId}</b>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          background: 'var(--soft)',
                          padding: '2px 8px',
                          borderRadius: 'var(--r-xs)',
                          color: 'var(--mute)'
                        }}
                      >
                        {getIssueTypeLabel(issue.type)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--mute)' }}>
                      <span>
                        ⏱️ رصدت:{' '}
                        {new Date(issue.detectedAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {issue.offlineMinutes && (
                        <span style={{ color: 'var(--bad)', fontWeight: 600 }}>
                          (مدة: {issue.offlineMinutes} دقيقة)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Issue Details & Notes */}
                  <div style={{ padding: '12px 16px', display: 'grid', gap: '10px' }}>
                    <div style={{ fontSize: '0.86rem', color: 'var(--tx)', lineHeight: 1.5 }}>
                      {issue.notes}
                    </div>

                    {/* Driver Information & Quick Action Row (ADR-011) */}
                    <div
                      style={{
                        background: 'var(--soft)',
                        padding: '10px 14px',
                        borderRadius: 'var(--r-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                        border: '1px solid var(--line)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>👤</span>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--ink)' }}>
                            السائق: {contactInfo.driverName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>
                            الهاتف: {contactInfo.driverPhone || 'غير مسجل'}
                          </div>
                        </div>
                      </div>

                      {/* Direct Call & WhatsApp Buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {contactInfo.driverPhone ? (
                          <>
                            <a
                              href={contactInfo.telUrl}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.78rem',
                                padding: '5px 12px',
                                borderRadius: 'var(--r-sm)',
                                border: '1px solid var(--line)',
                                background: 'var(--card)',
                                color: 'var(--tx)',
                                textDecoration: 'none',
                                fontWeight: 600
                              }}
                              title="اتصال هاتفي مباشر بالسائق (ADR-011)"
                            >
                              📞 اتصال هاتفي
                            </a>
                            <a
                              href={contactInfo.whatsAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.78rem',
                                padding: '5px 12px',
                                borderRadius: 'var(--r-sm)',
                                border: '1px solid #25D366',
                                background: 'rgba(37,211,102,0.12)',
                                color: '#128C7E',
                                textDecoration: 'none',
                                fontWeight: 700
                              }}
                              title="مراسلة السائق عبر واتساب (ADR-011)"
                            >
                              💬 رسالة واتساب
                            </a>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--mute)' }}>
                            لا يوجد رقم هاتف مسجل للسائق
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contacted / Resolved Info Banners */}
                    {issue.status === 'contacted' && issue.contactNotes && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          background: 'rgba(239, 108, 0, 0.08)',
                          border: '1px solid var(--warn)',
                          padding: '8px 12px',
                          borderRadius: 'var(--r-xs)',
                          color: 'var(--warn)'
                        }}
                      >
                        <b>ملاحظات التواصل ({issue.contactedBy || 'Super Admin'}):</b> {issue.contactNotes}
                      </div>
                    )}

                    {issue.status === 'resolved' && issue.resolutionNotes && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          background: 'rgba(46, 125, 50, 0.08)',
                          border: '1px solid var(--ok)',
                          padding: '8px 12px',
                          borderRadius: 'var(--r-xs)',
                          color: 'var(--ok)'
                        }}
                      >
                        <b>ملاحظات الحل ({issue.resolvedBy || 'Super Admin'}):</b> {issue.resolutionNotes}
                      </div>
                    )}

                    {/* Lifecycle Transitions Bar */}
                    <div
                      style={{
                        paddingTop: '8px',
                        borderTop: '1px solid var(--line)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(isExpanded ? null : issue.issueId)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          fontSize: '0.76rem',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        {isExpanded ? 'إخفاء سجل العمليات ▲' : `عرض سجل العمليات (${issue.history?.length || 1}) ▼`}
                      </button>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {issue.status === 'open' && (
                          <>
                            <Button
                              variant="outline"
                              style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }}
                              onClick={() => handleOpenActionDialog(issue, 'contact')}
                            >
                              📞 تسجيل التواصل
                            </Button>
                            <Button
                              variant="primary"
                              style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }}
                              onClick={() => handleOpenActionDialog(issue, 'resolve')}
                            >
                              ✅ حل المشكلة
                            </Button>
                          </>
                        )}

                        {issue.status === 'contacted' && (
                          <>
                            <Button
                              variant="primary"
                              style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }}
                              onClick={() => handleOpenActionDialog(issue, 'resolve')}
                            >
                              ✅ تسجيل حل المشكلة
                            </Button>
                            <Button
                              variant="outline"
                              style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }}
                              onClick={() => handleOpenActionDialog(issue, 'reopen')}
                            >
                              ↩️ رجوع للمفتوحة
                            </Button>
                          </>
                        )}

                        {issue.status === 'resolved' && (
                          <Button
                            variant="outline"
                            style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }}
                            onClick={() => handleOpenActionDialog(issue, 'reopen')}
                          >
                            🔄 إعادة فتح المشكلة
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expandable History Trail */}
                    {isExpanded && (
                      <div
                        style={{
                          background: 'var(--subtle)',
                          padding: '10px 14px',
                          borderRadius: 'var(--r-sm)',
                          fontSize: '0.76rem',
                          border: '1px solid var(--line)',
                          display: 'grid',
                          gap: '6px'
                        }}
                      >
                        <b style={{ color: 'var(--ink)' }}>سجل أحداث المشكلة (Audit Trail):</b>
                        {(issue.history || []).map((h, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--tx)' }}>
                            <span>
                              <b>{getIssueStatusMeta(h.status).label}</b> — بواسطة: {h.actor}
                              {h.notes && <span style={{ color: 'var(--mute)' }}> ({h.notes})</span>}
                            </span>
                            <span style={{ color: 'var(--mute)' }}>
                              {new Date(h.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Notes Dialog Modal */}
        {activeAction && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1100,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <div
              style={{
                background: 'var(--card)',
                width: '100%',
                maxWidth: '480px',
                borderRadius: 'var(--r-md)',
                padding: '20px',
                border: '1px solid var(--line)',
                boxShadow: 'var(--sh-lg)',
                display: 'grid',
                gap: '12px'
              }}
            >
              <h4 style={{ margin: 0, color: 'var(--ink)', fontSize: '1rem' }}>
                {activeAction.mode === 'contact' && `تسجيل التواصل مع السائق (عربية ${activeAction.issue.vehicleId})`}
                {activeAction.mode === 'resolve' && `تسجيل حل المشكلة نهائياً (عربية ${activeAction.issue.vehicleId})`}
                {activeAction.mode === 'reopen' && `إعادة فتح مشكلة الـ GPS (عربية ${activeAction.issue.vehicleId})`}
              </h4>

              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--mute)' }}>
                سيتم حفظ الملاحظات وتحديث حالة المشكلة وتسجيل العملية في سجل المراجعة (Audit Log).
              </p>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  ملاحظات الإجراء:
                </label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onInput={(e) => setActionNotes((e.target as HTMLTextAreaElement).value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--line)',
                    background: 'var(--soft)',
                    color: 'var(--tx)',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <Button variant="outline" style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }} onClick={() => setActiveAction(null)}>
                  إلغاء
                </Button>
                <Button variant="primary" style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.78rem' }} onClick={handleExecuteAction}>
                  تأكيد وحفظ
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
