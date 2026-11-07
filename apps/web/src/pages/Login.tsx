import { useState } from 'preact/hooks';
import { authService, type UserProfile, DEFAULT_DEMO_PASSWORD } from '../services/auth';
import { firebaseService } from '../services/firebase';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { showToast } from '../components/Toast';

export default function Login({ onLoginSuccess }: { onLoginSuccess: (user: UserProfile) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRealFirebase = firebaseService.isConfigured();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!email) {
      setError('يرجى كتابة البريد الإلكتروني');
      return;
    }
    if (!password) {
      setError('يرجى إدخال كلمة السر');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const user = await authService.login(email, password);
      showToast(`مرحباً بك ${user.displayName}`);
      onLoginSuccess(user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تسجيل الدخول';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setLoading(true);
    setError(null);
    setEmail(demoEmail);
    setPassword(DEFAULT_DEMO_PASSWORD);
    try {
      const user = await authService.login(demoEmail, DEFAULT_DEMO_PASSWORD);
      showToast(`تم الدخول كـ: ${user.displayName}`);
      onLoginSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <Card className="animate-slide-up">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src="./brand/mark.png" alt="Badawi Group" style={{ height: '48px', marginBottom: '8px' }} />
            <h1 style={{ margin: '0 0 4px', fontSize: '1.35rem', color: 'var(--acc)' }}>منصة أسطول أبناء بدوي</h1>
            <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.84rem' }}>
              تسجيل الدخول للمنصة (ADR-013)
            </p>

            <div style={{ marginTop: '10px' }}>
              {isRealFirebase ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--r-full)',
                    background: 'var(--ok-soft)',
                    color: 'var(--ok)',
                    fontWeight: 700
                  }}
                >
                  🔥 متصل بحسابات Firebase الحقيقية
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--r-full)',
                    background: 'var(--warn-soft)',
                    color: 'var(--warn)',
                    fontWeight: 600
                  }}
                >
                  🧪 وضع الحسابات التجريبية (كلمة السر: {DEFAULT_DEMO_PASSWORD})
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <Field
              label="البريد الإلكتروني"
              type="email"
              placeholder="example@badawi.com"
              value={email}
              onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
              icon={<Icon name="user" size={17} />}
              required
            />

            <Field
              label="كلمة السر"
              type="password"
              placeholder="••••••••"
              value={password}
              onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)}
              icon={<Icon name="set" size={17} />}
              required
            />

            {error && (
              <div
                style={{
                  background: 'var(--bad-soft)',
                  color: 'var(--bad)',
                  padding: '10px 14px',
                  borderRadius: 'var(--r-xs)',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}
              >
                {error}
              </div>
            )}

            <Button variant="primary" type="submit" loading={loading} style={{ width: '100%', minHeight: '42px' }}>
              تسجيل الدخول
            </Button>
          </form>

          {/* تجربة فورية بالأدوار المعتمدة */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--mute)', marginBottom: '8px', textAlign: 'center' }}>
              ⚡ تجربة سريعة بالأدوار المعتمدة (مع التحقق من كلمة السر):
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', justifyContent: 'space-between' }}
                onClick={() => handleDemoLogin('admin@badawi.com')}
              >
                <span>👑 مسؤول الأسطول (Super Admin)</span>
                <small style={{ color: 'var(--mute)' }}>كامل الصلاحيات</small>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', justifyContent: 'space-between' }}
                onClick={() => handleDemoLogin('feisal@badawi.com')}
              >
                <span>🏭 أ. فيصل (مدير الخلاطة)</span>
                <small style={{ color: 'var(--mute)' }}>بيان الخلاطة والاستفسارات</small>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', justifyContent: 'space-between' }}
                onClick={() => handleDemoLogin('driver116@badawi.com')}
              >
                <span>🚛 محمد إبراهيم (سائق 116)</span>
                <small style={{ color: 'var(--mute)' }}>شاشات السائق فقط</small>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', justifyContent: 'space-between' }}
                onClick={() => handleDemoLogin('finance@badawi.com')}
              >
                <span>📊 الإدارة والمالية</span>
                <small style={{ color: 'var(--mute)' }}>عرض وتصدير التقارير</small>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}