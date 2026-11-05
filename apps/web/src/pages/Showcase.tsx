import { useState } from 'preact/hooks';
import {
  Button,
  Chip,
  Field,
  Switch,
  Card,
  KPI,
  DonutChart,
  BarChart,
  RingProgress,
  Select,
  Table,
  StatusBadge,
  ProgressBar,
  Skeleton,
  showToast
} from '../components';

export default function Showcase() {
  const [chipActive, setChipActive] = useState('all');
  const [switchVal, setSwitchVal] = useState(true);
  const [selectVal, setSelectVal] = useState('116');
  const [inputVal, setInputVal] = useState('');

  return (
    <div style={{ display: 'grid', gap: '16px' }} className="animate-fade-in">
      <Card title="معرض المكوّنات المعتمدة (Showcase)" subtitle="تحقق شامل لجميع المكونات طبقاً لمعاينة v0.3.0">
        <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>
          كل المكونات مبنية وفق المعايير الهادئة وتدعم الفاتح والداكن والحركة الهادئة والموبايل بسلاسة كاملة.
        </p>
      </Card>

      {/* Buttons & Chips with Ripple & Press */}
      <Card title="1. الأزرار والشرائح (Buttons with Calm Ripple - ADR-028)">
        <p style={{ margin: '0 0 10px', color: 'var(--mute)', fontSize: '0.82rem' }}>
          اضغط على أي زر لتجربة تأثير التموج الهادئ (Ripple Effect) والاهتزاز اللمسي:
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary" onClick={() => showToast('تم النقر على الزر الأساسي (Ripple)')}>أساسي (Primary)</Button>
          <Button variant="secondary" onClick={() => showToast('زر ثانوي هادئ')}>ثانوي (Secondary)</Button>
          <Button variant="outline">مفرغ (Outline)</Button>
          <Button variant="warning">تحذير (Warning)</Button>
          <Button variant="danger">حذف (Danger)</Button>
          <Button variant="primary" loading>جاري الحفظ</Button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          {['all', 'tractor', 'truck', 'private'].map(f => (
            <Chip
              key={f}
              active={chipActive === f}
              onClick={() => setChipActive(f)}
            >
              {f === 'all' ? 'الكل' : f === 'tractor' ? 'جرار' : f === 'truck' ? 'نقل' : 'ملاكي'}
            </Chip>
          ))}
        </div>
      </Card>

      {/* Fields, Switch & Select (ADR-027) */}
      <Card title="2. الحقول وقوائم الاختيار (Inputs & Custom Select)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <Field
            label="اسم السائق أو رقم العربية"
            placeholder="مثال: 116 أو أحمد..."
            value={inputVal}
            onInput={(e) => setInputVal((e.currentTarget as HTMLInputElement).value)}
          />
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>اختر العربية (ADR-027)</div>
            <Select
              title="اختر سيارة من الأسطول"
              value={selectVal}
              onChange={setSelectVal}
              options={[
                { value: '116', label: 'العربية 116 (جرار)' },
                { value: '118', label: 'العربية 118 (جرار)' },
                { value: '124', label: 'العربية 124 (نقل)' },
                { value: '130', label: 'العربية 130 (ملاكي)' }
              ]}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '20px' }}>
            <Switch
              checked={switchVal}
              onChange={setSwitchVal}
              label={switchVal ? 'تفعيل الإشعارات الفورية' : 'إيقاف الإشعارات'}
            />
          </div>
        </div>
      </Card>

      {/* KPIs & Sparklines */}
      <Card title="3. بطاقات المؤشرات (KPIs with Sparklines)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <KPI
            label="متصلة الآن"
            value="52 / 65"
            icon="🚛"
            delta="+4"
            deltaType="good"
            sparkline={[40, 44, 43, 48, 47, 50, 52]}
            sparkColor="var(--ok)"
          />
          <KPI
            label="Offline"
            value="9"
            icon="⚠️"
            delta="-2"
            deltaType="bad"
            sparkline={[14, 12, 13, 11, 10, 11, 9]}
            sparkColor="var(--bad)"
          />
          <KPI
            label="استفسارات معلقة"
            value="3"
            icon="💬"
            delta="0"
            deltaType="neu"
            sparkline={[1, 4, 2, 5, 3, 2, 3]}
            sparkColor="var(--warn)"
          />
        </div>
      </Card>

      {/* Charts (Donut, Bars, Ring) */}
      <Card title="4. الرسوم البيانية الخفيفة (Charts)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--mute)' }}>توزيع الأسطول (65)</h4>
            <DonutChart
              segments={[
                { label: 'جرار (10)', value: 10, color: 'var(--dn1)' },
                { label: 'نقل (12)', value: 12, color: 'var(--dn2)' },
                { label: 'ملاكي (43)', value: 43, color: 'var(--dn3)' }
              ]}
            />
          </div>
          <div>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--mute)' }}>نقلات الأسبوع</h4>
            <BarChart
              data={[38, 44, 41, 47, 52, 36, 49]}
              labels={['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج']}
              goal={45}
            />
          </div>
          <div>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--mute)' }}>المطابقة الثلاثية</h4>
            <RingProgress percent={92} subtitle="46 من 48 نقلة مطابقة" />
          </div>
        </div>
      </Card>

      {/* Table (ADR-037) */}
      <Card title="5. الجدول المستجيب وشارة النبض (Responsive Table with Pulse Badge)">
        <Table>
          <thead>
            <tr>
              <th className="col-sticky">العربية</th>
              <th>النوع</th>
              <th>الحالة (مع النبض الهادئ)</th>
              <th>إنجاز اليوم</th>
              <th>آخر إشارة</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: '116', name: 'أ ب ج 4821', type: 'جرار', status: 'online' as const, trips: 7, max: 8, time: 'منذ 2 د' },
              { id: '118', name: 'د هـ و 1307', type: 'جرار', status: 'idle' as const, trips: 5, max: 8, time: 'منذ 1 د' },
              { id: '124', name: 'ز ح ط 9054', type: 'نقل', status: 'offline' as const, trips: 3, max: 6, time: 'منذ 3 س' }
            ].map(row => (
              <tr key={row.id}>
                <td className="col-sticky">
                  <b>عربية {row.id}</b>
                  <div style={{ fontSize: '0.74rem', color: 'var(--mute)' }}>{row.name}</div>
                </td>
                <td>{row.type}</td>
                <td><StatusBadge status={row.status} /></td>
                <td><ProgressBar current={row.trips} max={row.max} /></td>
                <td style={{ color: 'var(--mute)', fontSize: '0.78rem' }}>{row.time}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Skeleton Loading */}
      <Card title="6. هياكل التحميل (Skeletons)">
        <div style={{ display: 'grid', gap: '8px' }}>
          <Skeleton height="20px" width="40%" />
          <Skeleton height="14px" width="80%" />
          <Skeleton height="14px" width="60%" />
        </div>
      </Card>
    </div>
  );
}