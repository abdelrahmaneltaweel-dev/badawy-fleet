import { Icon } from '../components/Icon';

export default function Reports() {
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ background: 'var(--card)', padding: '16px', borderRadius: 'var(--r)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem' }}>التقارير اليومية والفترات</h2>
          <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>نقلات الجرارات، مشاوير النقل والملاكي، ومتابعة المطابقة الثلاثية</p>
        </div>
        <a
          href="#/excel-upload"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--soft)',
            border: '1px solid var(--line)',
            color: 'var(--tx)',
            padding: '8px 14px',
            borderRadius: 'var(--r-sm)',
            textDecoration: 'none',
            fontSize: '0.86rem',
            fontWeight: 600
          }}
        >
          <Icon name="upload" size={16} />
          <span>الرفع اليدوي لـ Excel الخام (ADR-048)</span>
        </a>
      </div>
    </div>
  );
}