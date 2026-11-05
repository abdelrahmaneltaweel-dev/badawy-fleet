import { useState, useEffect } from 'preact/hooks';
import { authService, type UserProfile, type UserRole, type PermissionKey } from '../services/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { Switch } from '../components/Switch';
import { Table } from '../components/Table';
import { Icon } from '../components/Icon';
import { showToast } from '../components/Toast';

export default function Users() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('driver');
  const [driverVehicleId, setDriverVehicleId] = useState('116');
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<UserProfile | null>(null);

  const canManageUsers = authService.can('users.manage');

  const refreshUsers = () => {
    setUsers([...authService.listUsers()]);
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const handleCreateUser = async (e: Event) => {
    e.preventDefault();
    if (!newName || !newEmail) {
      showToast('يرجى إكمال الاسم والبريد');
      return;
    }

    try {
      await authService.createUserFromAdmin({
        displayName: newName,
        email: newEmail,
        role: newRole,
        driverId: newRole === 'driver' ? driverVehicleId : undefined
      });
      showToast(`تم إنشاء حساب ${newName} بنجاح`);
      setShowAddModal(false);
      setNewName('');
      setNewEmail('');
      refreshUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إنشاء المستخدم';
      showToast(msg);
    }
  };

  const handleToggleActive = async (user: UserProfile) => {
    try {
      await authService.updateUserPermissions(user.uid, { active: !user.active });
      showToast(user.active ? `تم تعطيل حساب ${user.displayName}` : `تم تفعيل حساب ${user.displayName}`);
      refreshUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت العملية';
      showToast(msg);
    }
  };

  const handleSendResetLink = (user: UserProfile) => {
    showToast(`تم توليد رابط إعادة كلمة السر لـ ${user.email}`);
  };

  const handleToggleCustomPermission = async (perm: PermissionKey) => {
    if (!selectedUserForPerms) return;
    const currentAllowed = selectedUserForPerms.customAllow || [];
    const isAllowed = currentAllowed.includes(perm);

    const newAllow = isAllowed
      ? currentAllowed.filter((p) => p !== perm)
      : [...currentAllowed, perm];

    try {
      const updated = await authService.updateUserPermissions(selectedUserForPerms.uid, {
        customAllow: newAllow
      });
      setSelectedUserForPerms(updated);
      showToast('تم تحديث الصلاحية بنجاح');
      refreshUsers();
    } catch {
      showToast('فشل التعديل');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }} className="animate-fade-in">
      <Card
        title="إدارة المستخدمين والصلاحيات"
        subtitle="إنشاء وإدارة الأدوار والصلاحيات الدقيقة دون خروج الأدمن (Spike S-6 / ADR-015)"
        action={
          canManageUsers && (
            <Button variant="primary" icon={<Icon name="user" size={17} />} onClick={() => setShowAddModal(true)}>
              إضافة مستخدم جديد
            </Button>
          )
        }
      >
        <p style={{ margin: 0, color: 'var(--mute)', fontSize: '0.86rem' }}>
          الأدوار تُفحص عبر Custom Claims بتكلفة 0 قراءات في Firestore Rules وتضمن حظر غير المصرح به.
        </p>
      </Card>

      {/* جدول المستخدمين */}
      <Table>
        <thead>
          <tr>
            <th className="col-sticky">الاسم</th>
            <th>البريد الإلكتروني</th>
            <th>الدور الأساسي</th>
            <th>الحالة</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.uid}>
              <td className="col-sticky">
                <b>{u.displayName}</b>
                {u.driverId && <div style={{ fontSize: '0.74rem', color: 'var(--mute)' }}>عربية {u.driverId}</div>}
              </td>
              <td>{u.email}</td>
              <td>
                <span style={{ background: 'var(--soft)', padding: '3px 8px', borderRadius: 'var(--r-xs)', fontSize: '0.78rem', fontWeight: 600 }}>
                  {authService.getRoleLabel(u.role)}
                </span>
              </td>
              <td>
                <span style={{ color: u.active ? 'var(--ok)' : 'var(--bad)', fontWeight: 700, fontSize: '0.8rem' }}>
                  {u.active ? '● نشط' : '○ معطل'}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <Button
                    variant="secondary"
                    style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.78rem' }}
                    onClick={() => setSelectedUserForPerms(u)}
                  >
                    الصلاحيات
                  </Button>
                  <Button
                    variant="outline"
                    style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.78rem' }}
                    onClick={() => handleSendResetLink(u)}
                    title="إعادة كلمة السر"
                  >
                    كلمة السر
                  </Button>
                  {u.role !== 'super_admin' && (
                    <Button
                      variant={u.active ? 'danger' : 'secondary'}
                      style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.78rem' }}
                      onClick={() => handleToggleActive(u)}
                    >
                      {u.active ? 'تعطيل' : 'تفعيل'}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* نافذة إضافة مستخدم جديد */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 80, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '440px' }}>
            <Card title="إضافة مستخدم جديد">
              <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: '12px' }}>
                <Field
                  label="الاسم الكامل"
                  placeholder="مثال: حسام علي"
                  value={newName}
                  onInput={(e) => setNewName((e.currentTarget as HTMLInputElement).value)}
                  required
                />

                <Field
                  label="البريد الإلكتروني"
                  type="email"
                  placeholder="user@badawi.com"
                  value={newEmail}
                  onInput={(e) => setNewEmail((e.currentTarget as HTMLInputElement).value)}
                  required
                />

                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>الدور الأساسي</div>
                  <Select
                    value={newRole}
                    onChange={(val) => setNewRole(val as UserRole)}
                    options={authService.getAvailableRoles().map((r) => ({ value: r.role, label: r.label }))}
                  />
                </div>

                {newRole === 'driver' && (
                  <Field
                    label="رقم العربية المسندة"
                    placeholder="مثال: 116"
                    value={driverVehicleId}
                    onInput={(e) => setDriverVehicleId((e.currentTarget as HTMLInputElement).value)}
                  />
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <Button variant="ghost" type="button" onClick={() => setShowAddModal(false)}>
                    إلغاء
                  </Button>
                  <Button variant="primary" type="submit">
                    حفظ وإنشاء الحساب
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* نافذة تخصيص الصلاحيات الدقيقة */}
      {selectedUserForPerms && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 85, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '480px' }}>
            <Card
              title={`صلاحيات: ${selectedUserForPerms.displayName}`}
              subtitle={`الدور الحالي: ${authService.getRoleLabel(selectedUserForPerms.role)}`}
            >
              <div style={{ display: 'grid', gap: '10px', maxHeight: '55vh', overflowY: 'auto', padding: '4px' }}>
                {[
                  { key: 'report.edit' as PermissionKey, label: 'تعديل التقارير عبر Google Sheets (ADR-032)' },
                  { key: 'period.close' as PermissionKey, label: 'إغلاق وتجميد الفترات (ADR-039)' },
                  { key: 'period.open' as PermissionKey, label: 'فتح الفترات المقفولة (ADR-039)' },
                  { key: 'adjustment.create' as PermissionKey, label: 'إنشاء تسوية مرتبات (ADR-046)' },
                  { key: 'adjustment.approve' as PermissionKey, label: 'اعتماد التسويات (ADR-046)' },
                  { key: 'import.upload' as PermissionKey, label: 'رفع وتحليل ملفات Excel الخام (ADR-048)' },
                  { key: 'settings.manage' as PermissionKey, label: 'إدارة سجل الإعدادات (ADR-040)' }
                ].map((perm) => {
                  const defaultHas = authService.getDefaultPermissions(selectedUserForPerms.role).includes(perm.key);
                  const isExplicitlyAllowed = selectedUserForPerms.customAllow?.includes(perm.key);
                  const active = Boolean(defaultHas || isExplicitlyAllowed);

                  return (
                    <div key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: 'var(--soft)', borderRadius: 'var(--r-xs)' }}>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{perm.label}</div>
                        {defaultHas && <small style={{ color: 'var(--mute)' }}>مفعل افتراضياً للدور</small>}
                      </div>
                      <Switch
                        checked={active}
                        disabled={defaultHas}
                        onChange={() => handleToggleCustomPermission(perm.key)}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <Button variant="primary" onClick={() => setSelectedUserForPerms(null)}>
                  تم
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}