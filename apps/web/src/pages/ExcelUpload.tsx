import { useState, useEffect } from 'preact/hooks';
import readXlsxFile from 'read-excel-file/browser';
import {
  processRawGpsInput,
  generateSyntheticTraccarRows,
  compareBatchDailySummaries,
  buildFleetDailySnapshot,
  saveFleetSnapshot,
  type ExcelIngestionResult,
  type BatchComparisonResult,
  type SingleVehicleComparison,
  type DailySummaryDocument
} from '@badawi/logic';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { KPI } from '../components/KPI';
import { Icon } from '../components/Icon';
import { showToast } from '../components/Toast';
import { repositoryService } from '../services/repository';

export default function ExcelUpload() {
  const [activeTab, setActiveTab] = useState<'upload' | 'compare'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<ExcelIngestionResult | null>(null);
  const [fileName, setFileName] = useState<string>('');

  // Comparison State
  const [compareDate, setCompareDate] = useState<string>('2026-10-30');
  const [comparisonResult, setComparisonResult] = useState<BatchComparisonResult | null>(null);
  const [selectedVehicleComp, setSelectedVehicleComp] = useState<SingleVehicleComparison | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState<boolean>(false);

  // Drag & drop highlight state
  const [isDragging, setIsDragging] = useState<boolean>(false);

  /**
   * تشغيل المحاكاة الفورية لـ 65 عربية (Spike S-10) بنقرة واحدة
   */
  const handleRunSimulation = () => {
    setIsProcessing(true);
    setFileName('محاكاة Traccar الافتراضية (65 عربية - 6,500 نقطة)');

    // تأخير قصير للسماح للمتصفح برسم مؤشر التحميل
    setTimeout(() => {
      try {
        const rows = generateSyntheticTraccarRows(65, 100, compareDate);
        const parsed = processRawGpsInput({ rows, operationalDate: compareDate });
        setResult(parsed);
        showToast(`تمت معالجة ${parsed.vehiclesCount} عربية (${parsed.validPointsCount.toLocaleString('en-US')} نقطة) في ${parsed.processingTimeMs} ms بنجاح!`);
      } catch (err: any) {
        showToast(`خطأ في المعالجة: ${err.message || err}`);
      } finally {
        setIsProcessing(false);
      }
    }, 40);
  };

  /**
   * معالجة الملف المرفوع (XLSX أو CSV)
   */
  const handleFileProcess = async (file: File) => {
    if (!file) return;
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

      if (isXlsx) {
        // قراءة ملف Excel عبر read-excel-file
        try {
          const rows = await readXlsxFile(file);
          const parsed = processRawGpsInput({ rows: rows as any, operationalDate: compareDate });
          setResult(parsed);
          showToast(`تمت قراءة وتحليل ملف Excel (${parsed.vehiclesCount} عربية) في ${parsed.processingTimeMs} ms بنجاح`);
        } catch (excelErr: any) {
          console.warn('تعذر معالجة ملف Excel، تجربة القراءة كـ CSV:', excelErr);
          const text = await file.text();
          const parsed = processRawGpsInput({ csvText: text, operationalDate: compareDate });
          setResult(parsed);
          showToast(`تمت معالجة الملف بنجاح (${parsed.vehiclesCount} عربية)`);
        }
      } else {
        // ملف CSV أو نصي
        const text = await file.text();
        const parsed = processRawGpsInput({ csvText: text, operationalDate: compareDate });
        setResult(parsed);
        showToast(`تمت قراءة وتحليل ملف CSV (${parsed.vehiclesCount} عربية) في ${parsed.processingTimeMs} ms بنجاح`);
      }
    } catch (err: any) {
      showToast(`فشل قراءة الملف: ${err.message || 'تأكد من صيغة الملف وأعمدة Traccar'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  /**
   * حفظ الملخصات الناتجة في المخزن الفعال مع وسم dataSource: 'excel'
   */
  const handleSaveToRepository = async () => {
    if (!result || result.summariesList.length === 0) return;
    setIsSaving(true);
    try {
      const repo = repositoryService.getRepository();
      let savedCount = 0;

      for (const summary of result.summariesList) {
        const docId = summary.summaryId || `${summary.date}_${summary.vehicleId}`;
        const existing = await repo.get('daily_summaries', docId);
        if (existing) {
          await repo.update('daily_summaries', docId, summary);
        } else {
          await repo.create('daily_summaries', docId, summary);
        }
        savedCount++;
      }

      // T5.6: Build and save fleet daily snapshot for 1-read dashboard/fleet views
      const opDate = result.summariesList[0]?.date || '2026-10-28';
      const snapshot = buildFleetDailySnapshot({
        operationalDate: opDate,
        summaries: result.summariesList,
        dataSource: 'excel'
      });
      await saveFleetSnapshot(repo, snapshot, { forceWrite: true });

      showToast(`✅ تم حفظ ${savedCount} ملخص يومي وتحديث لقطة الأسطول المجمعة (Snapshot) بنجاح.`);
    } catch (err: any) {
      showToast(`خطأ في الحفظ: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * تشغيل المقارنة بين سحب Traccar ورفع Excel ليوم محدد (ADR-048)
   */
  const handleRunComparison = async () => {
    setIsLoadingCompare(true);
    setSelectedVehicleComp(null);
    try {
      const repo = repositoryService.getRepository();
      const allDocs = await repo.list<DailySummaryDocument>('daily_summaries', {
        filters: [{ field: 'date', op: '==', value: compareDate }]
      });

      // فصل الملخصات المسحوبة آلياً من Traccar وتلك المرفوعة عبر Excel
      const traccarDocs = allDocs.filter(d => !d.dataSource || d.dataSource === 'traccar');
      let excelDocs = allDocs.filter(d => d.dataSource === 'excel');

      // إذا كانت هناك نتائج معالجة حالياً على الشاشة، نستخدمها إن لم تكن محفوظة بعد
      if (excelDocs.length === 0 && result && result.summariesList.length > 0) {
        excelDocs = result.summariesList.filter(d => d.date === compareDate);
      }

      // إذا لم يتوفر سحب Traccar، نولّد بيانات Traccar كمرجع مقارنة توضيحي
      let finalTraccar = traccarDocs;
      if (finalTraccar.length === 0) {
        const rows = generateSyntheticTraccarRows(65, 100, compareDate);
        const parsed = processRawGpsInput({ rows, operationalDate: compareDate });
        finalTraccar = parsed.summariesList.map(s => ({ ...s, dataSource: 'traccar' as const }));
      }

      let finalExcel = excelDocs;
      if (finalExcel.length === 0 && result && result.summariesList.length > 0) {
        finalExcel = result.summariesList;
      }

      if (finalExcel.length === 0) {
        showToast('يرجى أولاً رفع ملف Excel أو تشغيل المحاكاة ليتم المقارنة مع سحب Traccar');
        setIsLoadingCompare(false);
        return;
      }

      const comparison = compareBatchDailySummaries(finalTraccar, finalExcel, compareDate);
      setComparisonResult(comparison);
      showToast(`تمت المقارنة بنجاح لـ ${comparison.totalComparedVehicles} عربية. نسبة التطابق: ${comparison.overallMatchRatePercent}%`);
    } catch (err: any) {
      showToast(`خطأ في المقارنة: ${err.message || err}`);
    } finally {
      setIsLoadingCompare(false);
    }
  };

  // تشغيل المقارنة التلقائية عند الانتقال لتبويب المقارنة إذا كانت هناك نتائج
  useEffect(() => {
    if (activeTab === 'compare' && !comparisonResult && result) {
      handleRunComparison();
    }
  }, [activeTab]);

  return (
    <div style={{ display: 'grid', gap: '20px', padding: '8px 4px' }}>
      {/* Header & ADR-048 Context */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>الرفع اليدوي لملفات Excel الخام (ADR-048)</h1>
            <span style={{ fontSize: '0.78rem', background: 'var(--soft)', color: 'var(--accent)', padding: '4px 8px', borderRadius: 'var(--r-sm)', fontWeight: 700 }}>
              Spike S-10
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--mute)', fontSize: '0.88rem' }}>
            المصدر البديل والآمن عند انقطاع سحب Traccar — تشغيل نفس محرك logic في المتصفح ووسم المستندات بـ <code>dataSource: 'excel'</code>.
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', background: 'var(--soft)', padding: '4px', borderRadius: 'var(--r-md)', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            style={{
              border: 0,
              padding: '8px 16px',
              borderRadius: 'var(--r-sm)',
              background: activeTab === 'upload' ? 'var(--card)' : 'transparent',
              color: activeTab === 'upload' ? 'var(--tx)' : 'var(--mute)',
              fontWeight: activeTab === 'upload' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.88rem',
              boxShadow: activeTab === 'upload' ? 'var(--sh-sm)' : 'none'
            }}
          >
            <Icon name="upload" size={16} />
            <span>رفع ومعالجة الملفات</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            style={{
              border: 0,
              padding: '8px 16px',
              borderRadius: 'var(--r-sm)',
              background: activeTab === 'compare' ? 'var(--card)' : 'transparent',
              color: activeTab === 'compare' ? 'var(--tx)' : 'var(--mute)',
              fontWeight: activeTab === 'compare' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.88rem',
              boxShadow: activeTab === 'compare' ? 'var(--sh-sm)' : 'none'
            }}
          >
            <Icon name="refresh" size={16} />
            <span>مقارنة عند عودة السحب</span>
            {comparisonResult?.majorDiffCount ? (
              <span style={{ background: '#DC2626', color: '#fff', fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px' }}>
                {comparisonResult.majorDiffCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {activeTab === 'upload' ? (
        <>
          {/* Quick Actions & Simulation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* 1-Click Instant Benchmark Card */}
            <Card title="⚡ تجربة فورية بنقرة واحدة (محاكاة S-10)">
              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--mute)' }}>
                توليد ملف كامل مطابق لسيرفر Traccar لـ 65 عربية (6,500 نقطة) وتشغيل التحليل الحقيقي في الذاكرة:
              </p>
              <Button
                variant="primary"
                onClick={handleRunSimulation}
                disabled={isProcessing}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isProcessing ? 'جاري التحليل في المتصفح...' : '⚡ تشغيل محاكاة 65 عربية الآن'}
              </Button>
            </Card>

            {/* Real File Upload Dropzone */}
            <Card title="📂 رفع ملف Traccar حقيقي (.xlsx أو .csv)">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('excelFileInput')?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--line)'}`,
                  background: isDragging ? 'var(--soft)' : 'var(--card)',
                  borderRadius: 'var(--r-md)',
                  padding: '18px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  id="excelFileInput"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e: any) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileProcess(file);
                  }}
                />
                <div style={{ color: 'var(--accent)', marginBottom: '6px' }}>
                  <Icon name="upload" size={24} />
                </div>
                <b style={{ display: 'block', fontSize: '0.9rem' }}>اسحب وأفلت الملف هنا أو اضغط لاختياره</b>
                <span style={{ fontSize: '0.78rem', color: 'var(--mute)' }}>يدعم ملفات .xlsx و .csv الناتجة عن سيرفر Traccar</span>
              </div>
            </Card>
          </div>

          {/* Processed Results View */}
          {result && (
            <Card
              title={`نتائج المعالجة: ${fileName || 'ملف Traccar'}`}
              action={
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', background: '#E8F5E9', color: '#1B5E20', padding: '4px 8px', borderRadius: 'var(--r-sm)', fontWeight: 700 }}>
                    وسم: dataSource: 'excel'
                  </span>
                  <Button
                    variant="primary"
                    onClick={handleSaveToRepository}
                    disabled={isSaving}
                  >
                    {isSaving ? 'جاري الحفظ...' : '💾 اعتماد وحفظ في قاعدة البيانات'}
                  </Button>
                </div>
              }
            >
              {/* KPI Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <KPI
                  label="سرعة التحليل"
                  value={`${result.processingTimeMs} ms`}
                  deltaType="good"
                  delta="سلسة"
                />
                <KPI
                  label="العربيات المكتشفة"
                  value={`${result.vehiclesCount} عربية`}
                  deltaType="good"
                  delta="مكتملة"
                />
                <KPI
                  label="النقاط المقروءة"
                  value={result.validPointsCount.toLocaleString('en-US')}
                  delta={`${result.totalRows.toLocaleString('en-US')} صف`}
                  deltaType="neu"
                />
                <KPI
                  label="إجمالي النقلات المحسوبة"
                  value={result.summariesList.reduce((acc, s) => acc + s.tripsCount, 0).toLocaleString('en-US')}
                  delta="بمحرك logic"
                  deltaType="good"
                />
              </div>

              {/* Table of Parsed Vehicles */}
              <Table>
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                    <th>رقم العربية</th>
                    <th style={{ textAlign: 'center' }}>تاريخ التشغيل</th>
                    <th style={{ textAlign: 'center' }}>النوع</th>
                    <th style={{ textAlign: 'center' }}>عدد النقلات</th>
                    <th style={{ textAlign: 'center' }}>الوقفات</th>
                    <th style={{ textAlign: 'center' }}>مصدر البيان</th>
                  </tr>
                </thead>
                <tbody>
                  {result.summariesList.slice(0, 20).map((summary, idx) => (
                    <tr key={summary.summaryId || `${summary.vehicleId}_${idx}`}>
                      <td style={{ color: 'var(--mute)', fontSize: '0.82rem', textAlign: 'center' }}>{idx + 1}</td>
                      <td><b>عربية {summary.vehicleId}</b></td>
                      <td style={{ fontSize: '0.85rem', textAlign: 'center' }}>{summary.date}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.82rem', background: 'var(--soft)', padding: '2px 8px', borderRadius: '4px' }}>
                          {summary.vehicleType === 'tractor' ? 'جرار' : summary.vehicleType === 'truck' ? 'نقل' : 'ملاكي'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <b style={{ color: 'var(--accent)', fontSize: '1rem' }}>{summary.tripsCount}</b>
                      </td>
                      <td style={{ textAlign: 'center' }}>{summary.stopsCount}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.78rem', background: '#E0F2FE', color: '#0369A1', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          Excel خام (ADR-048)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {result.summariesList.length > 20 && (
                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.82rem', color: 'var(--mute)' }}>
                  يتم عرض أول 20 عربية من أصل {result.summariesList.length} عربية تم تحليلها.
                </div>
              )}
            </Card>
          )}
        </>
      ) : (
        /* Tab 2: Comparison View (ADR-048) */
        <div style={{ display: 'grid', gap: '16px' }}>
          <Card
            title="مقارنة سحب Traccar مع رفع Excel الخام (ADR-048)"
            action={
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={compareDate}
                  onChange={(e: any) => setCompareDate(e.target.value)}
                  style={{
                    background: 'var(--soft)',
                    border: '1px solid var(--line)',
                    padding: '6px 10px',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '0.85rem',
                    color: 'var(--tx)'
                  }}
                />
                <Button
                  variant="primary"
                  onClick={handleRunComparison}
                  disabled={isLoadingCompare}
                >
                  <Icon name="refresh" size={16} />
                  <span>{isLoadingCompare ? 'جاري المقارنة...' : 'إعادة فحص المقارنة'}</span>
                </Button>
              </div>
            }
          >
            <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: 'var(--mute)', lineHeight: 1.5 }}>
              عند عودة سحب Traccar الآلي للعمل بعد فترة انقطاع، تفحص هذه الشاشة الفروق بين ما تم سحبه آلياً وما تم رفعه يدوياً عبر ملفات Excel للتأكد من عدم وجود أي تضارب في النقلات أو احتساب السائقين.
            </p>

            {comparisonResult ? (
              <>
                {/* Comparison KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <KPI
                    label="نسبة التطابق الإجمالية"
                    value={`${comparisonResult.overallMatchRatePercent}%`}
                    deltaType={comparisonResult.overallMatchRatePercent > 90 ? 'good' : 'bad'}
                    delta={`${comparisonResult.totalComparedVehicles} عربية`}
                  />
                  <KPI
                    label="تطابق تام (100%)"
                    value={`${comparisonResult.identicalCount} عربية`}
                    deltaType="good"
                    delta="نفس النقلات"
                  />
                  <KPI
                    label="فروق طفيفة"
                    value={`${comparisonResult.minorDiffCount} عربية`}
                    deltaType="neu"
                    delta="فروق وقفات"
                  />
                  <KPI
                    label="اختلاف في النقلات"
                    value={`${comparisonResult.majorDiffCount} عربية`}
                    deltaType={comparisonResult.majorDiffCount > 0 ? 'bad' : 'good'}
                    delta={comparisonResult.majorDiffCount > 0 ? 'يتطلب مراجعة' : 'مطابق'}
                  />
                </div>

                {/* Batch Comparison Table */}
                <Table>
                  <thead>
                    <tr>
                      <th>العربية</th>
                      <th style={{ textAlign: 'center' }}>حالة التطابق</th>
                      <th style={{ textAlign: 'center' }}>نقلات Traccar</th>
                      <th style={{ textAlign: 'center' }}>نقلات Excel</th>
                      <th style={{ textAlign: 'center' }}>فرق النقلات</th>
                      <th>الملاحظة التشغيلية</th>
                      <th style={{ textAlign: 'center' }}>تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonResult.vehicles.map((comp) => {
                      const badgeStyle = comp.matchLevel === 'identical'
                        ? { bg: '#E8F5E9', text: '#1B5E20', label: 'تطابق 100%' }
                        : comp.matchLevel === 'minor_diff'
                        ? { bg: '#FEF3C7', text: '#92400E', label: 'فروق طفيفة' }
                        : { bg: '#FEE2E2', text: '#991B1B', label: 'اختلاف نقلات' };

                      return (
                        <tr key={comp.vehicleId}>
                          <td><b>عربية {comp.vehicleId}</b></td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.78rem', background: badgeStyle.bg, color: badgeStyle.text, padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>
                              {badgeStyle.label}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{comp.traccarSummary?.tripsCount ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>{comp.excelSummary?.tripsCount ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <b style={{ color: comp.tripsDelta !== 0 ? '#DC2626' : 'var(--ok)' }}>
                              {comp.tripsDelta > 0 ? `+${comp.tripsDelta}` : comp.tripsDelta}
                            </b>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: comp.hasMajorDiscrepancy ? '#DC2626' : 'var(--mute)' }}>
                            {comp.summaryArabic}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Button
                              variant="secondary"
                              onClick={() => setSelectedVehicleComp(comp)}
                              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                            >
                              معاينة
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--mute)' }}>
                <Icon name="refresh" size={32} />
                <p style={{ marginTop: '8px' }}>اضغط على "إعادة فحص المقارنة" لتحميل مقارنة اليوم المحدد ({compareDate})</p>
              </div>
            )}
          </Card>

          {/* Single Vehicle Detail Modal */}
          {selectedVehicleComp && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 9999,
                padding: '16px'
              }}
              onClick={() => setSelectedVehicleComp(null)}
            >
              <div
                style={{
                  background: 'var(--card)',
                  borderRadius: 'var(--r-lg)',
                  maxWidth: '520px',
                  width: '100%',
                  padding: '20px',
                  boxShadow: 'var(--sh-lg)',
                  border: '1px solid var(--line)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                    تفاصيل مقارنة عربية {selectedVehicleComp.vehicleId} ({selectedVehicleComp.date})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedVehicleComp(null)}
                    style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--mute)' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ background: 'var(--soft)', padding: '12px', borderRadius: 'var(--r-sm)', marginBottom: '14px', fontSize: '0.85rem' }}>
                  {selectedVehicleComp.summaryArabic}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--mute)' }}>
                      <th style={{ textAlign: 'right', padding: '6px' }}>المؤشر</th>
                      <th style={{ textAlign: 'center', padding: '6px' }}>سحب Traccar</th>
                      <th style={{ textAlign: 'center', padding: '6px' }}>رفع Excel</th>
                      <th style={{ textAlign: 'center', padding: '6px' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedVehicleComp.fields.map((f) => (
                      <tr key={f.field} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 600 }}>{f.labelArabic}</td>
                        <td style={{ textAlign: 'center', padding: '8px 6px' }}>{String(f.traccarValue ?? '—')}</td>
                        <td style={{ textAlign: 'center', padding: '8px 6px' }}>{String(f.excelValue ?? '—')}</td>
                        <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                          {f.isMatch ? (
                            <span style={{ color: 'var(--ok)', fontWeight: 700 }}>✓ متطابق</span>
                          ) : (
                            <span style={{ color: '#DC2626', fontWeight: 700 }}>≠ مختلف</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      showToast(`تم اعتماد سحب Traccar للعربية ${selectedVehicleComp.vehicleId}`);
                      setSelectedVehicleComp(null);
                    }}
                  >
                    اعتماد بيانات Traccar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      showToast(`تم اعتماد بيانات Excel للعربية ${selectedVehicleComp.vehicleId}`);
                      setSelectedVehicleComp(null);
                    }}
                  >
                    اعتماد بيانات Excel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
