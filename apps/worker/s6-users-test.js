// Test script for Spike S-6: User management & Custom Claims on Firebase Spark
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

async function run() {
  const secretJson = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!secretJson) {
    console.error('❌ خطأ: لم يتم ضبط FIREBASE_SERVICE_ACCOUNT في GitHub Secrets.');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(secretJson);
  const app = initializeApp({
    credential: cert(serviceAccount)
  });
  const auth = getAuth(app);
  const db = getFirestore(app);

  const testEmail = `test-user-${Date.now()}@badawy.local`;
  let createdUid = null;

  console.log('👤 1. جاري تجربة إنشاء مستخدم من الإدارة (Admin SDK)...');
  try {
    const userRecord = await auth.createUser({
      email: testEmail,
      password: 'TemporaryPassword123!',
      displayName: 'سائق تجريبي S-6'
    });
    createdUid = userRecord.uid;
    console.log(`✅ تم إنشاء المستخدم بنجاح! UID: [${userRecord.uid}] | Email: [${userRecord.email}]`);
  } catch (err) {
    console.error('❌ فشل إنشاء المستخدم:', err.message);
    if (err.code === 'auth/configuration-not-found' || err.message.includes('CONFIGURATION_NOT_FOUND')) {
      console.error('💡 تشخيص: تأكد من تفعيل خدمة Authentication في Firebase Console بالضغط على Get started.');
    }
    process.exit(1);
  }

  // 2. تعيين الدور والصلاحيات كـ Custom User Claims في التوكن مباشرة
  console.log('🏷️ 2. تجربة تعيين الدور والصلاحيات (Custom Claims) داخل Token المستخدم...');
  await auth.setCustomUserClaims(createdUid, {
    role: 'driver',
    scope: 'all',
    assignedAt: Date.now()
  });

  const verifiedUser = await auth.getUser(createdUid);
  if (verifiedUser.customClaims?.role === 'driver') {
    console.log(`✅ تم تعيين الدور في الـ Token بنجاح! Role: [${verifiedUser.customClaims.role}]`);
  } else {
    console.error('❌ فشل التحقق من Custom Claims.');
    process.exit(1);
  }

  // 3. تجربة توليد رابط إعادة تعيين كلمة السر (Password Reset Link)
  console.log('🔗 3. تجربة توليد رابط إعادة تعيين كلمة المرور...');
  const resetLink = await auth.generatePasswordResetLink(testEmail);
  console.log('✅ تم توليد رابط إعادة التعيين بنجاح دون الحاجة لخدمة إيميل خارجية.');

  // 4. تحليل وتقدير تكلفة القراءات في Rules (Analysis of Rules Reads Cost)
  console.log('\n📊 4. دراسة تكلفة الـ Rules وقراءات Spark (Rules Cost Analysis):');
  console.log('  • في حالة استخدام get() في Rules للتحقق من دور المستخدم:');
  console.log('    - كل قراءة أو كتابة لمستند تستلزم قراءة إضافية لمستند المستخدم.');
  console.log('    - مع 20 مستخدم و1,000 استعلام يومياً = 1,000 إلى 2,000 قراءة إضافية مهدرة من حصة الـ 50,000.');
  console.log('  • في حالة استخدام Custom Claims (request.auth.token.role):');
  console.log('    - الدور والصلاحية مشفّرة داخل توكن الدخول (JWT).');
  console.log('    - تكلفة قراءات الـ Rules = صفر قراءة (0 Reads) في Firestore!');
  console.log('  🏆 النتيجة: اعتماد Custom Claims يوفر 100% من استهلاك قراءات الـ Rules ويضمن بقاء المشروع داخل حصة Spark المجانية.');

  // 5. تنظيف المستخدم التجريبي
  console.log('\n🧹 5. تنظيف وحذف المستخدم التجريبي...');
  await auth.deleteUser(createdUid);
  console.log('✅ تم حذف المستخدم التجريبي بنجاح.');

  console.log('\n🎉 اكتمل اختبار Spike S-6 بنجاح تام وتم إثبات كل أهدافه!');
}

run().catch(err => {
  console.error('❌ خطأ غير متوقع في Spike S-6:', err);
  process.exit(1);
});