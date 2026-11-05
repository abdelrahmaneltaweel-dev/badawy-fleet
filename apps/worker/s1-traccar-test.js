// Test script for Spike S-1: Traccar Connectivity from GitHub Actions runner
// Runs on native fetch in Node 20 (zero npm dependencies).

async function run() {
  const url = process.env.TRACCAR_URL?.trim().replace(/\/+$/, '');
  const token = process.env.TRACCAR_TOKEN?.trim();
  const user = process.env.TRACCAR_USER?.trim();
  const pass = process.env.TRACCAR_PASS?.trim();

  if (!url) {
    console.error('❌ خطأ: لم يتم ضبط TRACCAR_URL في GitHub Secrets.');
    process.exit(1);
  }

  console.log('📡 جاري فحص الاتصال بسيرفر Traccar...');
  const startTime = Date.now();

  // 1. اختبار وصول الشبكة لنقطة السيرفر العامة
  try {
    const serverRes = await fetch(`${url}/api/server`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const serverDuration = Date.now() - startTime;
    console.log(`✅ الوصول للشبكة ناجح! رد السيرفر بكود [${serverRes.status}] خلال ${serverDuration}ms.`);
  } catch (err) {
    console.error('❌ فشل الوصول للسيرفر من GitHub Runner:', err.message);
    console.error('💡 تشخيص: تأكد أن السيرفر متاح أونلاين ويسمح بالاتصال الخارجي عبر البورت المحدد.');
    process.exit(1);
  }

  // 2. إعداد التوثيق المطلوب
  const headers = { 'Accept': 'application/json' };
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') || token.startsWith('Basic ') ? token : `Bearer ${token}`;
  } else if (user && pass) {
    const creds = Buffer.from(`${user}:${pass}`).toString('base64');
    headers['Authorization'] = `Basic ${creds}`;
  }

  // 3. اختبار سحب قائمة الأجهزة /api/devices
  try {
    const devicesStart = Date.now();
    let devicesRes = await fetch(`${url}/api/devices`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(20000)
    });

    // محاولة بديلة إذا كان التوكن يُمرر كـ query parameter
    if (devicesRes.status === 401 && token) {
      devicesRes = await fetch(`${url}/api/devices?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000)
      });
    }

    const duration = Date.now() - devicesStart;

    if (!devicesRes.ok) {
      console.error(`❌ استجاب السيرفر ولكن بكود خطأ: ${devicesRes.status} ${devicesRes.statusText}`);
      if (devicesRes.status === 401 || devicesRes.status === 403) {
        console.error('💡 تشخيص: بيانات الدخول (Token أو User/Pass) غير صحيحة أو ليس لها صلاحية لقراءة الأجهزة.');
      }
      process.exit(1);
    }

    const data = await devicesRes.json();
    if (Array.isArray(data)) {
      console.log(`🎉 نجح الاختبار بالكامل! تم سحب بيانات [${data.length}] جهاز خلال ${duration}ms.`);
      console.log('🔒 حماية الأمان: تم إخفاء أي بيانات أو تفاصيل للأجهزة التزاماً بسياسة الريبو العام.');
    } else {
      console.log('✅ استجاب السيرفر بنجاح بقائمة بيانات.');
    }
  } catch (err) {
    console.error('❌ حدث خطأ أثناء سحب الأجهزة:', err.message);
    process.exit(1);
  }
}

run();