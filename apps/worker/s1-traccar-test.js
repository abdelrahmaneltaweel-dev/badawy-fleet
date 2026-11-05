// Test script for Spike S-1: Traccar Connectivity from GitHub Actions runner
// Native fetch in Node 20 - zero npm dependencies needed.

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
    process.exit(1);
  }

  let devicesData = null;
  let successfulMethod = '';

  // 2. تجربة الطريقة الأولى: Basic Auth باستخدام USER و PASS
  if (user && pass && !devicesData) {
    console.log('🔑 [محاولة 1]: تجربة Basic Auth باستخدام User و Password...');
    try {
      const basicCreds = Buffer.from(`${user}:${pass}`).toString('base64');
      const res = await fetch(`${url}/api/devices`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${basicCreds}`
        },
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        devicesData = await res.json();
        successfulMethod = 'Basic Auth (User/Password)';
      } else {
        const errText = await res.text();
        console.log(`⚠️ المحاولة 1 ردت بكود [${res.status}]: ${errText.slice(0, 100)}`);
      }
    } catch (e) {
      console.log('⚠️ تعثرت المحاولة 1:', e.message);
    }
  }

  // 3. تجربة الطريقة الثانية: Session Login الرسمي (POST /api/session)
  if (user && pass && !devicesData) {
    console.log('🔑 [محاولة 2]: تجربة إنشاء Session رسمية بـ User و Password...');
    try {
      const sessionRes = await fetch(`${url}/api/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({ email: user, password: pass }).toString(),
        signal: AbortSignal.timeout(15000)
      });

      if (sessionRes.ok) {
        const cookie = sessionRes.headers.get('set-cookie');
        const res = await fetch(`${url}/api/devices`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            ...(cookie ? { 'Cookie': cookie } : {})
          },
          signal: AbortSignal.timeout(15000)
        });

        if (res.ok) {
          devicesData = await res.json();
          successfulMethod = 'Session Cookie Login';
        }
      } else {
        const errText = await sessionRes.text();
        console.log(`⚠️ فشل إنشاء Session بكود [${sessionRes.status}]: ${errText.slice(0, 100)}`);
      }
    } catch (e) {
      console.log('⚠️ تعثرت المحاولة 2:', e.message);
    }
  }

  // 4. تجربة الطريقة الثالثة: استخدام Token
  if (token && !devicesData) {
    console.log('🔑 [محاولة 3]: تجربة الاستيثاق بالـ Token...');
    try {
      // تجربة Bearer Header
      let res = await fetch(`${url}/api/devices`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
        },
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        devicesData = await res.json();
        successfulMethod = 'Bearer Token';
      } else {
        // تجربة Token كـ Query Param
        res = await fetch(`${url}/api/devices?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000)
        });
        if (res.ok) {
          devicesData = await res.json();
          successfulMethod = 'Query Token (?token=...)';
        }
      }
    } catch (e) {
      console.log('⚠️ تعثرت المحاولة 3:', e.message);
    }
  }

  // تقييم النتيجة النهائية
  if (devicesData && Array.isArray(devicesData)) {
    console.log(`🎉 نجح الاختبار وسحب الأجهزة بنجاح عبر: [${successfulMethod}]!`);
    console.log(`📊 تم جلب بيانات [${devicesData.length}] عربية/جهاز من السيرفر.`);
    console.log('🔒 حماية الأمان: تم إخفاء تفاصيل العربيات وأرقام الأجهزة لحماية بيانات الشركة.');
    process.exit(0);
  } else {
    console.error('❌ لم تنجح أي طريقة استيثاق. يرجى مراجعة صحة اسم المستخدم وكلمة المرور في Secrets.');
    process.exit(1);
  }
}

run();