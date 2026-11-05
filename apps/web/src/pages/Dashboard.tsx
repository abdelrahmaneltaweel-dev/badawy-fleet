export default function Dashboard() {
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={{ background: 'var(--card)', padding: '16px', borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem' }}>صباح الخير 👋</h2>
        <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>لوحة متابعة الأسطول والعمليات اليومية</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <div style={{ background: 'var(--card)', padding: '12px', borderRadius: 'var(--r)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <small style={{ color: 'var(--mute)' }}>متصلة الآن</small>
          <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--ok)', marginTop: '4px' }}>52 / 65</b>
        </div>
        <div style={{ background: 'var(--card)', padding: '12px', borderRadius: 'var(--r)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <small style={{ color: 'var(--mute)' }}>Offline</small>
          <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--bad)', marginTop: '4px' }}>9</b>
        </div>
        <div style={{ background: 'var(--card)', padding: '12px', borderRadius: 'var(--r)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <small style={{ color: 'var(--mute)' }}>استفسارات معلقة</small>
          <b style={{ display: 'block', fontSize: '1.6rem', color: 'var(--warn)', marginTop: '4px' }}>3</b>
        </div>
      </div>
    </div>
  );
}