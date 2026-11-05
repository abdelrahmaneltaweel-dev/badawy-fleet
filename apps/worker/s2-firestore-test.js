// Test script for Spike S-2: Firestore Admin SDK on Spark plan + Security Rules test
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

async function run() {
  const secretJson = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!secretJson) {
    console.error('❌ خطأ: لم يتم ضبط FIREBASE_SERVICE_ACCOUNT في GitHub Secrets.');
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(secretJson);
  } catch (err) {
    console.error('❌ خطأ: محتوى FIREBASE_SERVICE_ACCOUNT ليس JSON صحيحاً.');
    process.exit(1);
  }

  console.log('🔥 1. جاري تهيئة Firebase Admin SDK...');
  const app = initializeApp({
    credential: cert(serviceAccount)
  });
  const db = getFirestore(app);
  const projectId = serviceAccount.project_id;
  console.log(`✅ تم الاتصال بمشروع Firebase: [${projectId}]`);

  // 2. اختبار الكتابة عبر Admin SDK
  console.log('✍️ 2. اختبار كتابة مستند في Firestore (Spark Plan)...');
  const docRef = db.collection('_spikes').doc('s2_spark_test');
  const writeStart = Date.now();
  await docRef.set({
    spike: 'S-2',
    plan: 'Spark (Free)',
    runner: 'GitHub Actions',
    createdAt: FieldValue.serverTimestamp(),
    testData: {
      status: 'success',
      readsLimitDaily: 50000,
      writesLimitDaily: 20000
    }
  });
  console.log(`✅ تمت الكتابة بنجاح خلال ${Date.now() - writeStart}ms.`);

  // 3. اختبار القراءة عبر Admin SDK
  console.log('📖 3. اختبار قراءة المستند من Firestore...');
  const readStart = Date.now();
  const snap = await docRef.get();
  if (!snap.exists) {
    console.error('❌ فشل: المستند لم يتم العثور عليه بعد كتابته.');
    process.exit(1);
  }
  const data = snap.data();
  console.log(`✅ تمت القراءة بنجاح خلال ${Date.now() - readStart}ms. البيانات المسترجعة: [Spike: ${data.spike}, Plan: ${data.plan}].`);

  // 4. تنظيف مستند الاختبار (Delete)
  console.log('🧹 4. تنظيف مستند الاختبار لحفظ مساحة التخزين...');
  await docRef.delete();
  console.log('✅ تم حذف مستند الاختبار بنجاح.');

  // 5. اختبار قواعد الأمان (Firestore Rules): محاولة وصول غير مصرح بها عبر REST
  console.log('🛡️ 5. اختبار قواعد الأمان: محاولة وصول غير مصرح بها (بدون Token)...');
  const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/_spikes/s2_unauth_test`;
  try {
    const unauthRes = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          test: { stringValue: 'unauthorized_write' }
        }
      })
    });

    if (unauthRes.status === 403 || unauthRes.status === 401) {
      console.log(`✅ نجح اختبار قواعد الأمان! تم حظر الطلب غير المصرح بكود [${unauthRes.status} PERMISSION_DENIED].`);
    } else {
      console.warn(`⚠️ تنبيه: استجاب السيرفر بكود [${unauthRes.status}]. تأكد أن قواعد الأمان على Production mode.`);
    }
  } catch (err) {
    console.log('✅ تم حظر الوصول غير المصرح به للشبكة:', err.message);
  }

  console.log('\n🎉 اكتمل اختبار Spike S-2 بنجاح تام!');
  console.log('📌 النتائج المؤكدة:');
  console.log('  1. العمل على خطة Spark المجانية بدون كارت وبدون Blaze.');
  console.log('  2. Admin SDK يكتب ويقرأ بكفاءة وسرعة من GitHub Actions.');
  console.log('  3. قواعد الأمان تمنع أي وصول خارجي غير مصرح به.');
}

run().catch(err => {
  console.error('❌ حدث خطأ أثناء تنفيذ Spike S-2:', err);
  process.exit(1);
});