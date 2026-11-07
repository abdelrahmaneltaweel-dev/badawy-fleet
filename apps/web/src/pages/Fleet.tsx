import { useState, useEffect } from 'preact/hooks';
import {
  type VehicleDocument,
  type DriverRecord,
  type SiteRecord,
  type AssignmentRecord,
  type VehicleType,
  type IssueDocument,
  parseVehiclesFromExcelPaste,
  type BulkImportParseResult
} from '@badawi/logic';
import { entitiesService } from '../services/entities';
import { authService } from '../services/auth';
import { issuesService } from '../services/issues';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { Table, StatusBadge } from '../components/Table';
import { GpsIssuesModal } from '../components/GpsIssuesModal';
import { VehicleDetailsModal } from '../components/VehicleDetailsModal';
import { showToast } from '../components/Toast';
import { traccarService } from '../services/traccar';

export default function Fleet() {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers' | 'sites' | 'assignments'>('vehicles');
  const [vehicles, setVehicles] = useState<VehicleDocument[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [issuesList, setIssuesList] = useState<IssueDocument[]>(() => issuesService.getIssues());

  // Filtering
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<VehicleDocument | null>(null);
  const [showIssuesModal, setShowIssuesModal] = useState(false);
  const [issueModalVehicleId, setIssueModalVehicleId] = useState<string | undefined>(undefined);
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState<string | null>(null);

  // Form states
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState<VehicleType>('tractor');
  const [newGpsId, setNewGpsId] = useState('');
  const [newSiteId, setNewSiteId] = useState('crusher-2');
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Bulk import state (ADR-047)
  const [bulkText, setBulkText] = useState('');
  const [parseResult, setParseResult] = useState<BulkImportParseResult | null>(null);
  const [isSyncingTraccar, setIsSyncingTraccar] = useState(false);

  const canManage = authService.can('users.manage');

  const refresh = () => {
    setVehicles(entitiesService.getVehicles());
    setDrivers(entitiesService.getDrivers());
    setSites(entitiesService.getSites());
    setAssignments(entitiesService.getAssignments());
    setIssuesList(issuesService.getIssues());
  };

  useEffect(() => {
    const unsubEntities = entitiesService.subscribe(refresh);
    const unsubIssues = issuesService.subscribe((list) => setIssuesList(list));
    return () => {
      unsubEntities();
      unsubIssues();
    };
  }, []);

  const handleSaveVehicle = (e: Event) => {
    e.preventDefault();
    if (!newVehicleId || !newPlate) {
      showToast('يرجى كتابة رقم العربية ورقم اللوحة');
      return;
    }

    entitiesService.saveVehicle({
      vehicleId: newVehicleId.trim(),
      name: `عربية ${newVehicleId.trim()}`,
      plateNumber: newPlate.trim(),
      type: newType,
      gpsDeviceId: newGpsId.trim() || null,
      siteId: newSiteId || null
    });

    showToast(`تم حفظ العربية ${newVehicleId} بنجاح`);
    setShowAddVehicleModal(false);
    setNewVehicleId('');
    setNewPlate('');
    setNewGpsId('');
  };

  const handleAssignDriver = (e: Event) => {
    e.preventDefault();
    if (!showAssignModal || !selectedDriverId) return;

    entitiesService.assignDriver(showAssignModal.vehicleId, selectedDriverId);
    showToast(`تم إسناد السائق للعربية ${showAssignModal.vehicleId}`);
    setShowAssignModal(null);
  };

  const handleParseBulk = (text: string) => {
    setBulkText(text);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    const result = parseVehiclesFromExcelPaste(text);
    setParseResult(result);
  };

  const handleExecuteBulkImport = () => {
    if (!parseResult || parseResult.validCount === 0) {
      showToast('لا توجد صفوف صالحة للاستيراد');
      return;
    }

    const count = entitiesService.importBulkCandidates(parseResult.candidates);
    showToast(`تم استيراد ${count} عربية بنجاح إلى الأسطول`);
    setShowBulkModal(false);
    setBulkText('');
    setParseResult(null);
  };

  const handleSampleBulk = () => {
    const sample = `
131\tعربية 131\tس ص ع 9871\tجرار\ttraccar-131\tcrusher-2
132\tعربية 132\tف ق ك 4512\tجرار\ttraccar-132\tcrusher-2
133\tعربية 133\tل م ن 3321\tنقل\ttraccar-133\tgarage-main
134\tعربية 134\tهـ و ي 6789\tملاكي\ttraccar-134\tsohag
    `.trim();
    handleParseBulk(sample);
  };

  // Filtered vehicles
  const filteredVehicles = vehicles.filter((v) => {
    if (typeFilter !== 'all' && v.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        v.vehicleId.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.plateNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ display: 'grid', gap: '16px' }} className="animate-fade-in">
      {/* Header */}
      <Card
        title="إدارة الأسطول والكيانات (Fleet & Entities)"
        subtitle={`إجمالي الأسطول: ${vehicles.length} عربية مسجلة · إسناد بتواريخ واستيراد جماعي (ADR-016, ADR-047)`}
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              loading={isSyncingTraccar}
              onClick={async () => {
                setIsSyncingTraccar(true);
                try {
                  const res = await traccarService.runLiveFleetSync();
                  if (res.success) {
                    await entitiesService.syncFromRepository();
                    refresh();
                  }
                } finally {
                  setIsSyncingTraccar(false);
                }
              }}
            >
              🔄 سحب Traccar الحي
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIssueModalVehicleId(undefined);
                setShowIssuesModal(true);
              }}
            >
              🛰️ مشاكل GPS ({issuesList.filter((i) => i.status === 'open' || i.status === 'contacted').length})
            </Button>
            {canManage && (
              <>
                <Button variant="secondary" onClick={() => setShowBulkModal(true)}>
                  📋 استيراد جماعي من Excel
                </Button>
                <Button variant="primary" onClick={() => setShowAddVehicleModal(true)}>
                  ➕ إضافة عربية جديدة
                </Button>
              </>
            )}
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>
          كل عربية لها معرّف ثابت لا يتغير، وتغيير السائق أو جهاز الـ GPS يتم بتواريخ سريان لحماية تاريخ حساب النقلات والمرتبات.
        </p>
      </Card>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          { id: 'vehicles' as const, label: '🚛 العربيات والأسطول', count: vehicles.length },
          { id: 'drivers' as const, label: '👤 السائقون المعتمدون', count: drivers.length },
          { id: 'sites' as const, label: '📍 المواقع والكسارات', count: sites.length },
          { id: 'assignments' as const, label: '🔗 سجل الإسناد والتكليف', count: assignments.length }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 14px', fontSize: '0.86rem' }}
          >
            <span>{t.label}</span>
            <span style={{ fontSize: '0.74rem', background: 'var(--soft)', padding: '1px 6px', borderRadius: 'var(--r-full)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: Vehicles */}
      {activeTab === 'vehicles' && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'all', label: 'الكل' },
                { id: 'tractor', label: 'جرارات' },
                { id: 'truck', label: 'نقل' },
                { id: 'private', label: 'ملاكي' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip ${typeFilter === f.id ? 'active' : ''}`}
                  onClick={() => setTypeFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: '180px' }}>
              <Field
                placeholder="ابحث برقم العربية أو اللوحة..."
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.currentTarget as HTMLInputElement).value)}
              />
            </div>
          </div>

          {/* Table */}
          <Table>
            <thead>
              <tr>
                <th className="col-sticky">العربية</th>
                <th>رقم اللوحة</th>
                <th>النوع</th>
                <th>السائق المسند</th>
                <th>الموقع الحالي</th>
                <th>جهاز GPS</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((v) => {
                const activeAsg = entitiesService.getActiveAssignment(v.vehicleId);
                const assignedDriver = activeAsg ? drivers.find((d) => d.driverId === activeAsg.driverId) : null;
                const currentSite = sites.find((s) => s.siteId === v.siteId);

                return (
                  <tr key={v.vehicleId}>
                    <td className="col-sticky">
                      <button
                        type="button"
                        onClick={() => setSelectedVehicleForDetails(v.vehicleId)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          textAlign: 'right',
                          cursor: 'pointer',
                          display: 'block'
                        }}
                        title="انقر لفتح شاشة تفاصيل العربية والحالة اللحظية (T6.3)"
                      >
                        <b style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                          {v.name}
                        </b>
                        <div style={{ fontSize: '0.74rem', color: 'var(--mute)' }}>#{v.vehicleId} 🔍</div>
                      </button>
                    </td>
                    <td style={{ fontWeight: 600 }}>{v.plateNumber}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', background: 'var(--soft)', padding: '2px 8px', borderRadius: 'var(--r-xs)' }}>
                        {v.type === 'tractor' ? 'جرار' : v.type === 'truck' ? 'نقل' : 'ملاكي'}
                      </span>
                    </td>
                    <td>
                      {assignedDriver ? (
                        <div>
                          <b style={{ fontSize: '0.84rem' }}>{assignedDriver.name}</b>
                          <div style={{ fontSize: '0.74rem', color: 'var(--mute)' }}>{assignedDriver.phone}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--mute)', fontSize: '0.8rem' }}>— غير مسند —</span>
                      )}
                    </td>
                    <td>{currentSite ? currentSite.name : '—'}</td>
                    <td style={{ direction: 'ltr', textAlign: 'right', fontSize: '0.8rem', color: 'var(--mute)' }}>
                      {v.gpsDeviceId || '—'}
                    </td>
                    <td>
                      {(() => {
                        const activeIssue = issuesList.find(
                          (i) => i.vehicleId === v.vehicleId && (i.status === 'open' || i.status === 'contacted')
                        );
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <StatusBadge status={v.status} />
                            {activeIssue && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIssueModalVehicleId(v.vehicleId);
                                  setShowIssuesModal(true);
                                }}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--r-xs)',
                                  background: activeIssue.status === 'open' ? 'rgba(198, 40, 40, 0.12)' : 'rgba(239, 108, 0, 0.12)',
                                  color: activeIssue.status === 'open' ? 'var(--bad)' : 'var(--warn)',
                                  border: `1px solid ${activeIssue.status === 'open' ? 'var(--bad)' : 'var(--warn)'}`,
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                                title={`انقر لمتابعة مشكلة GPS (${activeIssue.status === 'open' ? 'مفتوحة' : 'تم التواصل'})`}
                              >
                                ⚠️ {activeIssue.status === 'open' ? 'مشكلة GPS' : 'تم التواصل'}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <Button
                          variant="outline"
                          style={{ minHeight: '28px', padding: '2px 8px', fontSize: '0.76rem' }}
                          onClick={() => setSelectedVehicleForDetails(v.vehicleId)}
                        >
                          🔍 تفاصيل
                        </Button>
                        {canManage && (
                          <Button
                            variant="secondary"
                            style={{ minHeight: '28px', padding: '2px 8px', fontSize: '0.76rem' }}
                            onClick={() => {
                              setSelectedDriverId(assignedDriver?.driverId || '');
                              setShowAssignModal(v);
                            }}
                          >
                            إسناد سائق
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {/* Tab 2: Drivers */}
      {activeTab === 'drivers' && (
        <Table>
          <thead>
            <tr>
              <th className="col-sticky">اسم السائق</th>
              <th>رقم الهاتف</th>
              <th>الواتساب</th>
              <th>العربية المسندة حالياً</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const activeAsg = assignments.find((a) => a.driverId === d.driverId && a.endDate === null);
              const assignedVeh = activeAsg ? vehicles.find((v) => v.vehicleId === activeAsg.vehicleId) : null;

              return (
                <tr key={d.driverId}>
                  <td className="col-sticky">
                    <b>{d.name}</b>
                  </td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{d.phone}</td>
                  <td>
                    {d.whatsapp ? (
                      <a
                        href={`https://wa.me/2${d.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--ok)', fontWeight: 600, textDecoration: 'none' }}
                      >
                        💬 واتساب
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {assignedVeh ? (
                      <button
                        type="button"
                        onClick={() => setSelectedVehicleForDetails(assignedVeh.vehicleId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--accent)',
                          fontWeight: 700,
                          textAlign: 'right',
                          textDecoration: 'underline'
                        }}
                        title="انقر لفتح تفاصيل العربية"
                      >
                        {assignedVeh.name} ({assignedVeh.plateNumber}) 🔍
                      </button>
                    ) : (
                      <span style={{ color: 'var(--mute)' }}>لا يوجد</span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: d.active ? 'var(--ok)' : 'var(--bad)', fontWeight: 700, fontSize: '0.8rem' }}>
                      {d.active ? '● نشط' : '○ معطل'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Tab 3: Sites */}
      {activeTab === 'sites' && (
        <Table>
          <thead>
            <tr>
              <th className="col-sticky">اسم الموقع</th>
              <th>النوع</th>
              <th>نصف قطر النطاق (متر)</th>
              <th>الإحداثيات التقريبية</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.siteId}>
                <td className="col-sticky">
                  <b>{s.name}</b>
                </td>
                <td>
                  <span style={{ background: 'var(--soft)', padding: '2px 8px', borderRadius: 'var(--r-xs)', fontSize: '0.8rem' }}>
                    {s.type === 'crusher' ? 'كسارة' : s.type === 'mixer' ? 'خلاطة' : s.type === 'garage' ? 'جراج' : 'تفريغ'}
                  </span>
                </td>
                <td>{s.radiusMeters} م</td>
                <td style={{ direction: 'ltr', textAlign: 'right', color: 'var(--mute)', fontSize: '0.8rem' }}>
                  {s.latitude}, {s.longitude}
                </td>
                <td>
                  <span style={{ color: s.active ? 'var(--ok)' : 'var(--bad)', fontWeight: 700, fontSize: '0.8rem' }}>
                    {s.active ? '● نشط' : '○ معطل'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Tab 4: Assignment History */}
      {activeTab === 'assignments' && (
        <Table>
          <thead>
            <tr>
              <th className="col-sticky">العربية</th>
              <th>السائق</th>
              <th>تاريخ البداية</th>
              <th>تاريخ النهاية</th>
              <th>حالة التكليف</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const veh = vehicles.find((v) => v.vehicleId === a.vehicleId);
              const drv = drivers.find((d) => d.driverId === a.driverId);
              const isActive = a.endDate === null;

              return (
                <tr key={a.assignmentId}>
                  <td className="col-sticky">
                    <button
                      type="button"
                      onClick={() => setSelectedVehicleForDetails(a.vehicleId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--accent)',
                        fontWeight: 700,
                        textAlign: 'right',
                        textDecoration: 'underline'
                      }}
                      title="انقر لفتح تفاصيل العربية"
                    >
                      {veh?.name || `عربية ${a.vehicleId}`} 🔍
                    </button>
                  </td>
                  <td>{drv?.name || a.driverId}</td>
                  <td>{a.startDate}</td>
                  <td>{a.endDate || '— مستمر حتى الآن —'}</td>
                  <td>
                    <span style={{ color: isActive ? 'var(--ok)' : 'var(--mute)', fontWeight: 700, fontSize: '0.8rem' }}>
                      {isActive ? '● نشط حالياً' : 'مؤرشف'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Modal: Bulk Excel Import (ADR-047) */}
      {showBulkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto' }}>
            <Card
              title="استيراد جماعي للعربيات (لصق جدول Excel)"
              subtitle="انسخ جدولك من Excel والصقه هنا مباشرة مع مراجعة حية للأخطاء قبل الحفظ (ADR-047)"
            >
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: 'var(--mute)' }}>
                    الأعمدة المطلوبة: رقم العربية | اسم العربية | اللوحة | النوع (جرار/نقل/ملاكي) | GPS | الموقع
                  </small>
                  <Button variant="outline" onClick={handleSampleBulk} style={{ minHeight: '30px', fontSize: '0.78rem' }}>
                    ⚡ تجربة بنموذج جاهز
                  </Button>
                </div>

                <textarea
                  rows={6}
                  placeholder="الصق خلايا جدول Excel هنا (Ctrl+V)..."
                  value={bulkText}
                  onInput={(e) => handleParseBulk((e.currentTarget as HTMLTextAreaElement).value)}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '0.84rem',
                    padding: '10px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--line)',
                    background: 'var(--soft)',
                    color: 'var(--ink)'
                  }}
                />

                {/* Parse Results Preview */}
                {parseResult && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <b>جدول المراجعة قبل الحفظ:</b>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--ok)', fontWeight: 700 }}>
                          ✓ {parseResult.validCount} صف صالح
                        </span>
                        {parseResult.invalidCount > 0 && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--bad)', fontWeight: 700 }}>
                            ✕ {parseResult.invalidCount} يحتاج تصحيح
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      <Table>
                        <thead>
                          <tr>
                            <th>رقم العربية</th>
                            <th>الاسم</th>
                            <th>اللوحة</th>
                            <th>النوع</th>
                            <th>جهاز GPS</th>
                            <th>الحالة والتحقق</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseResult.candidates.map((c, i) => (
                            <tr key={i} style={{ background: c.valid ? 'transparent' : 'var(--bad-soft)' }}>
                              <td><b>{c.vehicleId || '—'}</b></td>
                              <td>{c.name}</td>
                              <td>{c.plateNumber || '—'}</td>
                              <td>{c.type}</td>
                              <td>{c.gpsDeviceId || '—'}</td>
                              <td>
                                {c.valid ? (
                                  <span style={{ color: 'var(--ok)', fontWeight: 700, fontSize: '0.8rem' }}>✓ جاهز</span>
                                ) : (
                                  <span style={{ color: 'var(--bad)', fontSize: '0.76rem', fontWeight: 600 }}>
                                    {c.errors.join(' · ')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <Button variant="ghost" onClick={() => setShowBulkModal(false)}>
                    إلغاء
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!parseResult || parseResult.validCount === 0}
                    onClick={handleExecuteBulkImport}
                  >
                    تأكيد واستيراد {parseResult?.validCount || 0} عربية
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modal: Add Single Vehicle */}
      {showAddVehicleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '440px' }}>
            <Card title="إضافة عربية جديدة للأسطول">
              <form onSubmit={handleSaveVehicle} style={{ display: 'grid', gap: '12px' }}>
                <Field
                  label="رقم العربية الداخلي (معرف ثابت)"
                  placeholder="مثال: 135"
                  value={newVehicleId}
                  onInput={(e) => setNewVehicleId((e.currentTarget as HTMLInputElement).value)}
                  required
                />

                <Field
                  label="رقم اللوحة المرورية"
                  placeholder="مثال: أ ب ج 1234"
                  value={newPlate}
                  onInput={(e) => setNewPlate((e.currentTarget as HTMLInputElement).value)}
                  required
                />

                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>نوع العربية</div>
                  <Select
                    value={newType}
                    onChange={(val) => setNewType(val as VehicleType)}
                    options={[
                      { value: 'tractor', label: 'جرار (نقلات كاملة)' },
                      { value: 'truck', label: 'نقل (مشاوير وزيارات)' },
                      { value: 'private', label: 'ملاكي (مشاوير إدارية)' }
                    ]}
                  />
                </div>

                <Field
                  label="معرف جهاز GPS في Traccar"
                  placeholder="مثال: 107"
                  value={newGpsId}
                  onInput={(e) => setNewGpsId((e.currentTarget as HTMLInputElement).value)}
                />

                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>الموقع المخصص</div>
                  <Select
                    value={newSiteId}
                    onChange={setNewSiteId}
                    options={sites.map((s) => ({ value: s.siteId, label: s.name }))}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <Button variant="ghost" type="button" onClick={() => setShowAddVehicleModal(false)}>
                    إلغاء
                  </Button>
                  <Button variant="primary" type="submit">
                    حفظ العربية
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* Modal: Assign Driver (ADR-016) */}
      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '420px' }}>
            <Card
              title={`إسناد سائق للعربية ${showAssignModal.name}`}
              subtitle="يسري التكليف من تاريخ اليوم ويُغلق التكليف السابق تلقائياً دون المساس بالماضي (ADR-016)"
            >
              <form onSubmit={handleAssignDriver} style={{ display: 'grid', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>اختر السائق</div>
                  <Select
                    value={selectedDriverId}
                    onChange={setSelectedDriverId}
                    options={drivers.map((d) => ({ value: d.driverId, label: `${d.name} (${d.phone})` }))}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <Button variant="ghost" type="button" onClick={() => setShowAssignModal(null)}>
                    إلغاء
                  </Button>
                  <Button variant="primary" type="submit">
                    تأكيد الإسناد
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
      {/* GPS Issues Management Modal (ADR-019 & ADR-011) */}
      <GpsIssuesModal
        isOpen={showIssuesModal}
        onClose={() => {
          setShowIssuesModal(false);
          setIssueModalVehicleId(undefined);
        }}
        initialVehicleId={issueModalVehicleId}
      />

      {/* Vehicle Details & Telemetry Inspection Modal (T6.3, ADR-016, ADR-019, ADR-018) */}
      <VehicleDetailsModal
        isOpen={!!selectedVehicleForDetails}
        vehicleId={selectedVehicleForDetails}
        onClose={() => setSelectedVehicleForDetails(null)}
        onVehicleUpdated={refresh}
      />
    </div>
  );
}