/**
 * ============================================================================
 *  تقرير حركة سيارات الأسطول – شركة أبناء بدوي للمقاولات
 *  Google Apps Script (JavaScript) – يشتغل على Google Sheets
 * ============================================================================
 *
 *  طريقة الاستخدام (لكل سيارة):
 *   1) افتح ملف Google Sheets جديد (أو انسخ الملف الجاهز).
 *   2) File ▸ Import ▸ Upload  وارفع الملفات التلاتة (مرة واحدة لملف المواقع):
 *        - GPS Routing Points.xlsx
 *        - GPS Trips Report.xlsx
 *        - ملف إحداثيات المواقع  (بيتحفظ في الشيت ويفضل ثابت لكل السيارات)
 *      اختار "Insert new sheet(s)". مش مهم اسم الشيت – الكود بيتعرف عليهم من المحتوى.
 *   3) من القايمة  "GPS Tracking System ▸ 🚚 إنشاء تقرير السيارة".
 *
 *  بيطلع:
 *   - شيت "تقرير <رقم السيارة>"  بنفس شكل تقرير الإدارة (PDF)
 *   - شيت "ملخص يومي"، "الدورات"، "سجل الزيارات"، "تنبيهات" للمراجعة والتدقيق
 *
 *  كل الإعدادات (أنصاف أقطار المواقع، حدود التوقف…) في GPS_CONFIG تحت.
 * ============================================================================
 */

/* ───────────────────────────── الإعدادات ───────────────────────────── */
const GPS_CONFIG = {
  DAY_START_HOUR: 6,           // يوم الشغل بيبدأ الساعة دي: نقلة اتفرّغت بعد نص الليل وقبل الساعة دي (ودورتها بدأت اليوم اللي قبله) تتحسب على اليوم اللي بدأت فيه. 0 = تقويم عادي
  EXCURSION_MIN_KM: 5,        // ...بشرط إنها تكون طولها كدا أو أكتر، أو وقفت فيها 10 دقايق أو أكتر بعيد عن الموقع (غير كده تفضل تنقل داخلي)
  EXCURSION_M: 1500,          // رحلة خارجة من موقع (جوه فترة وقوف/زيارة) وبتبعد عنه أكتر من كدا بالمتر وترجع من غير ما تقف في موقع = "رحلة غير معلومة" مش تنقل داخلي
  DATE_RULE: 'LASTU',          // تاريخ الدورة: LASTU = تاريخ آخر تفريغ (نقلة مكتملة) | FIRST = تاريخ أول وصول للكسارة | END = تاريخ الرجوع للخلاطة
  // قواعد تعريف المواقع حسب الاسم في ملف الإحداثيات (الأولوية بالترتيب).
  //  role : MIXER خلاطة | CRUSHER كسارة | UNLOAD موقع تفريغ | WORKSHOP جراج/ورشة | OTHER مكان خارجي
  //  radius : المسافة (متر) من أقرب نقطة مسجلة للموقع واللي تتعتبر "جوه الموقع".
  //           نقاط ملف المواقع بتمثل خطوط طرق جوه الموقع، فالنطاق الفعلي أوسع منها.
  SITES: [
    { match: /خلاط/,                 role: 'MIXER',    radius: 5500, label: 'الخلاطة', coreRadius: 500, coreMinMin: 5 },
    { match: /كسار/,                 role: 'CRUSHER',  radius: 4500, label: 'الكسارة' },
    { match: /دولي/,                 role: 'UNLOAD',   radius: 2500, label: 'الدولي' },
    { match: /برج/,                  role: 'UNLOAD',   radius: 4000, label: 'البرج' },
    { match: /حوش عيسي|عيسي|كومبو/,  role: 'UNLOAD',   radius: 800,  label: 'عزبة كومبو (حوش عيسي)' },
    { match: /جراج/,                 role: 'WORKSHOP', radius: 400,  label: 'الجراج' },
    { match: /سعفان/,                role: 'WORKSHOP', radius: 500,  label: 'مركز ال سعفان' },
    { match: /نجار/,                 role: 'OTHER',    radius: 800,  label: 'محطة وقود النجار (كوبري النوبارية)' }
  ],
  // موقع جديد في الملف مالوش قاعدة فوق: بيتعامل كموقع تفريغ + تنبيه.
  DEFAULT_SITE: { role: 'UNLOAD', radius: 800 },

  STOP_SPEED_KMH: 3,          // أقل من كدا = واقفة
  MIN_STOP_MIN: 3,            // وقوف جوه الموقع بالدقايق = زيارة
  MIN_MOVING_DWELL_MIN: 30,   // أو بقاء جوه الموقع المدة دي بسرعة متوسطة قليلة = زيارة (تفريغ بالحركة)
  MAX_MOVING_MEAN_KMH: 70,    // فوق السرعة دي = مجرد مرور على الطريق جنب الموقع
  MIXER_PASS_STOP_MIN: 20,    // وقفة خلاطة بين الكسارة والتفريغ (من غير ما ترجع للخلاطة فعلاً) أقل من المدة دي = مرور على الطريق مش زيارة
  MERGE_GAP_MIN: 15,          // زيارتين لنفس الموقع بينهم أقل من كدا = زيارة واحدة
  LEG_TOLERANCE_SEC: 180,     // سماحية ربط أوقات الرحلات بأوقات الزيارات
  UNKNOWN_STAY_MIN: 30,       // وقوف خارج أي موقع معرّف يتسجل كـ "مكان غير معرّف"
  UNKNOWN_CLUSTER_M: 1500,
  LONG_UNKNOWN_STAY_MIN: 60,  // الوقوفات الأطول من كدا بتظهر في شيت التنبيهات
  MAX_AREA_KM: 150,           // أي نقطة بعيدة عن كل المواقع أكتر من كدا = إشارة غلط (قفزات لإيطاليا مثلاً)
  MAX_JUMP_KMH: 250,          // نقطة GPS بتقفز بسرعة أكبر من كدا = إشارة غلط وبتتشال
  IDLE_MIN_HOURS: 24,         // وقوف في نفس الموقع المدة دي أو أكتر بدون حركة = العربية متوقفة (مفيش سواق / عطل كبير)
  WORKSHOP_MIN_STOP_MIN: 120, // وقفة الجراج/الصيانة تتحسب صيانة لو (جاية مباشرة من الخلاطة) أو (وقفت فعلياً المدة دي أو أكتر). غير كده = وقفة على الطريق
  WORKSHOP_MIN_STAY_MIN: 20,  // رحلة الصيانة بتتحسب بس لو العربية دخلت الجراج/المركز ووقفت فيه المدة دي على الأقل. أقل من كدا = وقفة بسيطة على الطريق قدامه (مش صيانة)
  HARD_VEHICLES: ['124'],     // عربيات الـ GPS بتاعها بيخرف: بيتطبق عليها بروفايل خاص (السرعة الوهمية وهي واقفة بتتصفّر). ضيف أرقام عربيات تانية هنا لو احتجت
  MAX_AVG_KMH: 95,            // أقصى متوسط سرعة منطقي للرحلة (فوقه الطول يعتبر غلط)
  IGNORE_LEG_KM: 0.2,         // رحلات GPS أقل من كدا = تذبذب إشارة وبتتشال من التقرير
  MAX_DT_SEC: 600,            // سقف الوزن الزمني بين نقطتين متتاليتين

  REPORT_PREFIX: 'تقرير ',
  SUMMARY_SHEET: 'ملخص يومي',
  CYCLES_SHEET: 'الدورات',
  VISITS_SHEET: 'سجل الزيارات',
  ALERTS_SHEET: 'تنبيهات'
};

/* ───────────────────────────── القايمة ───────────────────────────── */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Badawy Group')
    .addSubMenu(ui.createMenu('GPS Tracking System')
      .addSubMenu(ui.createMenu('Vehicles')
        .addItem('➕ Add Vehicle', 'vehOpenAdd')
        .addItem('🗑 Remove Vehicle', 'vehOpenRemove'))
      .addSubMenu(ui.createMenu('Reports Generation')
        .addItem('🚚 إنشاء تقرير النقلات', 'runFleetReport')
        .addItem('📡 إنشاء تقرير النقلات من المنصة', 'runPlatformReport')
        .addItem('🚗 إنشاء تقرير سيارة من المنصة', 'runErrandReport')
        .addItem('📶 متابعة حالة ال GPS', 'runGpsStatus')
        .addItem('🗑 مسح كاش البيانات', 'clearGpsCache'))
      .addSubMenu(ui.createMenu('Reports Edits')
        .addItem('✏️ تطبيق تعديلاتي على التقرير', 'applyManualEdits')
        .addItem('🧽 مسح تعديلاتي المحفوظة', 'clearSavedEdits')
        .addItem('🧽 مسح تعديلات المشاوير المحفوظة', 'errandClearSavedEdits'))
      .addSubMenu(ui.createMenu('خلاطة / جراج')
        .addItem('🏭 بيان الخلاطة', 'stmtOpenMixer')
        .addItem('🔧 بيان الجراج', 'stmtOpenGarage')
        .addItem('👷 مدير الخلاطة', 'stmtManagerMixerOpen')
        .addItem('🛡 قسم الأمن والعمليات', 'stmtManagerGarageOpen')))
    .addSubMenu(ui.createMenu('Petro App')
      .addItem('⛽ طلب عهدة', 'petroOpen'))
    .addSubMenu(ui.createMenu('Dashboard Data')
      .addItem('⚙️ إعداد ملف بيانات الداشبورد (أول مرة)', 'dashSetup')
      .addItem('📊 تحديث بيانات الداشبورد', 'runDashRefresh')
      .addItem('🔗 فتح ملف البيانات', 'dashShowLink')
      .addItem('♻️ إعادة بناء الداشبورد من الصفر', 'dashResetAll'))
    .addSubMenu(ui.createMenu('Issues Management')
      .addItem('🛠 إعداد نظام المشاكل (أول مرة)', 'issuesSetup')
      .addItem('➕ إضافة مهندس', 'issuesAddEngineer')
      .addItem('➕ إضافة سائق', 'issuesAddDriver')
      .addItem('🌐 حفظ رابط الـ Web app', 'issuesSetUrl')
      .addItem('🔗 روابط الصفحات', 'issuesShowLinks'))
    .addSeparator()
    .addItem('🧹 مسح كل الشيتات', 'clearAllSheets')
    .addItem('📘 حالة المشروع', 'showProjectStatus')
    .addToUi();
}

/* ───────────── مسح الشيتات: نافذة اختيار. الشيتات الثابتة (Coordinates / Devices Naming Connection / Places) مش بتتمسح ومش بتظهر للاختيار ───────────── */
function isProtectedSheet_(sh) {
  if (/coordinates|احداثيات|إحداثيات|devices naming|^places$|أماكن مسماة|manual edits store|errand edits store|^(engineers|drivers|issues|issue replies)$|^(بيان الخلاطة|بيان الجراج)$|^statement (managers|requests)$|^بيان (الخلاطة|الجراج) - نسخة قبل التحديث$/i.test(sh.getName())) return true;
  try {
    if (sh.getLastRow() >= 1) return detectSheetKind_(sh.getRange(1, 1, Math.min(30, sh.getLastRow()), Math.min(20, Math.max(2, sh.getLastColumn()))).getValues()) === 'locations';
  } catch (e) {}
  return false;
}
function sheetGroups_(ss) {
  const keep = [], G = { rep: [], stat: [], inp: [], other: [] };
  ss.getSheets().forEach(function (sh) {
    const n = sh.getName();
    if (isProtectedSheet_(sh)) { keep.push(n); return; }
    if ([GPS_CONFIG.REPORT_PREFIX, GPS_CONFIG.SUMMARY_SHEET, GPS_CONFIG.CYCLES_SHEET, GPS_CONFIG.VISITS_SHEET, GPS_CONFIG.ALERTS_SHEET, ERR.PREFIX, ERR.SUMMARY_PREFIX].some(function (p) { return n.indexOf(p) === 0; })) G.rep.push(n);
    else if (n === GPS_STATUS.FLEET_SHEET || n.indexOf(GPS_STATUS.VEHICLE_PREFIX) === 0) G.stat.push(n);
    else {
      let k = null;
      try { if (sh.getLastRow() >= 2) k = detectSheetKind_(sh.getRange(1, 1, Math.min(30, sh.getLastRow()), Math.min(20, Math.max(2, sh.getLastColumn()))).getValues()); } catch (e) {}
      (k === 'route' || k === 'trips' ? G.inp : G.other).push(n);
    }
  });
  return { keep: keep, groups: [
    { title: 'تقارير السيارات (تقرير / ملخص / دورات / زيارات / تنبيهات)', names: G.rep },
    { title: 'تقارير حالة الـ GPS', names: G.stat },
    { title: 'بيانات الإدخال (Routing Points / Trips)', names: G.inp },
    { title: 'شيتات تانية', names: G.other }
  ].filter(function (g) { return g.names.length; }) };
}
function clearAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  const info = sheetGroups_(ss);
  if (!info.keep.length) { ui.alert('مش لاقي أي شيت من الشيتات الثابتة (Coordinates / Devices Naming Connection / Places) فمش هامسح حاجة.'); return; }
  if (!info.groups.length) { ui.alert('مفيش شيتات تتمسح. الموجود بس الشيتات الثابتة:\n- ' + info.keep.join('\n- ')); return; }
  ui.showModalDialog(HtmlService.createHtmlOutput(clearFormHtml_(info)).setWidth(430).setHeight(560), 'مسح الشيتات');
}
// بتتنادى من النافذة. بتتأكد تاني إن مفيش شيت ثابت وسط الأسماء.
function clearSheetsRun(names) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const want = {}; (names || []).forEach(function (n) { want[String(n)] = 1; });
  const del = [], keep = [];
  ss.getSheets().forEach(function (sh) { if (isProtectedSheet_(sh)) keep.push(sh); else if (want[sh.getName()]) del.push(sh); });
  if (!del.length) throw new Error('مفيش شيتات مختارة للمسح.');
  if (!keep.length) throw new Error('مش لاقي الشيتات الثابتة، فمش هامسح حاجة.');
  ss.setActiveSheet(keep[0]);
  del.forEach(function (sh) { ss.deleteSheet(sh); });
  return del.length;
}
function clearFormHtml_(info) {
  const css = 'body{font-family:Arial,sans-serif;margin:14px;color:#222}h4{margin:14px 0 4px;font-size:13px;color:#1f3a5f}' +
    'label.r{display:flex;align-items:center;gap:8px;padding:5px 6px;font-size:14px;border-bottom:1px solid #f2f2f2;cursor:pointer}label.r:hover{background:#f6f9fe}' +
    'input[type=checkbox]{width:16px;height:16px;flex:none}.lk{color:#777;font-size:13px;padding:3px 6px}' +
    '.bar{display:flex;gap:8px;margin-bottom:6px}.bar button{flex:1;margin:0;padding:6px;font-size:13px;background:#e8eaed;color:#222;border:0;border-radius:4px;cursor:pointer}' +
    '.sub{font-size:12px;color:#1a73e8;cursor:pointer;margin-right:6px;font-weight:normal}' +
    '#go{margin-top:14px;width:100%;padding:9px;font-size:15px;background:#c5221f;color:#fff;border:0;border-radius:4px;cursor:pointer}#go:disabled{background:#ccc;cursor:default}' +
    '#cls{margin-top:10px;width:100%;padding:9px;font-size:15px;background:#5f6368;color:#fff;border:0;border-radius:4px;cursor:pointer;display:none}' +
    '#msg{margin-top:10px;font-size:13px;color:#b00;white-space:pre-wrap}#msg.ok{color:#137333;font-weight:bold}#box{max-height:300px;overflow:auto;border:1px solid #eee;border-radius:4px;padding:2px 6px}';
  const body = '<form id="f"><div class="bar"><button type="button" id="all">تحديد الكل</button><button type="button" id="none">إلغاء التحديد</button></div>' +
    '<div id="box"></div>' +
    '<h4>🔒 شيتات ثابتة (مش بتتمسح)</h4><div id="keep"></div>' +
    '<button id="go" type="submit" disabled>مسح</button><div id="msg"></div><button id="cls" type="button">إغلاق</button></form>';
  const js = 'var G=' + JSON.stringify(info.groups) + ',K=' + JSON.stringify(info.keep) + ',armed=false,busy=false;' +
    'function $(i){return document.getElementById(i);}' +
    'function esc(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");}' +
    'function build(){var h="";G.forEach(function(g,gi){h+="<h4>"+esc(g.title)+" <span class=\\"sub\\" data-g=\\""+gi+"\\">(تحديد المجموعة)</span></h4>";g.names.forEach(function(n){h+="<label class=\\"r\\"><input type=\\"checkbox\\" class=\\"c\\" data-g=\\""+gi+"\\" value=\\""+esc(n)+"\\"> "+esc(n)+"</label>";});});$("box").innerHTML=h;' +
    'var k="";K.forEach(function(n){k+="<div class=\\"lk\\">🔒 "+esc(n)+"</div>";});$("keep").innerHTML=k;}' +
    'function boxes(){return Array.prototype.slice.call(document.querySelectorAll(".c"));}' +
    'function sel(){return boxes().filter(function(c){return c.checked;}).map(function(c){return c.value;});}' +
    'function upd(){var n=sel().length;armed=false;$("go").disabled=busy||!n;$("go").textContent=n?"مسح "+n+" شيت":"مسح";}' +
    'build();upd();' +
    'document.addEventListener("change",function(e){if(e.target.classList.contains("c"))upd();});' +
    'document.addEventListener("click",function(e){var g=e.target.getAttribute&&e.target.getAttribute("data-g");if(e.target.className==="sub"){var bs=boxes().filter(function(c){return c.getAttribute("data-g")===g;});var all=bs.every(function(c){return c.checked;});bs.forEach(function(c){c.checked=!all;});upd();}});' +
    '$("all").onclick=function(){boxes().forEach(function(c){c.checked=true;});upd();};$("none").onclick=function(){boxes().forEach(function(c){c.checked=false;});upd();};' +
    '$("cls").onclick=function(){google.script.host.close();};' +
    '$("f").addEventListener("submit",function(e){e.preventDefault();var s=sel();if(!s.length||busy)return;' +
    'if(!armed){armed=true;$("go").textContent="تأكيد: امسح "+s.length+" شيت (اضغط تاني أو Enter)";return;}' +
    'busy=true;$("go").disabled=true;$("go").textContent="جاري المسح…";$("msg").className="";$("msg").textContent="";' +
    'google.script.run.withSuccessHandler(function(n){$("msg").className="ok";$("msg").textContent="تم مسح "+n+" شيت ✔";$("f").querySelector(".bar").style.display="none";$("box").style.display="none";$("go").style.display="none";$("cls").style.display="block";$("cls").focus();})' +
    '.withFailureHandler(function(er){busy=false;armed=false;$("msg").textContent=(er&&er.message)?er.message:String(er);upd();})' +
    '.clearSheetsRun(s);});';
  return '<!DOCTYPE html><html dir="rtl"><head><base target="_top"><meta charset="utf-8"><style>' + css + '</style></head><body>' + body + '<script>' + js + '</script></body></html>';
}

/* ═══════════════ سجل المهام (JOBS) — أي ميزة جديدة = مدخل واحد هنا + سطر في القائمة ═══════════════
   كل مهمة: عنوان النافذة، الحقول (v = رقم السيارة، dates = من/إلى)، خطواتها (بتظهر كقائمة ✓ مع تايمر)، ودالة التنفيذ.
   دالة التنفيذ بتنادي progress_(runId, رقم الخطوة, تفاصيل) وهي بتشتغل. */
const JOBS = {
  file: {
    title: 'إنشاء تقرير النقلات', fields: ['v'], height: 480,
    steps: ['قراءة الشيتات (Routing Points / Trips / الإحداثيات)', 'تحليل الحركة وحساب النقلات', 'إنشاء شيتات التقرير', 'تنظيف شيتات الإدخال'], wFrom: 2,
    run: function (a, id) { return fleetReportRun(a.v, id); }
  },
  platform: {
    title: 'إنشاء تقرير النقلات من المنصة', fields: ['v', 'dates', 'fresh'], height: 650,
    steps: ['البحث عن السيارة في جدول الربط', 'الاتصال بالمنصة والعثور على الجهاز', 'سحب البيانات من المنصة', 'تجهيز النقاط للتحليل', 'فحص حالة جهاز الـ GPS', 'تحليل الحركة وحساب النقلات', 'إنشاء شيتات التقرير'], wFrom: 6,
    run: function (a, id) { return platformReportRun(a.v, a.from, a.to, id, a.fresh); }
  },
  errand: {
    title: 'إنشاء تقرير سيارة من المنصة', fields: ['v', 'dates', 'fresh'], height: 650,
    steps: ['البحث عن السيارة في جدول الربط', 'الاتصال بالمنصة والعثور على الجهاز', 'سحب البيانات من المنصة', 'تجهيز النقاط والأماكن', 'استخراج الزيارات والأماكن', 'إنشاء شيتات التقرير'], wFrom: 5,
    run: function (a, id) { return errandReportRun(a.v, a.from, a.to, id, a.fresh); }
  },
  dash: {
    title: 'تحديث بيانات الداشبورد', fields: [], height: 520, auto: true, doneMsg: 'التحديث خلص (لو فاضل عربيات في التفاصيل شغّله تاني)',
    steps: ['فتح ملف البيانات والاتصال بالمنصة', 'حالة أجهزة الـ GPS (كل العربيات)', 'مشاكل العربيات', 'تحليل عربيات النقل', 'كتابة ملف الداشبورد'], wFrom: 4,
    run: function (a, id) { return dashRefreshRun(id); }
  },
  status: {
    title: 'متابعة حالة ال GPS', fields: [], height: 520, auto: true,
    steps: ['الاتصال بالمنصة', 'سحب قائمة الأجهزة وآخر مواقعها', 'سحب أحداث الاتصال (Online / Offline)', 'تحديد آخر مكان قبل الانقطاع', 'تحليل حالة كل عربية', 'إنشاء تقرير المتابعة'], wFrom: 5,
    run: function (a, id) { return gpsStatusRun(id); }
  }
};

// نقطة دخول واحدة من النافذة لأي مهمة
var EXEC_T0_ = 0;   // وقت بداية التنفيذ الحالي (لحماية حد الـ 6 دقايق)
// إيقاف التشغيل: النافذة بتبعت cancelRun وفي تعليمة في الكاش، والكود بيشوفها بين الخطوات وبين دفعات سحب المنصة (مش بيوقف طلب لسه شغال، لكن بيقف عند أقرب نقطة آمنة). مرحلة كتابة الشيتات مش بتتقطع عشان ما يبقاش فيه تقرير نص مكتوب.
const CANCEL_MSG = 'اتوقف التشغيل بناءً على طلبك.';
var RUN_ID_ = '', WRITE_FROM_ = 999;
function cancelRun(runId) { try { CacheService.getScriptCache().put('cancel_' + runId, '1', 900); } catch (e) {} return true; }
function checkCancel_() {
  if (!RUN_ID_) return;
  let c = false; try { c = !!CacheService.getScriptCache().get('cancel_' + RUN_ID_); } catch (e) {}
  if (c) throw new Error(CANCEL_MSG);
}
function jobRun(jobId, args, runId) {
  const j = JOBS[jobId];
  if (!j) throw new Error('مهمة غير معروفة: ' + jobId);
  EXEC_T0_ = Date.now(); RUN_ID_ = String(runId || ''); WRITE_FROM_ = j.wFrom === undefined ? 999 : j.wFrom;
  // قفل: تشغيلين مع بعض (نافذتين / مستخدمين) كانوا هيكتبوا على نفس الشيتات والكاش
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('LOCKED');
  } catch (e) {
    if (String(e && e.message) === 'LOCKED') throw new Error('فيه تشغيل تاني شغال دلوقتي (من نافذة أو شخص تاني). استنى يخلص وجرب تاني.');
    lock = null;
  }
  try { return j.run(args || {}, runId); }
  finally { if (lock) { try { lock.releaseLock(); } catch (e) {} } }
}
function openJob_(jobId) {
  const j = JOBS[jobId];
  const today = platformDay_(new Date().getTime());
  const html = HtmlService.createHtmlOutput(reportFormHtml_(jobId, today.slice(0, 8) + '01', today)).setWidth(400).setHeight(j.height);
  SpreadsheetApp.getUi().showModalDialog(html, j.title);
}
function runFleetReport() { openJob_('file'); }
function runPlatformReport() { openJob_('platform'); }
function runErrandReport() { openJob_('errand'); }
function runGpsStatus() { openJob_('status'); }

// بتتنادى من النافذة (Enter أو الزرار) — تقرير من الشيتات الملزوقة. runId لتتبع الخطوات.
function fleetReportRun(vehicle, runId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  progress_(runId, 0, '');
  const inputs = readInputs_(ss);
  progress_(runId, 1, '');
  let named = []; try { named = namedLoad_(ss); } catch (e) {}
  const report = buildFleetReport_(inputs.routeValues, inputs.tripValues, inputs.locValues, inputs.tz, cfgFor_(vehicle), named);
  report.vehicle = String(vehicle || '').trim() || report.vehicle || 'السيارة';
  try {   // تعديلاتك المحفوظة من تشغيلات سابقة بتتطبق تلقائي
    const ks = report.days.map(function (d) { return d.dateKey; }).sort();
    if (ks.length) editsOverlayStored_(ss, report, report.vehicle, ks[0], ks[ks.length - 1], inputs.tz);
  } catch (e) {}
  progress_(runId, 2, '');
  writeReport_(ss, report, GPS_CONFIG);
  // مسح صفوف بيانات الجهاز اللي فوق العناوين (Report type / Device / Group / Period…) في شيتي Routing و Trips
  progress_(runId, 3, '');
  [[inputs.routeSheet, inputs.routeValues, ['time', 'latitude', 'longitude']], [inputs.tripsSheet, inputs.tripValues, ['start', 'end']]].forEach(function (x) {
    const h = findHeaderRow_(x[1], x[2]);
    if (h > 0) x[0].deleteRows(1, h);
  });
  progress_(runId, 4, '');   // خلصت كل الخطوات
  return 'ok';
}

/* ─────────────────────── تتبع الخطوات (CacheService) ───────────────────────
   الحالة: {s: رقم الخطوة الجارية, d: تفاصيل كل خطوة, ts: وقت بداية كل خطوة, now}  — النافذة بتسأل عليها كل ثانية */
function progress_(runId, step, detail, frac) {
  if (!runId) return;
  if (step < WRITE_FROM_) checkCancel_();   // بيرمي خطأ لو المستخدم داس إيقاف
  try {
    const c = CacheService.getScriptCache(), k = 'prog_' + runId;
    const raw = c.get(k), st = raw ? JSON.parse(raw) : { s: -1, d: [], ts: [], f: 0 };
    const now = Date.now();
    if (step > st.s) { st.s = step; st.ts[step] = now; st.f = 0; }   // الخطوة بتتقدم بس، ولو رجعت لخطوة قديمة بتحدّث تفاصيلها
    if (detail !== undefined && detail !== null && detail !== '') st.d[step] = detail;
    if (step === st.s && frac !== undefined) st.f = frac;
    c.put(k, JSON.stringify(st), 900);
  } catch (e) {}
}
function getProgress(runId) {
  try {
    const v = CacheService.getScriptCache().get('prog_' + runId);
    if (!v) return null;
    const st = JSON.parse(v); st.now = Date.now(); return st;
  } catch (e) { return null; }
}

/* ─────────────────────── قراءة الشيتات (بالمحتوى) ─────────────────────── */
function readInputs_(ss) {
  const tz = ss.getSpreadsheetTimeZone();
  let route = null, trips = null, loc = null;
  const dups = [];
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    const name = sh.getName();
    if ([GPS_CONFIG.REPORT_PREFIX, GPS_CONFIG.SUMMARY_SHEET, GPS_CONFIG.CYCLES_SHEET,
        GPS_CONFIG.VISITS_SHEET, GPS_CONFIG.ALERTS_SHEET, ERR.PREFIX, ERR.SUMMARY_PREFIX].some(function (p) { return name.indexOf(p) === 0; })) continue;
    if (sh.getLastRow() < 2) continue;
    const head = sh.getRange(1, 1, Math.min(30, sh.getLastRow()), Math.min(20, Math.max(2, sh.getLastColumn()))).getValues();
    const kind = detectSheetKind_(head);
    if (kind === 'route') { if (route) dups.push('Routing Points: "' + route.getName() + '" و "' + name + '"'); route = sh; }
    else if (kind === 'trips') { if (trips) dups.push('Trips Report: "' + trips.getName() + '" و "' + name + '"'); trips = sh; }
    else if (kind === 'locations') loc = sh;
  }
  if (dups.length) throw new Error('فيه أكتر من شيت لنفس النوع (غالباً بقايا سيارة قديمة):\n- ' + dups.join('\n- ') + '\n\nاستخدم القائمة: GPS Tracking System ▸ 🧹 مسح كل الشيتات، وبعدين الصق ملفات السيارة الجديدة.');
  const missing = [];
  if (!route) missing.push('GPS Routing Points (نقاط GPS: أعمدة Time / Latitude / Longitude / Speed)');
  if (!trips) missing.push('GPS Trips Report (الرحلات: أعمدة Start / End / Length)');
  if (!loc) missing.push('ملف إحداثيات المواقع (أول خلية "احداثيات ...")');
  if (missing.length) throw new Error('الملفات دي مش موجودة كشيتات في الملف:\n- ' + missing.join('\n- '));
  return {
    tz: tz,
    routeValues: route.getDataRange().getValues(),
    tripValues: trips.getDataRange().getValues(),
    locValues: loc.getDataRange().getValues(),
    routeSheet: route, tripsSheet: trips
  };
}

function detectSheetKind_(head) {
  for (let r = 0; r < head.length; r++) {
    const a = String(head[r][0]).trim().toLowerCase();
    if (a === 'report type:') {
      const b = String(head[r][1]).trim().toLowerCase();
      if (b === 'route') return 'route';
      if (b === 'trips') return 'trips';
    }
  }
  for (let r = 0; r < head.length; r++) {
    if (normAr_(String(head[r][0])).indexOf('احداثيات') === 0) return 'locations';
  }
  // لو صفوف "Report type" اتمسحت: نتعرف من أسماء الأعمدة
  if (findHeaderRow_(head, ['time', 'latitude', 'longitude']) >= 0) return 'route';
  if (findHeaderRow_(head, ['start', 'end']) >= 0) return 'trips';
  return null;
}
function findHeaderRow_(values, must) {
  for (let r = 0; r < Math.min(values.length, 30); r++) {
    const cells = values[r].map(function (c) { return String(c).trim().toLowerCase(); });
    if (must.every(function (m) { return cells.indexOf(m) >= 0; })) return r;
  }
  return -1;
}

/* ───────────────────────────── أدوات عامة ───────────────────────────── */
function normAr_(s) {
  return String(s).replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
}

// أي قيمة وقت (نص / Date / رقم) ← ثواني "ساعة الحائط" (من غير مشاكل توقيت)
function wallSeconds_(v, tz) {
  if (v === null || v === undefined || v === '') return NaN;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (typeof Utilities === 'undefined') return Math.floor(v.getTime() / 1000);
    return parseWallString_(Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss'));
  }
  if (typeof v === 'number') return Math.round((Date.UTC(1899, 11, 30) + v * 86400000) / 1000);
  return parseWallString_(String(v));
}
function parseWallString_(s) {
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})/.exec(s);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
  m = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/i.exec(s);
  if (m) {
    let h = +m[4];
    if (m[7]) { const pm = m[7].toUpperCase() === 'PM'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return Date.UTC(+m[3], +m[2] - 1, +m[1], h, +m[5], +m[6]) / 1000;
  }
  return NaN;
}
function num_(v) {
  if (typeof v === 'number') return v;
  const m = /-?\d+(\.\d+)?/.exec(String(v).replace(',', '.'));
  return m ? parseFloat(m[0]) : NaN;
}
function p2_(n) { return (n < 10 ? '0' : '') + n; }
function ymd_(t) { const d = new Date(t * 1000); return d.getUTCFullYear() + '-' + p2_(d.getUTCMonth() + 1) + '-' + p2_(d.getUTCDate()); }
function fmtDT_(t) {   // 1/10/2026 04:57:39 PM  (نفس شكل تقرير الـPDF)
  const d = new Date(t * 1000);
  let h = d.getUTCHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return d.getUTCDate() + '/' + (d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' +
    p2_(h) + ':' + p2_(d.getUTCMinutes()) + ':' + p2_(d.getUTCSeconds()) + ' ' + ap;
}
function fmtDur_(sec) {
  sec = Math.max(0, Math.round(sec));
  return Math.floor(sec / 3600) + ' h ' + Math.floor((sec % 3600) / 60) + ' min ' + (sec % 60) + ' s';
}
function fmtDays_(sec) { return Math.floor(sec / 86400) + ' يوم و' + Math.floor((sec % 86400) / 3600) + ' ساعة'; }
function fmtMin_(sec) { return Math.round(sec / 60); }
function dayLabel_(key) { const p = key.split('-'); return (+p[1]) + '/' + (+p[2]); }          // 10/1
function dayLabelFull_(key) { const p = key.split('-'); return (+p[2]) + '/' + (+p[1]) + '/' + p[0]; }
function countText_(n) { return n === 1 ? 'نقلة' : n === 2 ? 'نقلتين' : (n >= 3 && n <= 10) ? n + ' نقلات' : n + ' نقلة'; }

/* ───────────────────────────── تحليل الملفات ───────────────────────────── */
function parseRoute_(values, tz) {
  const h = findHeaderRow_(values, ['time', 'latitude', 'longitude']);
  if (h < 0) throw new Error('مش لاقي صف العناوين (Valid / Time / Latitude…) في ملف Routing Points');
  const idx = headerIndex_(values[h]);
  const need = ['time', 'latitude', 'longitude', 'speed'];
  need.forEach(function (k) { if (idx[k] === undefined) throw new Error('عمود ناقص في Routing Points: ' + k); });
  let device = '';
  for (let i = 0; i < h; i++) if (String(values[i][0]).trim().toLowerCase() === 'device:') device = String(values[i][1]).trim();
  const pts = [];
  let prevT = -Infinity, breaks = 0, cutAt = -1;
  for (let i = h + 1; i < values.length; i++) {
    const r = values[i];
    if (idx.valid !== undefined && (r[idx.valid] === false || String(r[idx.valid]).toLowerCase() === 'false')) continue;
    const t = wallSeconds_(r[idx.time], tz), la = num_(r[idx.latitude]), lo = num_(r[idx.longitude]);
    if (isNaN(t) || isNaN(la) || isNaN(lo)) continue;
    if (t < prevT - 3600) { breaks++; if (cutAt < 0) cutAt = pts.length; }
    prevT = t;
    const sp = num_(r[idx.speed]);
    pts.push({ t: t, lat: la, lon: lo, sp: isNaN(sp) ? 0 : sp, site: -1 });
  }
  let cutRows = 0;
  if (breaks > 0 && breaks <= 5 && cutAt > 0) { cutRows = pts.length - cutAt; pts.length = cutAt; }   // بقايا بيانات قديمة تحت الداتا الجديدة
  pts.sort(function (a, b) { return a.t - b.t; });
  return { device: device, pts: pts, cutRows: cutRows };
}
function parseTrips_(values, tz) {
  const h = findHeaderRow_(values, ['start', 'end']);
  if (h < 0) throw new Error('مش لاقي صف العناوين (Start / End / Length…) في ملف Trips Report');
  const idx = headerIndex_(values[h]);
  const legs = [];
  for (let i = h + 1; i < values.length; i++) {
    const r = values[i];
    const s = wallSeconds_(r[idx.start], tz), e = wallSeconds_(r[idx.end], tz);
    if (isNaN(s) || isNaN(e)) continue;
    const km = idx.length !== undefined ? num_(r[idx.length]) : NaN;
    legs.push({ s: s, e: e, km: isNaN(km) ? 0 : km });
  }
  legs.sort(function (a, b) { return a.s - b.s; });
  return legs;
}
function headerIndex_(row) {
  const o = {};
  for (let c = 0; c < row.length; c++) {
    const k = String(row[c]).trim().toLowerCase();
    if (k && o[k] === undefined) o[k] = c;
  }
  return o;
}
function parseLocations_(values, cfg) {
  const sites = [], warnings = [];
  let cur = null;
  for (let i = 0; i < values.length; i++) {
    const a = values[i][0], b = values[i][1];
    if (typeof a === 'string' && normAr_(a).indexOf('احداثيات') === 0) {
      cur = makeSite_(normAr_(a).replace(/^احداثيات\s*/, '').trim(), cfg, warnings);
      sites.push(cur);
      continue;
    }
    if (cur && a !== '' && b !== '' && !isNaN(num_(a)) && !isNaN(num_(b))) cur.pts.push([num_(a), num_(b)]);
  }
  const out = sites.filter(function (s) { return s.pts.length > 0; });
  out.forEach(function (s) {
    const seen = {}; s.pts = s.pts.filter(function (p) { const k = p[0] + ',' + p[1]; if (seen[k]) return false; seen[k] = 1; return true; });
    let la = 0, lo = 0; s.pts.forEach(function (p) { la += p[0]; lo += p[1]; });
    s.cLat = la / s.pts.length; s.cLon = lo / s.pts.length;
    s.cos = Math.cos(s.cLat * Math.PI / 180);
    const rLat = s.radius / 111320 * 1.05, rLon = rLat / s.cos;
    s.minLat = Math.min.apply(null, s.pts.map(function (p) { return p[0]; })) - rLat;
    s.maxLat = Math.max.apply(null, s.pts.map(function (p) { return p[0]; })) + rLat;
    s.minLon = Math.min.apply(null, s.pts.map(function (p) { return p[1]; })) - rLon;
    s.maxLon = Math.max.apply(null, s.pts.map(function (p) { return p[1]; })) + rLon;
  });
  if (!out.length) throw new Error('ملف المواقع فاضي أو مش بالشكل المتوقع (عناوين "احداثيات ..." وتحتها Latitude/Longitude)');
  return { sites: out, warnings: warnings };
}
function makeSite_(name, cfg, warnings) {
  for (let i = 0; i < cfg.SITES.length; i++) {
    const r = cfg.SITES[i];
    if (r.match.test(name)) return { name: name, label: r.label, role: r.role, radius: r.radius, coreRadius: r.coreRadius || 0, coreMinMin: r.coreMinMin || 0, pts: [] };
  }
  const label = name.replace(/^(موقع|مركز)\s+/, '');
  warnings.push('الموقع "' + name + '" مالوش قاعدة في GPS_CONFIG.SITES — اتعامل كموقع تفريغ (نصف قطر ' + cfg.DEFAULT_SITE.radius + ' م).');
  return { name: name, label: label, role: cfg.DEFAULT_SITE.role, radius: cfg.DEFAULT_SITE.radius, coreRadius: 0, coreMinMin: 0, pts: [] };
}

// تنضيف نقاط GPS اللي بتقفز مسافات مستحيلة (أخطاء إشارة)
function cleanPoints_(pts, sites, cfg) {
  const out = [];
  let last = null, bad = 0, removed = 0;
  pts.forEach(function (p, idx) {
    // عربيات الـ GPS بتاعها بيخرف: بيبعت سرعة (مثلاً 7 كم/س) والإحداثيات ثابتة تماماً = واقفة فعلاً
    if (cfg.FREEZE_FIX && last && p.sp > 0 && p.sp <= 15 && distM_(last.lat, last.lon, p.lat, p.lon) < 15) p.sp = 0;
    let near = Infinity;
    for (let s = 0; s < sites.length; s++) near = Math.min(near, distM_(p.lat, p.lon, sites[s].cLat, sites[s].cLon));
    if (near > cfg.MAX_AREA_KM * 1000) { removed++; return; }
    if (last) {
      const dt = Math.max(p.t - last.t, 1), d = distM_(last.lat, last.lon, p.lat, p.lon);
      if (d > 500 && (d / dt) * 3.6 > cfg.MAX_JUMP_KMH && bad < 20) {
        // قفزة: لو النقطة اللي بعدها راجعة قريبة من آخر نقطة سليمة يبقى دي نقطة شاذة. لو النقطة اللي بعدها قريبة من النقطة الحالية يبقى السيارة فعلاً اتحركت (ومش شاذة)
        const nx = pts[idx + 1];
        let spike = true;
        if (nx) {
          const dn = distM_(p.lat, p.lon, nx.lat, nx.lon), dl = distM_(last.lat, last.lon, nx.lat, nx.lon);
          if (dn < dl) spike = false;
        }
        if (spike) { bad++; removed++; return; }
      }
    }
    bad = 0; out.push(p); last = p;
  });
  return { pts: out, removed: removed };
}

// تحديد الموقع لكل نقطة GPS (أقرب موقع في نطاقه)
function assignSites_(pts, sites) {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    let best = -1, bd = Infinity;
    for (let s = 0; s < sites.length; s++) {
      const S = sites[s];
      if (p.lat < S.minLat || p.lat > S.maxLat || p.lon < S.minLon || p.lon > S.maxLon) continue;
      const r2 = S.radius * S.radius;
      let m = Infinity;
      for (let k = 0; k < S.pts.length; k++) {
        const dy = (p.lat - S.pts[k][0]) * 111320, dx = (p.lon - S.pts[k][1]) * 111320 * S.cos;
        const d2 = dx * dx + dy * dy;
        if (d2 < m) m = d2;
      }
      if (m <= r2 && m < bd) { bd = m; best = s; }
    }
    p.site = best;
    p.d = best >= 0 ? Math.sqrt(bd) : 0;
  }
}
// أقرب موقع من شيت Coordinates → { d (متر), s (الموقع) } أو null
function nearestSite_(lat, lon, sites) {
  let best = null;
  (sites || []).forEach(function (s) {
    for (let i = 0; i < s.pts.length; i++) { const dm = distM_(lat, lon, s.pts[i][0], s.pts[i][1]); if (!best || dm < best.d) best = { d: dm, s: s }; }
  });
  return best;
}
// "على بعد 2.3 كم من الخلاطة" (فاضي لو مفيش مواقع)
function nearTxt_(lat, lon, sites) {
  const b = nearestSite_(lat, lon, sites);
  if (!b) return '';
  const km = b.d / 1000;
  if (km > GPS_STATUS.NEAR_KM) return '';      // أبعد من الحد = منطقة تانية (سوهاج مش بتتقارن بإسكندرية)
  return 'على بعد ' + (km < 0.1 ? '<100 م' : km.toFixed(1) + ' كم') + ' من ' + (b.s.label || b.s.name);
}
function distM_(la1, lo1, la2, lo2) {
  const dy = (la1 - la2) * 111320, dx = (lo1 - lo2) * 111320 * Math.cos(la1 * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

// زيارات المواقع: فترات متصلة جوه نطاق الموقع + (وقوف فعلي) أو (بقاء طويل بسرعة قليلة)
function detectVisits_(pts, sites, cfg) {
  const n = pts.length;
  const dt = new Array(n);
  for (let i = 0; i < n; i++) dt[i] = i < n - 1 ? Math.min(pts[i + 1].t - pts[i].t, cfg.MAX_DT_SEC) : 0;
  const raw = [];
  let i = 0;
  while (i < n) {
    const s = pts[i].site;
    if (s < 0) { i++; continue; }
    let j = i;
    while (j + 1 < n && pts[j + 1].site === s) j++;
    let core = 0, wsp = 0, wsum = 0, stat = 0, streak = 0, sS = 0, bestS = 0, bestE = 0, bestLen = 0;
    for (let k = i; k <= j; k++) {
      wsp += pts[k].sp * dt[k]; wsum += dt[k];
      if (sites[s].coreRadius && pts[k].d <= sites[s].coreRadius) core += dt[k];
      if (pts[k].sp <= cfg.STOP_SPEED_KMH) {
        stat += dt[k];
        if (streak === 0) sS = pts[k].t;
        streak += dt[k];
        if (streak > bestLen) { bestLen = streak; bestS = sS; bestE = pts[k].t + dt[k]; }
      } else streak = 0;
    }
    const dwell = pts[j].t - pts[i].t, mean = wsum > 0 ? wsp / wsum : 0;
    let ok = stat >= cfg.MIN_STOP_MIN * 60 || (dwell >= cfg.MIN_MOVING_DWELL_MIN * 60 && mean <= cfg.MAX_MOVING_MEAN_KMH);
    // الخلاطة: لازم السيارة تدخل فعلاً جوه الخلاطة (مش مجرد وقفة أو مرور على الطريق جنبها)
    if (ok && sites[s].coreRadius && core < sites[s].coreMinMin * 60) ok = false;
    if (ok) raw.push({ site: s, role: sites[s].role, label: sites[s].label, arrive: pts[i].t, depart: pts[j].t,
      meanSp: mean, stopSec: stat, anchorS: bestS, anchorE: bestE, anchorLen: bestLen, synthetic: false });
    i = j + 1;
  }
  const out = [];
  raw.forEach(function (v) {
    const p = out[out.length - 1];
    if (p && p.site === v.site && v.arrive - p.depart <= cfg.MERGE_GAP_MIN * 60) {
      p.depart = v.depart; p.stopSec += v.stopSec;
      if (v.anchorLen > p.anchorLen) { p.anchorS = v.anchorS; p.anchorE = v.anchorE; p.anchorLen = v.anchorLen; }
    } else out.push(v);
  });
  return out;
}

// وقوفات خارج أي موقع معرّف (للتنبيهات ولتسمية الرحلات الخارجية)
function detectUnknownStays_(pts, cfg) {
  const raw = [];
  let i = 0;
  while (i < pts.length) {
    if (pts[i].site >= 0 || pts[i].sp > cfg.STOP_SPEED_KMH) { i++; continue; }
    let j = i;
    while (j + 1 < pts.length && pts[j + 1].site < 0 && pts[j + 1].sp <= cfg.STOP_SPEED_KMH && pts[j + 1].t - pts[j].t <= 3600) j++;
    if (pts[j].t - pts[i].t >= cfg.UNKNOWN_STAY_MIN * 60) {
      let la = 0, lo = 0; for (let k = i; k <= j; k++) { la += pts[k].lat; lo += pts[k].lon; }
      raw.push({ s: pts[i].t, e: pts[j].t, lat: la / (j - i + 1), lon: lo / (j - i + 1) });
    }
    i = j + 1;
  }
  const out = [];
  raw.forEach(function (u) {
    const p = out[out.length - 1];
    if (p && distM_(p.lat, p.lon, u.lat, u.lon) <= cfg.UNKNOWN_CLUSTER_M && u.s - p.e <= 3 * 3600) { p.e = u.e; }
    else out.push({ s: u.s, e: u.e, lat: u.lat, lon: u.lon });
  });
  return out;
}

/* الدورات: كل دورة = من زيارة خلاطة للزيارة اللي بعدها */
function buildCycles_(V) {
  const cycles = [], m = [];
  V.forEach(function (v, i) { if (v.role === 'MIXER') m.push(i); });
  if (!V.length) return cycles;
  if (!m.length) { cycles.push({ a: 0, b: V.length - 1, startsAtMixer: false, open: true }); return cycles; }
  if (m[0] > 0) cycles.push({ a: 0, b: m[0], startsAtMixer: false, open: false });
  for (let j = 0; j < m.length - 1; j++) cycles.push({ a: m[j], b: m[j + 1], startsAtMixer: true, open: false });
  if (m[m.length - 1] < V.length - 1) cycles.push({ a: m[m.length - 1], b: V.length - 1, startsAtMixer: true, open: true });
  if (!cycles.length) cycles.push({ a: 0, b: V.length - 1, startsAtMixer: V[0].role === 'MIXER', open: true });   // زيارة واحدة بس
  return cycles;
}

/* تعريف النقلة: كل تحميل (من الخلاطة أو الكسارة) يتبعه تفريغ في موقع تفريغ */
var DATE_RULE_ = 'LASTU', DAY_START_H_ = 0;
function evalCycle_(V, c) {
  const unl = [];
  let loaded = c.startsAtMixer, count = 0, hasW = false, hasC = false, hasU = false, firstC = null, lastU = null;
  const from = c.startsAtMixer ? c.a + 1 : c.a, to = c.open ? c.b : c.b - 1;
  for (let i = from; i <= to; i++) {
    const v = V[i];
    if (v.role === 'CRUSHER') { hasC = true; if (firstC === null) firstC = v.arrive; loaded = true; }
    else if (v.role === 'UNLOAD') { hasU = true; if (loaded) { count++; loaded = false; lastU = v.arrive; unl.push(v.arrive); } }
    else if (v.role === 'WORKSHOP') { hasW = true; loaded = false; if (c.wArrive === undefined) { c.wArrive = v.arrive; c.wDepart = v.depart; } }
  }
  // دورة مفتوحة (لسه ماوصلتش الخلاطة) من غير ما تعدي على الكسارة: النقلة متكتملش لحد ما ترجع الخلاطة
  if (c.open && !hasC && count > 0) { count = 0; unl.length = 0; c.pending = true; }
  c.unl = unl; c.lastU = lastU; c.count = count; c.hasW = hasW; c.hasC = hasC; c.hasU = hasU; c.firstC = firstC;
  c.kind = count > 0 ? 'NAKLA' : hasW ? 'WORKSHOP' : (!hasC && !hasU) ? 'EXTERNAL' : 'NONE';
  const startT0 = c.startsAtMixer ? V[c.a].depart : V[c.a].arrive;
  const endT0 = c.open ? V[c.b].arrive : V[c.b].arrive;
  let basis = firstC !== null ? firstC : startT0;
  if (DATE_RULE_ === 'END' && !c.open) basis = endT0;
  else if (DATE_RULE_ === 'LASTU' && lastU !== null) {
    basis = lastU;
    // تفريغ بعد نص الليل (قبل بداية يوم الشغل) لدورة بدأت اليوم اللي قبله = من نفس يوم الشغل بتاع بدايتها
    // لو الدورة فيها صيانة فعلية (قعدت في المركز) فالشغل الحقيقي بيبدأ من أول تحميل في الكسارة مش من خروجها من الخلاطة
    const refT = (hasW && firstC !== null) ? firstC : startT0;
    if (DAY_START_H_ > 0 && (lastU % 86400) / 3600 < DAY_START_H_ && ymd_(refT) < ymd_(lastU)) basis = lastU - 86400;
  }
  if (!c.startsAtMixer && !c.open && count === 0 && !hasW) basis = endT0;   // دورة بتبدأ قبل الداتا وبترجع للخلاطة: تاريخ الرجوع
  c.dateKey = ymd_(basis);
  c.splitW = !!(count > 0 && hasW && c.wArrive !== undefined && ymd_(c.wArrive) !== c.dateKey);   // الصيانة اتعملت في يوم غير يوم النقلة: بتتسجل في يومها لوحدها
  c.startT = c.startsAtMixer ? V[c.a].depart : V[c.a].arrive;
  c.endT = c.open ? null : V[c.b].arrive;
  c.path = V.slice(c.a, c.b + 1).map(function (v) { return v.label; }).join(' ← ');
  return c;
}

// إعدادات خاصة بالعربيات الصعبة (HARD_VEHICLES)
function cfgFor_(vehicle) {
  const v = String(vehicle || '').trim();
  if (GPS_CONFIG.HARD_VEHICLES && GPS_CONFIG.HARD_VEHICLES.indexOf(v) >= 0) { const c = {}; Object.keys(GPS_CONFIG).forEach(function (k) { c[k] = GPS_CONFIG[k]; }); c.FREEZE_FIX = true; return c; }
  return GPS_CONFIG;
}

/* ───────────────────── المحرك الرئيسي (دوال نقية بدون Sheets) ───────────────────── */
function buildFleetReport_(routeValues, tripValues, locValues, tz, cfg, named) {
  DATE_RULE_ = cfg.DATE_RULE || 'LASTU';
  DAY_START_H_ = cfg.DAY_START_HOUR || 0;
  const route = parseRoute_(routeValues, tz);
  const legs = parseTrips_(tripValues, tz);
  const loc = parseLocations_(locValues, cfg);
  const cleaned = cleanPoints_(route.pts, loc.sites, cfg);
  const pts = cleaned.pts;
  if (!pts.length) throw new Error('ملف Routing Points مفيهوش نقاط صالحة');
  if (!legs.length) throw new Error('ملف Trips Report مفيهوش رحلات');
  assignSites_(pts, loc.sites);
  // أطوال الرحلات: لو الرقم في ملف الرحلات غير منطقي (عطل في عداد الجهاز) نحسبه من نقاط GPS
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distM_(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon));
  function lowerIdx(t) { let lo = 0, hi = pts.length; while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m].t < t) lo = m + 1; else hi = m; } return lo; }
  const fixedLegs = [], suspectLegs = [];
  legs.forEach(function (lg) {
    const i0 = lowerIdx(lg.s), i1 = Math.min(pts.length - 1, lowerIdx(lg.e + 1) - 1);
    const gps = i1 > i0 ? (cum[i1] - cum[i0]) / 1000 : 0;
    lg.gpsKm = gps;
    // رقم الطول لازم يكون منطقي: مش أقل من المسافة المباشرة بين أول وآخر نقطة، ومش أكتر من (مدة الرحلة × أقصى متوسط سرعة معقول)
    const straight = i1 > i0 ? distM_(pts[i0].lat, pts[i0].lon, pts[i1].lat, pts[i1].lon) / 1000 : 0;
    const hours = Math.max((lg.e - lg.s) / 3600, 1 / 60);
    function sane(k) { return k >= straight * 0.9 - 0.5 && k <= hours * cfg.MAX_AVG_KMH + 1; }
    if (!sane(lg.km)) {
      lg.kmFile = lg.km;
      if (sane(gps)) { lg.km = Math.round(gps * 10) / 10; lg.kmFixed = true; fixedLegs.push(lg); }
      else { lg.kmSuspect = true; suspectLegs.push(lg); }     // الاتنين مش منطقيين: بنسيب رقم الملف ونعمل تنبيه
    }
  });
  let V = detectVisits_(pts, loc.sites, cfg);
  // وقفة قصيرة قدام الخلاطة بين الكسارة والدولي (الخلاطة على نفس الطريق) = مرور، مش رجوع للخلاطة
  V = V.filter(function (v, i, arr) {
    if (v.role !== 'MIXER' || !(i > 0 && i < arr.length - 1)) return true;
    if (arr[i - 1].role !== 'CRUSHER' || arr[i + 1].role !== 'UNLOAD') return true;
    return v.stopSec >= cfg.MIXER_PASS_STOP_MIN * 60;
  });
  // الجراج/مركز الصيانة = عطل بس لو السيارة راحتله مباشرة من الخلاطة. لو معدّية عليه في نص الطريق (محمّلة) بيتعتبر وقفة طريق.
  const droppedW = [];
  V = V.filter(function (v, i, arr) {
    if (v.role !== 'WORKSHOP') return true;
    const shortStay = v.stopSec < (cfg.WORKSHOP_MIN_STAY_MIN || 0) * 60;                                                  // وقفة بسيطة قدام المركز = مش صيانة حتى لو جاية من الخلاطة
    const midRoad = !(i > 0 && arr[i - 1].role === 'MIXER') && v.stopSec < cfg.WORKSHOP_MIN_STOP_MIN * 60;               // معدّية عليه في نص الطريق
    if (shortStay || midRoad) { v.shortStay = shortStay; droppedW.push(v); return false; }
    return true;
  });
  if (!V.length) throw new Error('السيارة ما دخلتش أي موقع معروف (خلاطة / كسارة / تفريغ…) في الفترة دي، فمفيش نقلات تتحسب. راجع الفترة المختارة أو شيت Coordinates.');
  const unknown = detectUnknownStays_(pts, cfg);
  // أماكن غير معروفة اتلاقت في التقرير (بتتسجل في شيت Places عشان تسميها) + الأماكن اللي انت سميتها
  const spots = [];
  unknown.forEach(function (u) { spots.push({ lat: u.lat, lon: u.lon, t: u.s }); });
  function namedAt(lat, lon) {
    let b = null;
    (named || []).forEach(function (n) { const d = distM_(lat, lon, n.lat, n.lon); if (d <= n.r && (!b || d < b.d)) b = { d: d, n: n }; });
    if (!b) return null;
    const nt = nearTxt_(lat, lon, loc.sites);
    return b.n.name + (nt ? ' (' + nt + ')' : '');
  }
  function nearOf(lat, lon) { const nt = nearTxt_(lat, lon, loc.sites); return nt ? ' - ' + nt : ''; }
  function inKnownSite(lat, lon) {
    for (let si = 0; si < loc.sites.length; si++) { const S = loc.sites[si]; for (let k = 0; k < S.pts.length; k++) if (distM_(lat, lon, S.pts[k][0], S.pts[k][1]) <= S.radius) return true; }
    return false;
  }

  // الدورات اللي مفيهاش أي موقع معروف: نسمّي المكان الخارجي (زي محطة النجار) من الوقوفات غير المعرّفة
  let cycles = buildCycles_(V);
  const synth = [];
  cycles.forEach(function (c) {
    if (c.b - c.a > 1 || !c.startsAtMixer) return;
    const t0 = V[c.a].depart, t1 = c.open ? Infinity : V[c.b].arrive;
    unknown.forEach(function (u, ui) {
      if (u.s >= t0 && u.e <= t1) synth.push({ site: -1, role: 'OTHER', label: namedAt(u.lat, u.lon) || 'مكان غير معرّف (' + u.lat.toFixed(4) + ', ' + u.lon.toFixed(4) + ')' + nearOf(u.lat, u.lon),
        arrive: u.s, depart: u.e, meanSp: 0, stopSec: u.e - u.s, anchorS: u.s, anchorE: u.e, anchorLen: u.e - u.s, synthetic: true, lat: u.lat, lon: u.lon });
    });
  });
  if (synth.length) { V = V.concat(synth).sort(function (a, b) { return a.arrive - b.arrive; }); cycles = buildCycles_(V); }
  // خروج من الخلاطة ورجوع ليها من غير ما تقف في أي مكان = مش رحلة، دي لسه واقفة في الخلاطة (غالباً تذبذب إشارة GPS)
  const excursions = [];
  for (let guard = 0; guard < 5000; guard++) {
    const k = cycles.findIndex(function (c) { return c.startsAtMixer && !c.open && c.b === c.a + 1; });
    if (k < 0) break;
    const A = V[cycles[k].a], B = V[cycles[k].b];
    excursions.push({ v: A, from: A.depart, to: B.arrive });
    A.depart = B.depart; A.stopSec += B.stopSec;
    if (B.anchorLen > A.anchorLen) { A.anchorS = B.anchorS; A.anchorE = B.anchorE; A.anchorLen = B.anchorLen; }
    V.splice(cycles[k].b, 1);
    cycles = buildCycles_(V);
  }
  cycles.forEach(function (c, ci) { evalCycle_(V, c); c.id = ci + 1; });
  // رقم الدورة (ID) بيتربط بكل زيارة/رحلة/تنبيه عشان التتبع بين الشيتات
  V.forEach(function (v, i) { v.cycleIds = cycles.filter(function (c) { return i >= c.a && i <= c.b; }).map(function (c) { return c.id; }).join(' / '); });
  // فترات الوقوف الطويلة (العربية مركونة بدون حركة)
  const lastT = pts[pts.length - 1].t, idles = [];
  V.forEach(function (v, i) {
    if (v.depart - v.arrive >= cfg.IDLE_MIN_HOURS * 3600) {
      const id = 'ت' + (idles.length + 1);
      idles.push({ id: id, label: v.label, s: v.arrive, e: v.depart, ongoing: v.depart >= lastT - 900 });
      v.cycleIds = (v.cycleIds ? v.cycleIds + ' / ' : '') + id;
    }
  });
  function cycleAt(t) {
    for (let i = 0; i < cycles.length; i++) if (t >= cycles[i].startT - 60 && (cycles[i].endT === null || t <= cycles[i].endT + 60)) return cycles[i].id;
    return '';
  }

  // الانتقالات بين الزيارات المتتالية (+ بداية/نهاية افتراضية)
  const TR = [];
  TR.push({ from: null, to: V[0], depart: -Infinity, arrive: V[0].arrive, cycle: 0, lead: true });
  const cycleOfT = {};
  cycles.forEach(function (c, ci) { for (let k = c.a; k < c.b; k++) cycleOfT[k] = ci; });
  for (let k = 0; k < V.length - 1; k++) {
    TR.push({ from: V[k], to: V[k + 1], depart: V[k].depart, arrive: V[k + 1].arrive, cycle: cycleOfT[k] !== undefined ? cycleOfT[k] : cycles.length - 1 });
  }
  TR.push({ from: V[V.length - 1], to: null, depart: V[V.length - 1].depart, arrive: Infinity, cycle: cycles.length - 1, trail: true });

  // دورات كل زيارة (الزيارات الداخلية تتبع دورة واحدة، وزيارة الخلاطة بتفصل دورتين)
  const visitCycle = {};
  cycles.forEach(function (c, ci) { for (let k = c.a + 1; k <= (c.open ? c.b : c.b - 1); k++) visitCycle[k] = ci; });
  const tol = cfg.LEG_TOLERANCE_SEC;

  // وصف جزء من المشوار جوه رحلة GPS: كامل / في اتجاه موقع / كمّل لموقع
  function trText(tr, lg) {
    const from = tr.from ? tr.from.label : 'خارج المواقع';
    const started = !!tr.from && tr.depart >= lg.s - tol;
    if (!tr.to) return started ? 'من ' + from + ' (في الطريق)' : 'في الطريق';
    const ended = tr.arrive <= lg.e + tol;
    if (started && ended) return 'من ' + from + ' الي ' + tr.to.label;
    if (started) return 'من ' + from + ' في اتجاه ' + tr.to.label;
    if (ended) return 'في اتجاه ' + tr.to.label + ' الي ' + tr.to.label;
    return 'في اتجاه ' + tr.to.label;
  }
  function visitInside(ts) {
    for (let i = 0; i < V.length; i++) if (ts >= V[i].arrive - tol && ts <= V[i].depart + tol) return i;
    return -1;
  }

  // مدى خروج رحلة عن موقع (أبعد نقطة عن خطوط الموقع) + أطول وقفة جواها
  function legExtent(s, e, siteIdx) {
    const S = loc.sites[siteIdx];
    const i0 = lowerIdx(s), i1 = Math.min(pts.length - 1, lowerIdx(e + 1) - 1);
    let maxD = 0, best = { sec: 0 }, run = null, still = 0, startD = 0, endD = 0;
    if (!S || !S.pts.length) return { maxD: 0, stop: best, stillSec: 0, startD: 0, endD: 0 };
    for (let i = i0; i <= i1; i++) {
      const p = pts[i];
      let m = Infinity;
      for (let k = 0; k < S.pts.length; k++) {
        const dy = (p.lat - S.pts[k][0]) * 111320, dx = (p.lon - S.pts[k][1]) * 111320 * S.cos, d2 = dx * dx + dy * dy;
        if (d2 < m) m = d2;
      }
      if (Math.sqrt(m) > maxD) maxD = Math.sqrt(m);
      if (i === i0) startD = Math.sqrt(m);
      if (i === i1) endD = Math.sqrt(m);
      if (p.sp < cfg.STOP_SPEED_KMH) {
        if (i < i1) still += Math.min(pts[i + 1].t - p.t, cfg.MAX_DT_SEC * 6);
        if (!run) run = { a: p.t, lat: p.lat, lon: p.lon, d: Math.sqrt(m) };
        run.b = p.t;
        if (run.d > 400 && run.b - run.a > best.sec) best = { sec: run.b - run.a, lat: run.lat, lon: run.lon };
      } else run = null;
    }
    return { maxD: maxD, stop: best, stillSec: still, startD: startD, endD: endD };
  }

  const rows = [];
  let ignoredLegs = 0;
  legs.forEach(function (lg) {
    if (lg.km < cfg.IGNORE_LEG_KM) { ignoredLegs++; return; }
    let label = '', internal = false, ci = -1, exc = false, depLeg = -1;
    let vi = -1;
    for (let i = 0; i < V.length; i++) if (lg.s >= V[i].arrive - tol && lg.e <= V[i].depart + tol) { vi = i; break; }
    // رحلة بدايتها أو نهايتها برا نطاق الموقع = وصول للموقع أو مغادرة منه (مش تنقل داخلي)
    if (vi >= 0 && V[vi].site >= 0 && loc.sites[V[vi].site] && loc.sites[V[vi].site].pts.length) {
      const e0 = legExtent(lg.s, lg.e, V[vi].site), R0 = loc.sites[V[vi].site].radius;
      if (e0.startD > R0 || e0.endD > R0) vi = -1;
    }
    if (vi >= 0) {                                  // تنقل داخلي جوه موقع
      internal = true;
      const v = V[vi];
      label = 'تنقل داخلي بين المواقع داخل ' + v.label;
      const ext = v.site >= 0 ? legExtent(lg.s, lg.e, v.site) : null;
      const siteR = loc.sites[v.site] ? loc.sites[v.site].radius : 0;
      const nextC0 = v.role === 'MIXER' && V[vi + 1] ? cycles.findIndex(function (c) { return c.a === vi; }) : -1;
      if (ext && nextC0 >= 0 && ext.maxD > cfg.EXCURSION_M && v.depart - lg.e <= 1800) {   // آخر تحرك قبل ما تسيب الخلاطة فعلاً = بداية الرحلة للموقع اللي بعده
        internal = false; depLeg = nextC0;
        label = 'من ' + v.label + ' في اتجاه ' + V[vi + 1].label + ' (خروج من منطقة الخلاطة)'
          + (ext.stillSec >= 600 ? ' - شامل وقوف ' + fmtMin_(ext.stillSec) + ' دقيقة' : '');
      } else if (ext && ext.maxD > cfg.EXCURSION_M && (v.role === 'MIXER' || ext.maxD > siteR * 0.9) && (ext.stop.sec >= 600 || lg.km >= cfg.EXCURSION_MIN_KM)) {      // خرجت بعيد ورجعت من غير ما توصل لأي موقع = رحلة غير معلومة مش تنقل داخلي
        internal = false; exc = true;
        if (ext.stop.sec >= 600 && !inKnownSite(ext.stop.lat, ext.stop.lon)) spots.push({ lat: ext.stop.lat, lon: ext.stop.lon, t: lg.s });
        label = 'خروج من ' + v.label + ' ورجوع بدون الوصول لأي موقع (رحلة غير معلومة) - أبعد نقطة ' + (ext.maxD / 1000).toFixed(1) + ' كم'
          + (ext.stop.sec >= 600 ? ' - وقفة ' + fmtMin_(ext.stop.sec) + ' دقيقة عند ' + (namedAt(ext.stop.lat, ext.stop.lon) || '(' + ext.stop.lat.toFixed(4) + ', ' + ext.stop.lon.toFixed(4) + ')' + nearOf(ext.stop.lat, ext.stop.lon)) : '');
      }
      if (v.role === 'MIXER') {
        const prevC = cycles.findIndex(function (c) { return c.b === vi; });
        const nextC = cycles.findIndex(function (c) { return c.a === vi; });
        if (prevC >= 0 && nextC >= 0) ci = lg.s >= v.anchorE - 60 ? nextC : prevC;
        else ci = nextC >= 0 ? nextC : prevC;
      } else ci = visitCycle[vi] !== undefined ? visitCycle[vi] : cycles.length - 1;
      if (depLeg >= 0) ci = depLeg;
    } else {
      let list = TR.filter(function (tr) { return isFinite(tr.depart) && tr.depart >= lg.s - tol && tr.depart <= lg.e; });
      if (visitInside(lg.s) < 0) {                  // الرحلة بادية في نص الطريق: نضيف الانتقال الجاري
        const act = TR.filter(function (tr) { return tr.depart <= lg.s && lg.s <= tr.arrive; });
        const cur = act.length ? act[act.length - 1] : null;
        if (cur && list.indexOf(cur) < 0) list.unshift(cur);
      }
      if (!list.length) {                           // احتياطي: أقرب انتقال زمنيًا
        let b = TR[0], bd = Infinity;
        TR.forEach(function (tr) { const d = Math.abs((isFinite(tr.depart) ? tr.depart : tr.arrive) - lg.s); if (d < bd) { bd = d; b = tr; } });
        list = [b];
      }
      label = list.map(function (tr) { return trText(tr, lg); }).join(' - ');
      droppedW.forEach(function (v) { if (v.depart >= lg.s - tol && v.arrive <= lg.e + tol) label += ' (عند ' + v.label + ')'; });
      ci = list[0].cycle;
    }
    rows.push({ s: lg.s, e: lg.e, km: lg.km, kmFixed: !!(lg.kmFixed || lg.kmSuspect), label: label, internal: internal, cycle: ci, cid: ci >= 0 ? ci + 1 : '', exc: exc });
  });

  // التنقلات الداخلية اللي حصلت أثناء وقوف طويل: بتتجمع في صف واحد "تحركات داخل موقع ..."
  let movesKm = 0;
  idles.forEach(function (x) {
    const inner = [];
    x.excs = [];
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].s >= x.s - tol && rows[i].e <= x.e + tol) {
      if (rows[i].internal) inner.unshift(rows.splice(i, 1)[0]);
      else if (rows[i].exc) { rows[i].idleId = x.id; rows[i].cid = x.id; rows[i].cycle = -1; x.excs.push(rows[i]); }
    }
    if (inner.length) {
      x.moves = { n: inner.length, s: inner[0].s, e: inner[inner.length - 1].e,
        km: Math.round(inner.reduce(function (a, r) { return a + r.km; }, 0) * 10) / 10, fixed: inner.some(function (r) { return r.kmFixed; }) };
      movesKm += x.moves.km;
    }
  });

  // التجميع اليومي (تاريخ الدورة = تاريخ أول تحميل من الكسارة، أو خروج الخلاطة لو مفيش كسارة)
  const days = {};
  function day(key) { return days[key] || (days[key] = { key: key, dateKey: key.split('#')[0], rows: [], cycles: [] }); }
  // الرحلات الخارجية/الصيانة بتتعرض في بلوك منفصل عن النقلات (زي التقرير اليدوي)
  function blockKey(c) { return (c.kind === 'NAKLA' || c.kind === 'NONE') ? c.dateKey : c.dateKey + '#' + c.id; }
  cycles.forEach(function (c, ci) { c.id = ci + 1; day(blockKey(c)).cycles.push(c); if (c.splitW) c.wKey = ymd_(c.wArrive) + '#m' + c.id; });
  rows.forEach(function (r) {
    if (r.idleId) return;
    const cy = r.cycle >= 0 ? cycles[r.cycle] : null;
    let key = cy ? blockKey(cy) : ymd_(r.s);
    if (cy && cy.splitW && r.s < cy.wDepart - 60) { key = cy.wKey; const md = day(key); md.maint = cy; }   // رحلات الصيانة (قبل الخروج من المركز) في بلوك يوم الصيانة
    r.dayKey = key; day(key).rows.push(r);
  });
  idles.forEach(function (x) {
    const d = day(ymd_(x.s) + '#' + x.id);
    d.idle = x;
    d.rows.push({ s: x.s, e: x.e, km: 0, kmFixed: false, internal: false, cycle: -1, cid: x.id,
      label: 'وقوف في ' + x.label + ' بدون نقلات (' + fmtDays_(x.e - x.s) + ')' + (x.ongoing ? ' - حتى اليوم' : '') });
    (x.excs || []).forEach(function (r) { d.rows.push(r); });
    if (x.moves) d.rows.push({ s: x.moves.s, e: x.moves.e, km: x.moves.km, kmFixed: x.moves.fixed, internal: false, cycle: -1, cid: x.id,
      label: 'تحركات داخل موقع ' + x.label + ' (' + x.moves.n + ' رحلة صغيرة)' });
  });
  const dayList = Object.keys(days).map(function (k) {
    const d = days[k];
    d.rows.sort(function (a, b) { return a.s - b.s; });
    if (d.idle) {
      d.nakla = 0; d.text = 'وقوف بدون نقلات'; d.cycleIds = d.idle.id; d.km = d.rows.reduce(function (a, r) { return a + r.km; }, 0); d.internalCount = d.idle.moves ? d.idle.moves.n : 0; d.kmFixedCount = d.rows.filter(function (r) { return r.kmFixed; }).length;
      d.notes = ['العربية واقفة ' + fmtDays_(d.idle.e - d.idle.s)];
      return d;
    }
    if (d.maint) {
      d.nakla = 0; d.text = 'رحلة صيانة'; d.cycleIds = d.maint.id; d.km = d.rows.reduce(function (a, r) { return a + r.km; }, 0);
      d.internalCount = d.rows.filter(function (r) { return r.internal; }).length; d.notes = ['رحلة صيانة (جراج / مركز ال سعفان) — والنقلة اللي بعدها اتحسبت على يوم ' + d.maint.dateKey];
      d.kmFixedCount = d.rows.filter(function (r) { return r.kmFixed; }).length;
      return d;
    }
    d.nakla = d.cycles.reduce(function (s, c) { return s + c.count; }, 0);
    const parts = [];
    if (d.nakla > 0) parts.push(countText_(d.nakla));
    d.cycles.forEach(function (c) {
      let p = null;
      if (c.kind === 'EXTERNAL') p = 'رحلة';
      else if (c.kind === 'WORKSHOP') p = 'رحلة';
      else if (c.kind === 'NAKLA' && c.hasW && !c.splitW) p = 'رحلة صيانة';
      else if (c.kind === 'NONE') p = (!c.startsAtMixer && !c.open) ? 'رجوع للخلاطة' : 'بدون نقلة مكتملة';
      if (c.open) p = (c.kind === 'NONE' || c.kind === 'EXTERNAL') ? 'دورة جارية' : (p ? p + ' - ' : '') + 'دورة جارية';
      if (p && parts.indexOf(p) < 0) parts.push(p);
    });
    d.text = parts.join(' + ') || '-';
    d.cycleIds = d.cycles.map(function (c) { return c.id; }).join(' / ');
    d.km = d.rows.reduce(function (s, r) { return s + r.km; }, 0);
    d.internalCount = d.rows.filter(function (r) { return r.internal; }).length;
    d.notes = [];
    d.cycles.forEach(function (c) {
      if (c.kind === 'WORKSHOP') d.notes.push('رحلة صيانة (جراج / مركز ال سعفان)');
      if (c.hasW && c.count > 0 && !c.splitW) d.notes.push('مرّت على الجراج/مركز ال سعفان خلال الدورة');
    });
    d.kmFixedCount = d.rows.filter(function (r) { return r.kmFixed; }).length;
    return d;
  }).sort(function (a, b) {
    return (a.rows.length ? a.rows[0].s : a.cycles[0].startT) - (b.rows.length ? b.rows[0].s : b.cycles[0].startT);
  });

  // تنبيهات (كل تنبيه مربوط برقم الدورة)
  const alerts = [];
  function note(text, cyc) { alerts.push({ type: 'تنبيه', note: text, cycle: cyc === undefined ? '' : cyc }); }
  loc.warnings.forEach(function (w) { note(w, ''); });
  unknown.filter(function (u) { return u.e - u.s >= cfg.LONG_UNKNOWN_STAY_MIN * 60; }).forEach(function (u) {
    alerts.push({ type: 'وقوف طويل خارج المواقع', from: u.s, to: u.e, min: fmtMin_(u.e - u.s), lat: u.lat, lon: u.lon, cycle: cycleAt(u.s),
      note: namedAt(u.lat, u.lon) ? 'مكان مسمّى في شيت ' + NAMED.SHEET + ': ' + namedAt(u.lat, u.lon) : (nearTxt_(u.lat, u.lon, loc.sites) ? nearTxt_(u.lat, u.lon, loc.sites) + ' — ' : '') + 'لو ده موقع شغل فعلي ضيفه في ملف المواقع، لو استراحة في الطريق تجاهله. (اتسجل في شيت ' + NAMED.SHEET + ' عشان تسميه)' });
  });
  fixedLegs.forEach(function (lg) {
    const row = rows.filter(function (r) { return r.s === lg.s; })[0];
    note('رحلة ' + fmtDT_(lg.s) + ': الطول في ملف الرحلات (' + lg.kmFile + ' km) غير منطقي، اتحسب من نقاط GPS = ' + lg.km + ' km (اتلوّن بالأحمر في التقرير).', row ? row.cid : '');
  });
  suspectLegs.forEach(function (lg) {
    const row = rows.filter(function (r) { return r.s === lg.s; })[0];
    note('رحلة ' + fmtDT_(lg.s) + ': الطول في ملف الرحلات (' + lg.kmFile + ' km) غير منطقي ونقاط GPS نفسها مش موثوقة للرحلة دي (' + Math.round(lg.gpsKm * 10) / 10 + ' km)، فاتساب رقم الملف. راجعها يدوياً.', row ? row.cid : '');
  });
  if (route.cutRows) note('اتشالت ' + route.cutRows + ' صف في آخر شيت Routing Points لأن الوقت بيرجع لورا (بيانات قديمة متبقية تحت الداتا الجديدة). امسح الشيتات قبل اللصق.', '');
  if (cleaned.removed) note(cleaned.removed + ' نقطة GPS غلط (قفزة مسافة مستحيلة) اتشالت قبل التحليل.', '');
  if (ignoredLegs) note(ignoredLegs + ' رحلة GPS أقل من ' + cfg.IGNORE_LEG_KM + ' كم اتشالت من التقرير (تذبذب إشارة).', '');
  droppedW.forEach(function (v) {
    note(v.shortStay
      ? 'السيارة وقفت قدام ' + v.label + ' يوم ' + fmtDT_(v.arrive) + ' ' + Math.round(v.stopSec / 60) + ' دقيقة بس (أقل من ' + cfg.WORKSHOP_MIN_STAY_MIN + ') فاتعتبرت وقفة طريق مش رحلة صيانة.'
      : 'السيارة وقفت عند ' + v.label + ' يوم ' + fmtDT_(v.arrive) + ' أثناء الطريق (مش جاية من الخلاطة) فاتعتبرت وقفة طريق مش عطل.', cycleAt(v.arrive));
  });
  if (cfg.FREEZE_FIX) {   // عربيات الـ GPS بتاعها بيخرف: انقطاع الإشارة الطويل بيتسجّل عشان نعرف إن اللي جواه تقديري
    for (let gi = 1; gi < pts.length; gi++) {
      const gap = pts[gi].t - pts[gi - 1].t;
      if (gap >= 5400 && distM_(pts[gi - 1].lat, pts[gi - 1].lon, pts[gi].lat, pts[gi].lon) > 1000) note('إشارة الـ GPS اتقطعت من ' + fmtDT_(pts[gi - 1].t) + ' إلى ' + fmtDT_(pts[gi].t) + ' (' + fmtDur_(gap) + '). كانت عند ' + (nearTxt_(pts[gi - 1].lat, pts[gi - 1].lon, loc.sites) || (pts[gi - 1].lat.toFixed(4) + ', ' + pts[gi - 1].lon.toFixed(4))) + ' وبعد الانقطاع ظهرت عند ' + (nearTxt_(pts[gi].lat, pts[gi].lon, loc.sites) || (pts[gi].lat.toFixed(4) + ', ' + pts[gi].lon.toFixed(4))) + '. اللي حصل في الفترة دي (وقوف ولا حركة) تقديري.', cycleAt(pts[gi - 1].t));
    }
  }
  idles.forEach(function (x) {
    note('العربية واقفة في ' + x.label + ' من ' + fmtDT_(x.s) + ' إلى ' + (x.ongoing ? 'آخر الداتا' : fmtDT_(x.e)) + ' (' + fmtDays_(x.e - x.s) + ') بدون أي نقلة — ممكن مفيش سواق متعيّن أو عطل كبير.', x.id);
  });
  excursions.forEach(function (x) {
    note('السيارة خرجت من نطاق الخلاطة ' + fmtDT_(x.from) + ' ورجعت ' + fmtDT_(x.to) + ' من غير ما تقف في أي مكان 30 دقيقة أو أكتر، فاتعتبرت لسه واقفة في الخلاطة (غالباً تذبذب إشارة GPS). رحلات GPS بالفترة دي ظاهرة كتنقل داخلي.', x.v.cycleIds);
  });
  cycles.forEach(function (c) {
    if (c.open) note('الدورة رقم ' + c.id + ' لسه مفتوحة في آخر الداتا (السيارة لسه ماوصلتش الخلاطة): ' + c.path, c.id);
  });
  const unassigned = rows.filter(function (r) { return r.cycle < 0; }).length;
  if (unassigned) note(unassigned + ' رحلة معرفتش أربطها بدورة.', '');
  const m = /(?:^|[^\d])(\d{3,4})(?!\d)/.exec(route.device) || /^\s*(\d+)/.exec(route.device);   // رقم السيارة (3-4 أرقام) من اسم الجهاز

  return {
    vehicle: m ? m[1] : (route.device || ''),
    device: route.device,
    spots: spots,
    quality: { jumps: cleaned.removed, tinyLegs: ignoredLegs, fixedLegs: fixedLegs.length, suspectLegs: suspectLegs.length },
    days: dayList, cycles: cycles, idles: idles, droppedW: droppedW, visits: V, rows: rows, alerts: alerts,
    from: legs[0].s, to: legs[legs.length - 1].e,
    totalNakla: cycles.reduce(function (s, c) { return s + c.count; }, 0),
    totalKm: rows.reduce(function (s, r) { return s + r.km; }, 0) + movesKm
  };
}

/* تقليص التقرير على الفترة المطلوبة بس (التحليل بيتم على فترة أوسع بيوم قبل وبعد عشان نقلة بدأت قبل أول يوم أو خلصت بعد آخر يوم تتحسب صح) */
function trimReport_(rep, fromKey, toKey) {
  const inR = function (k) { return k >= fromKey && k <= toKey; };
  const days = rep.days.filter(function (d) { return inR(d.dateKey); });
  const kept = {};
  const idsOf = function (x) { return String(x === undefined || x === null ? '' : x).split(' / ').filter(function (y) { return y; }); };
  days.forEach(function (d) { idsOf(d.cycleIds).forEach(function (i) { kept[i] = 1; }); });
  const anyKept = function (x) { return idsOf(x).some(function (i) { return kept[i]; }); };
  rep.days = days;
  rep.cycles = rep.cycles.filter(function (c) { return inR(c.dateKey); });
  rep.idles = (rep.idles || []).filter(function (x) { return kept[x.id]; });
  rep.visits = rep.visits.filter(function (v) { return v.cycleIds ? anyKept(v.cycleIds) : inR(ymd_(v.arrive)); });
  rep.alerts = rep.alerts.filter(function (a) {
    if (a.from !== undefined) return inR(ymd_(a.from));
    return idsOf(a.cycle).length ? anyKept(a.cycle) : true;
  });
  rep.spots = (rep.spots || []).filter(function (x) { return inR(ymd_(x.t)); });
  rep.totalNakla = rep.cycles.reduce(function (s, c) { return s + c.count; }, 0);
  rep.totalKm = days.reduce(function (s, d) { return s + d.km; }, 0);
  return rep;
}
function shiftDay_(key, n) { const p = key.split('-'); return ymd_(Date.UTC(+p[0], +p[1] - 1, +p[2] + n) / 1000); }

/* ───────────────────────────── كتابة التقرير ───────────────────────────── */
// الشيت الجديد 1000 صف بس — لو التقرير أطول نزوّد الصفوف (غير كده setValues بيرمي خطأ)
function ensureGrid_(sh, rows, cols) {
  const mr = sh.getMaxRows(), mc = sh.getMaxColumns();
  if (mr < rows) sh.insertRowsAfter(mr, rows - mr);
  if (cols && mc < cols) sh.insertColumnsAfter(mc, cols - mc);
}
function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (sh) { sh.clear(); const m = sh.getMaxRows(); if (sh.getMaxRows() > 1) { try { sh.getRange(1, 1, m, sh.getMaxColumns()).breakApart(); } catch (e) {} } }
  else sh = ss.insertSheet(name);
  return sh;
}

// كل التقارير (الحالية والجاية): المحاذاة أفقيًا في النص. أي دالة كتابة تقرير جديدة تنادي centerSheet_(sh) في آخرها
function centerSheet_(sh) {
  try {
    const lr = sh.getLastRow(), lc = sh.getLastColumn();
    if (lr > 0 && lc > 0) sh.getRange(1, 1, lr, lc).setHorizontalAlignment('center');
  } catch (e) {}
}

// اسم آمن لتبويب الشيت (من غير رموز ممنوعة وبطول معقول)
function safeVeh_(v) { return String(v === undefined || v === null ? '' : v).replace(/[\[\]*?:\/\\]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 40) || 'السيارة'; }

function writeReport_(ss, rep, cfg) {
  rep.vehicle = safeVeh_(rep.vehicle);
  try { if (rep.spots && rep.spots.length) namedRegister_(ss, rep.spots.map(function (x) { return { lat: x.lat, lon: x.lon, vehicle: rep.vehicle }; }), Date.now()); } catch (e) {}   // الأماكن غير المعروفة → شيت Places
  writeMainSheet_(ss, rep, cfg);
  writeSummary_(ss, rep, cfg);
  writeCycles_(ss, rep, cfg);
  writeVisits_(ss, rep, cfg);
  writeAlerts_(ss, rep, cfg);
  ss.setActiveSheet(ss.getSheetByName(cfg.REPORT_PREFIX + (rep.vehicle || 'السيارة')));
}

function writeMainSheet_(ss, rep, cfg) {
  const name = cfg.REPORT_PREFIX + (rep.vehicle || 'السيارة');
  const sh = getOrCreateSheet_(ss, name);
  const BLUE = '#3d85c6', ORANGE = '#e69138';
  // العمود A = رقم الدورة (نفس الرقم في كل الشيتات)
  const header = ['# الدورة', 'Start', 'End', 'Duration', 'Length', 'خط سير ( ' + rep.vehicle + ' )', 'gps', 'التاريخ', 'ملاحظات', 'توقيع (داخلي)'];
  const table = [header];
  const blocks = [];                       // بلوكات الوصف المدموجة
  const dayBlocks = [];                    // بلوك كل يوم
  const internalRows = [], fixedRows = [];
  let r = 2;
  rep.days.forEach(function (d, di) {
    if (!d.rows.length) return;
    if (di > 0 && table.length > 1) { table.push(['', '', '', '', '', '', '', '', '', '']); r++; }
    // التوقيع الداخلي (عمود مخفي J): بصمة الشكل الأصلي المتولّد للبلوك — بيستخدمها "تطبيق تعديلاتي" عشان يعرف إيه اللي اتعدّل ويحفظه
    const dSig = d.sig !== undefined ? d.sig : editsSigOfDay_(d);
    const r0 = r;
    let blockStart = r, blockLabel = null;
    d.rows.forEach(function (x, i) {
      table.push([x.cid, fmtDT_(x.s), fmtDT_(x.e), fmtDur_(x.e - x.s), x.km, x.label, i === 0 ? d.text : '', i === 0 ? dayLabel_(d.dateKey) : '', i === 0 ? (d.userNote || '') : '', i === 0 ? dSig : '']);
      if (x.internal) internalRows.push(r);
      if (x.kmFixed) fixedRows.push(r);
      if (blockLabel === null) { blockLabel = x.label; blockStart = r; }
      else if (x.label !== blockLabel) { blocks.push({ r0: blockStart, r1: r - 1 }); blockLabel = x.label; blockStart = r; }
      r++;
    });
    blocks.push({ r0: blockStart, r1: r - 1 });
    dayBlocks.push({ r0: r0, r1: r - 1 });
  });
  ensureGrid_(sh, table.length + 1, 10);
  sh.getRange(1, 1, table.length, 1).setNumberFormat('@');
  sh.getRange(1, 2, table.length, 2).setNumberFormat('@');   // Start / End نص (عشان Sheets ما يقلبش اليوم والشهر)
  sh.getRange(1, 8, table.length, 3).setNumberFormat('@');   // التاريخ / ملاحظات / التوقيع
  sh.getRange(1, 1, table.length, 10).setValues(table);
  // التنسيق
  sh.getRange(1, 1, 1, 5).setBackground(BLUE).setFontColor('#ffffff');
  sh.getRange(1, 6, 1, 4).setBackground(ORANGE).setFontColor('#ffffff');
  sh.getRange(1, 1, 1, 9).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(2, 1, table.length - 1, 9).setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  sh.getRange(2, 6, table.length - 1, 1).setWrap(true);
  sh.getRange(2, 9, table.length - 1, 1).setWrap(true);
  sh.getRange(2, 5, table.length - 1, 1).setNumberFormat('0.0 "km"');
  sh.setColumnWidth(1, 75); sh.setColumnWidths(2, 2, 175); sh.setColumnWidth(4, 130); sh.setColumnWidth(5, 85);
  sh.setColumnWidth(6, 330); sh.setColumnWidth(7, 120); sh.setColumnWidth(8, 85); sh.setColumnWidth(9, 220);
  try { sh.hideColumns(10); } catch (e) {}
  // كل التنسيقات المتشابهة بتتبعت مرة واحدة (RangeList) بدل طلب لكل صف — أسرع بكتير
  if (dayBlocks.length) sh.getRangeList(dayBlocks.map(function (b) { return 'A' + b.r0 + ':I' + b.r1; })).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  dayBlocks.forEach(function (b) { if (b.r1 > b.r0) sh.getRange(b.r0, 7, b.r1 - b.r0 + 1, 3).mergeVertically(); });   // أعمدة gps / بيان الخلاطة / التاريخ مع بعض
  blocks.forEach(function (b) { if (b.r1 > b.r0) sh.getRange(b.r0, 6, b.r1 - b.r0 + 1, 1).merge(); });
  if (internalRows.length) sh.getRangeList(internalRows.map(function (rr) { return 'A' + rr + ':F' + rr; })).setBackground('#fff2cc');
  if (fixedRows.length) sh.getRangeList(fixedRows.map(function (rr) { return 'E' + rr; })).setFontColor('#cc0000');
  sh.setFrozenRows(1); centerSheet_(sh);
}

function writeSummary_(ss, rep, cfg) {
  const sh = getOrCreateSheet_(ss, cfg.SUMMARY_SHEET + ' ' + rep.vehicle);
  let stm = null; try { stm = statementsLoad_(ss, rep.vehicle); } catch (e) { stm = null; }   // بيان الخلاطة / بيان الجراج (شيتات مخفية)
  const NC = 12;   // العمود 10 = الحالة (مطابقة نقلات بيان الخلاطة مع التقرير)، العمود 12 مخفي: ملاحظات المنظومة (من غير ملاحظاتك) — بيستخدمها "تطبيق تعديلاتي" عشان ملاحظاتك ماتتكررش
  const t = [['# الدورة', 'التاريخ', 'عدد النقلات', 'البيان', 'بيان الخلاطة', 'بيان الجراج', 'عدد الرحلات (صفوف GPS)', 'تنقلات داخلية', 'إجمالي المسافة (km)', 'الحالة', 'ملاحظات', 'ملاحظات المنظومة (داخلي)']];
  rep.days.forEach(function (d) {
    const sx = stm ? statementsFor_(stm, d.dateKey) : null;
    const sysArr = (d.notes || []).slice();
    if (sx) sx.notes.forEach(function (n) { if (sysArr.indexOf(n) < 0) sysArr.push(n); });
    // بيان الخلاطة وبيان الجراج دايماً من شيتات البيان بس (مالهمش علاقة بالتعديلات اليدوية)
    const mixerTxt = (sx && sx.mixer) || '', garageTxt = (sx && sx.garage) || '';
    const sys = sysArr.join(' | ');
    const all = sysArr.concat(d.userNote ? [d.userNote] : []).join(' | ');
    const stCount = sx ? sx.mixerCount : '';
    const status = (stCount !== '' && stCount !== undefined) ? (Number(stCount) === Number(d.nakla) ? 'تطابق ✔' : 'غير متطابق ❌') : '';
    t.push([d.cycleIds, dayLabelFull_(d.dateKey), d.nakla, d.text, mixerTxt, garageTxt, d.rows.length, d.internalCount, Math.round(d.km * 10) / 10, status, all, sys]);
  });
  t.push(['', 'الإجمالي', rep.totalNakla, '', '', '', rep.days.reduce(function (a, d) { return a + d.rows.length; }, 0), rep.days.reduce(function (a, d) { return a + d.internalCount; }, 0), Math.round(rep.totalKm * 10) / 10, '', '', '']);
  ensureGrid_(sh, t.length + 1, NC);
  sh.getRange(1, 1, t.length, 2).setNumberFormat('@');
  sh.getRange(1, 1, t.length, NC).setValues(t);
  sh.getRange(1, 1, 1, 11).setBackground('#3d85c6').setFontColor('#ffffff').setFontWeight('bold');
  sh.getRange(t.length, 1, 1, 11).setFontWeight('bold').setBackground('#f3f3f3');
  sh.getRange(1, 1, t.length, 11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(2, 4, t.length - 1, 3).setWrap(true);
  sh.getRange(2, 11, t.length - 1, 1).setWrap(true);
  if (t.length > 2) sh.getRange(2, 10, t.length - 2, 1).setFontColors(t.slice(1, t.length - 1).map(function (r) { return [String(r[9]).indexOf('❌') >= 0 ? '#cc0000' : (String(r[9]).indexOf('✔') >= 0 ? '#137333' : '#000000')]; }));
  sh.setColumnWidths(1, 11, 130); sh.setColumnWidth(1, 90); sh.setColumnWidth(4, 200); sh.setColumnWidths(5, 2, 150); sh.setColumnWidth(10, 110); sh.setColumnWidth(11, 320);
  try { sh.showColumns(1, 11); sh.hideColumns(12); } catch (e) {}
  sh.setFrozenRows(1); centerSheet_(sh);
}

// أول/آخر صف لكل دورة (من صفوف الأيام)
function cycleAnchors_(rep) {
  const anc = {};
  (rep.days || []).forEach(function (d) { d.rows.forEach(function (x) {
    const k = String(x.cid); if (k === '' || x.cid === undefined) return;
    const a = anc[k] || (anc[k] = { f: x.s, l: x.e });
    if (x.s < a.f) a.f = x.s; if (x.e > a.l) a.l = x.e;
  }); });
  return anc;
}
// صفوف شيت الدورات المتولّدة (دورات + وقوفات طويلة) بترتيب الوقت
function generatedCycleItems_(rep) {
  const kindTxt = { NAKLA: 'نقلة', WORKSHOP: 'رحلة صيانة (جراج / مركز ال سعفان)', EXTERNAL: 'رحلة خارجية', NONE: 'بدون نقلة مكتملة' };
  return rep.cycles.map(function (c) {
    return { t: c.startT, row: [c.id, dayLabelFull_(c.dateKey), fmtDT_(c.startT), c.endT === null ? 'لسه (دورة جارية)' : fmtDT_(c.endT), c.path, c.count,
      kindTxt[c.kind] + (c.open ? ' - جارية' : '')] };
  }).concat((rep.idles || []).map(function (x) {
    return { t: x.s, row: [x.id, dayLabelFull_(ymd_(x.s)), fmtDT_(x.s), x.ongoing ? 'لسه (حتى اليوم)' : fmtDT_(x.e), x.label + ' (وقوف ' + fmtDays_(x.e - x.s) + ')', 0, 'وقوف بدون نقلات'] };
  })).sort(function (a, b) { return a.t - b.t; });
}

function writeCycles_(ss, rep, cfg) {
  const sh = getOrCreateSheet_(ss, cfg.CYCLES_SHEET + ' ' + rep.vehicle);
  const kindTxt = { NAKLA: 'نقلة', WORKSHOP: 'رحلة صيانة (جراج / مركز ال سعفان)', EXTERNAL: 'رحلة خارجية', NONE: 'بدون نقلة مكتملة' };
  // أول/آخر صف لكل دورة في شيت التقرير (عمودين مخفيين): بيتستخدموا بعدين في "تطبيق تعديلاتي" عشان نعرف التعديل اليدوي غيّر الأوقات قد إيه
  const anc = cycleAnchors_(rep);
  const withAnc = function (row) { const a = anc[String(row[0])]; return row.slice(0, 7).concat(a ? [a.f, a.l] : ['', '']); };
  const items = rep.rawCycleRows ? rep.rawCycleRows.slice().sort(function (a, b) { return a.t - b.t; }) : generatedCycleItems_(rep);
  const t = [['# الدورة', 'تاريخ النقلة', 'خروج من الخلاطة', 'رجوع للخلاطة', 'مسار الزيارات', 'عدد النقلات', 'النوع', 'أول صف (داخلي)', 'آخر صف (داخلي)']];
  items.forEach(function (it) { t.push(it.anchors ? it.row.slice(0, 7).concat(it.anchors) : withAnc(it.row)); });
  ensureGrid_(sh, t.length + 1, 9);
  sh.getRange(1, 1, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 2, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 3, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 4, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 1, t.length, 9).setValues(t);
  sh.getRange(1, 1, 1, 7).setBackground('#3d85c6').setFontColor('#ffffff').setFontWeight('bold');
  sh.getRange(1, 1, t.length, 7).setHorizontalAlignment('center');
  sh.setColumnWidth(1, 75); sh.setColumnWidths(2, 3, 160); sh.setColumnWidth(5, 520); sh.setColumnWidth(6, 90); sh.setColumnWidth(7, 220);
  try { sh.hideColumns(8, 2); } catch (e) {}
  sh.setFrozenRows(1); centerSheet_(sh);
}

function writeVisits_(ss, rep, cfg) {
  const sh = getOrCreateSheet_(ss, cfg.VISITS_SHEET + ' ' + rep.vehicle);
  const t = [['# الدورة', 'الموقع', 'وصول (دخول النطاق)', 'مغادرة', 'المدة (دقيقة)', 'دقايق وقوف', 'متوسط السرعة (km/h)']];
  rep.visits.forEach(function (v) {
    t.push([v.cycleIds, v.label, fmtDT_(v.arrive), fmtDT_(v.depart), fmtMin_(v.depart - v.arrive), fmtMin_(v.stopSec), Math.round(v.meanSp)]);
  });
  ensureGrid_(sh, t.length + 1, 7);
  sh.getRange(1, 1, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 3, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 4, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 1, t.length, 7).setValues(t);
  sh.getRange(1, 1, 1, 7).setBackground('#3d85c6').setFontColor('#ffffff').setFontWeight('bold');
  sh.getRange(1, 1, t.length, 7).setHorizontalAlignment('center');
  sh.setColumnWidth(1, 90); sh.setColumnWidth(2, 260); sh.setColumnWidths(3, 2, 175); sh.setColumnWidths(5, 3, 130);
  sh.setFrozenRows(1); centerSheet_(sh);
}

function writeAlerts_(ss, rep, cfg) {
  const sh = getOrCreateSheet_(ss, cfg.ALERTS_SHEET + ' ' + rep.vehicle);
  const t = [['# الدورة', 'النوع', 'من', 'إلى', 'المدة (دقيقة)', 'الموقع على الخريطة', 'ملاحظة']];
  rep.alerts.forEach(function (a) {
    if (a.lat === undefined) t.push([a.cycle, a.type, '', '', '', '', a.note]);
    else t.push([a.cycle, a.type, fmtDT_(a.from), fmtDT_(a.to), a.min,
      '=HYPERLINK("https://www.google.com/maps?q=' + a.lat.toFixed(6) + ',' + a.lon.toFixed(6) + '","' + a.lat.toFixed(4) + ', ' + a.lon.toFixed(4) + '")', a.note]);
  });
  if (t.length === 1) t.push(['', 'مفيش تنبيهات', '', '', '', '', '']);
  ensureGrid_(sh, t.length + 1, 7);
  sh.getRange(1, 1, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 3, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 4, t.length, 1).setNumberFormat('@');
  sh.getRange(1, 1, t.length, 7).setValues(t);
  sh.getRange(1, 1, 1, 7).setBackground('#e69138').setFontColor('#ffffff').setFontWeight('bold');
  sh.getRange(1, 1, t.length, 7).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(2, 7, t.length - 1, 1).setWrap(true);
  sh.setColumnWidth(1, 90); sh.setColumnWidth(2, 190); sh.setColumnWidths(3, 2, 175); sh.setColumnWidth(5, 100); sh.setColumnWidth(6, 170); sh.setColumnWidth(7, 520);
  sh.setFrozenRows(1); centerSheet_(sh);
}

/* ═══════════════════════ السحب المباشر من منصة التتبع (Traccar) ═══════════════════════
 *  إعداد لمرة واحدة: Project Settings ▸ Script properties ▸ أضف  TRACCAR_TOKEN  (التوكن من Account في المنصة).
 *  وشيت "Devices Naming Connection": عمود A = رقم الجهاز في أول اسمه ، عمود B = رقم المركبة ، عمود C = رقم السيارة الداخلي.
 * ============================================================================ */
const PLATFORM = {
  BASE_URL: 'http://196.221.144.183:8080',
  MAP_SHEET: 'Devices Naming Connection',
  UTC_OFFSET_H: 2,        // المنصة بتعرض الأوقات UTC+2 ثابت (زي ملفات الإكسل وتقاريرك اليدوية)
  ROUTE_CHUNK_DAYS: 2,    // سحب المسار على شرايح عشان حجم الرد
  MAX_DAYS: 62,           // أقصى فترة في المرة الواحدة (بالأيام). الفترات الطويلة بتاخد وقت أكتر — حد Apps Script 6 دقايق
  CACHE_FOLDER: 'GPS Cache - Abna Badawy',   // فولدر في Google Drive بيتحفظ فيه مسار الأيام اللي فاتت (لتسريع التشغيلات المتكررة)
  CACHE_MIN_AGE_H: 48,    // اليوم بيتحفظ في الكاش بس لو عدّى عليه أكتر من كدا (الأجهزة ممكن تبعت بيانات متأخرة)
  PARALLEL: 8,            // عدد طلبات المسار المتوازية
  TIME_BUDGET_SEC: 240    // بعد المدة دي من بداية التشغيل بنوقف السحب ونحفظ اللي اتسحب (حد Google 360 ث)
};

// بتتنادى من النافذة (Enter أو الزرار). بترمي خطأ لو فيه مشكلة وبيظهر جوه النافذة.
function platformReportRun(vehicle, fromTxt, toTxt, runId, fresh) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  vehicle = String(vehicle || '').trim();
  if (!vehicle) throw new Error('لازم تكتب رقم السيارة.');
  const today = platformDay_(new Date().getTime());
  const fromDay = platformDayInput_(fromTxt, today.slice(0, 8) + '01');
  const toDay = platformDayInput_(toTxt, today);
  if (toDay < fromDay) throw new Error('تاريخ النهاية قبل البداية.');
  const reqDays = Math.round((Date.parse(toDay + 'T00:00:00Z') - Date.parse(fromDay + 'T00:00:00Z')) / 86400000) + 1;
  if (reqDays > PLATFORM.MAX_DAYS) throw new Error('الفترة ' + reqDays + ' يوم. الحد الأقصى ' + PLATFORM.MAX_DAYS + ' يوم في المرة.');
  // بنسحب يوم قبل ويوم بعد الفترة المطلوبة: نقلة بدأت قبل أول يوم أو خلصت بعد آخر يوم لازم تتحلل كاملة، وبعدين التقرير بيتقصّ على الفترة المطلوبة بس
  const pullFrom = shiftDay_(fromDay, -1);
  const pullTo = toDay >= today ? toDay : (shiftDay_(toDay, 1) > today ? today : shiftDay_(toDay, 1));
  progress_(runId, 0, '');
  const gpsNo = platformLookupGpsNo_(ss, vehicle);
  progress_(runId, 1, '');
  const cookie = traccarCookie_();
  const dev = platformFindDevice_(traccarGet_('/api/devices', cookie), gpsNo);
  progress_(runId, 0, 'الجهاز: ' + dev.name);
  progress_(runId, 2, 'جاري سحب الرحلات…');
  const data = platformPull_(cookie, dev.id, pullFrom, pullTo, function (frac, msg) { progress_(runId, 2, msg, frac); }, fresh);
  progress_(runId, 2, data.route.length + ' نقطة و ' + data.trips.length + ' رحلة • ' + data.info.cachedDays + ' يوم من الكاش و ' + data.info.fetchedDays + ' من المنصة • المنصة ' + data.info.fetchSec + ' ث (' + data.info.requests + ' طلب) • الكاش ' + data.info.cacheSec + ' ث' + (data.info.tripNote ? ' • ' + data.info.tripNote : '') + (data.info.cacheErr ? ' (الكاش غير متاح: ' + data.info.cacheErr + ')' : ''));
  progress_(runId, 3, '');
  const vals = traccarToValues_(data.route, data.trips, dev.name, PLATFORM.UTC_OFFSET_H);
  const loc = platformLocValues_(ss);
  let named = []; try { named = namedLoad_(ss); } catch (e) {}
  progress_(runId, 3, data.route.length + ' نقطة جاهزة');
  // حالة الـ GPS للسيارة (لو فشلت التقرير الأساسي يكمل عادي)
  progress_(runId, 4, '');
  let gst = null, gerr = '';
  try { gst = gpsStatusForDevice_(ss, cookie, dev, Date.now()); progress_(runId, 4, gpsStatusLabel_(gst.inf.status)); }
  catch (e) { gerr = String(e && e.message ? e.message : e); progress_(runId, 4, 'تعذّر: ' + gerr.slice(0, 60)); }
  progress_(runId, 5, '');
  let report = null, buildErr = null, ovInfo = null;
  try { report = buildFleetReport_(vals.routeValues, vals.tripValues, loc, ss.getSpreadsheetTimeZone(), cfgFor_(vehicle), named); report.vehicle = vehicle;
    report = trimReport_(report, fromDay, toDay);
    if (!report.days.length) throw new Error('مفيش أي نقلات أو رحلات في الفترة من ' + fromDay + ' إلى ' + toDay + '.');
    ovInfo = editsOverlayStored_(ss, report, vehicle, fromDay, toDay, ss.getSpreadsheetTimeZone()); }   // تعديلاتك المحفوظة من تشغيلات سابقة بتتطبق تلقائي
  catch (e) { buildErr = e; }
  progress_(runId, 6, ovInfo && ovInfo.applied ? 'اتطبق ' + ovInfo.applied + ' تعديل محفوظ من تعديلاتك السابقة' : '');
  if (gst) {
    let health = null;
    try { health = gpsHealthAssess_(gst.inf, data.route, report ? report.quality : null, !!cfgFor_(vehicle).FREEZE_FIX); } catch (e) {}
    try { gpsStatusWriteVehicle_(ss, vehicle, dev.name, gst.inf, gst.place, gst.curPlace, gst.evErr, Date.now(), health); } catch (e) {}
  }   // شيت الحالة مش لازم يوقف التقرير
  if (buildErr) throw buildErr;   // (شيت حالة الجهاز اتكتب برضه)
  writeReport_(ss, report, GPS_CONFIG);
  progress_(runId, 7, '');   // خلصت كل الخطوات
  return 'ok';
}

// نافذة الإدخال + قائمة الخطوات (✓ / دايرة بتلف / رمادي) + تايمر لكل خطوة وتايمر عام. بتتبني من JOBS[jobId]
function reportFormHtml_(jobId, from, to) {
  const job = JOBS[jobId], steps = job.steps;
  const hasV = job.fields.indexOf('v') >= 0, hasD = job.fields.indexOf('dates') >= 0;
  const css = 'body{font-family:Arial,sans-serif;margin:14px;color:#222}label{display:block;margin:10px 0 3px;font-size:13px;color:#444}' +
    'input{width:100%;box-sizing:border-box;padding:7px;font-size:15px;border:1px solid #bbb;border-radius:4px}' +
    'button{margin-top:16px;width:100%;padding:9px;font-size:15px;background:#1a73e8;color:#fff;border:0;border-radius:4px;cursor:pointer}' +
    '#msg{margin-top:12px;font-size:13px;color:#b00;white-space:pre-wrap}#msg.ok{color:#137333;font-weight:bold;font-size:14px}#prog{display:none}#f{display:flex;flex-direction:column}#prog{order:1}#msg{order:2}#inp{order:3}#done{order:4;display:none;background:#5f6368}#stop{background:#c5221f;margin-top:12px}' +
    '#top{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#555}#tot{font-weight:bold;color:#222;direction:ltr;font-size:15px}' +
    '#bar{height:10px;background:#e3e8ee;border-radius:6px;overflow:hidden;margin:6px 0 2px}#fill{height:100%;width:0;background:#1a73e8;transition:width .5s}' +
    '#pct{font-size:12px;color:#555;direction:ltr;text-align:left}ul{list-style:none;margin:10px 0 0;padding:0}' +
    'li{display:flex;align-items:center;gap:10px;padding:7px 4px;font-size:14px;color:#999;border-bottom:1px solid #f2f2f2}' +
    '.ic{width:20px;height:20px;border-radius:50%;border:2px solid #ccc;box-sizing:border-box;flex:none;text-align:center;font-size:12px;line-height:16px;color:#fff}' +
    '.tx{flex:1}.tm{direction:ltr;font-size:12px;color:#888;flex:none;min-width:38px;text-align:left}' +
    'li.done{color:#2e7d32}li.done .ic{background:#2e7d32;border-color:#2e7d32}' +
    'li.now{color:#111;font-weight:bold}li.now .tm{color:#1a73e8}li.now .ic{border-color:#1a73e8;border-top-color:transparent;animation:s 1s linear infinite}' +
    'li.err{color:#b00}li.err .ic{background:#b00;border-color:#b00}small{display:block;font-weight:normal;color:#666;font-size:12px}' +
    '@keyframes s{to{transform:rotate(360deg)}}';
  const body = '<form id="f"><div id="inp">' +
    (hasV ? '<label>رقم السيارة' + (jobId === 'file' ? ' (لو سبته فاضي هياخده من الملف)' : ' (زي 123)') + '</label><input id="v" autofocus autocomplete="off">' : '') +
    (hasD ? '<label>من تاريخ</label><input id="a" type="date" value="' + from + '"><label>إلى تاريخ</label><input id="b" type="date" value="' + to + '">' : '') +
    (job.fields.indexOf('fresh') >= 0 ? '<label style="display:flex;align-items:center;gap:8px;margin-top:14px"><input id="fr" type="checkbox" style="width:auto"> سحب جديد من المنصة (تجاهل الكاش)</label>' : '') +
    '<button id="go" type="submit">' + (job.auto ? 'إعادة المحاولة' : 'إنشاء التقرير') + '</button></div>' +
    '<div id="prog"><div id="top"><span id="ttl"></span><span id="tot">00:00</span></div>' +
    '<div id="bar"><div id="fill"></div></div><div id="pct">0%</div><ul id="ls"></ul><button id="stop" type="button">⛔ إيقاف التشغيل</button></div>' +
    '<div id="msg"></div><button id="done" type="button">إغلاق</button></form>';
  const js = 'var JOB=' + JSON.stringify(jobId) + ',DONE=' + JSON.stringify(job.doneMsg || 'التقرير جاهز') + ',TITLE=' + JSON.stringify(job.title) + ',STEPS=' + JSON.stringify(steps) + ',N=STEPS.length;' +
    'var f=document.getElementById("f"),msg=document.getElementById("msg"),run="r"+Date.now()+Math.floor(Math.random()*1e6),timer=null,tick=null;' +
    'var st=null,recv=0,t0=0,endAt=0,endSrv=0,failedAt=-1,doneAll=false,tEnd=[],stopped=false,CANCEL=' + JSON.stringify(CANCEL_MSG) + ';' +
    'function $(i){return document.getElementById(i);}' +
    'function fmt(ms){var s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60);s=s%60;return (m<10?"0":"")+m+":"+(s<10?"0":"")+s;}' +
    'function build(){var h="";for(var i=0;i<N;i++)h+="<li id=\\"l"+i+"\\"><span class=\\"ic\\"></span><span class=\\"tx\\">"+STEPS[i]+"<small></small></span><span class=\\"tm\\"></span></li>";$("ls").innerHTML=h;}' +
    'function nowSrv(){return st?st.now+(Date.now()-recv):0;}' +
    'function render(){var cur=doneAll?N:(st?st.s:0),pc=0;' +
    'for(var i=0;i<N;i++){var li=$("l"+i),cls="",tm="",det=(st&&st.d&&st.d[i])||"";' +
    'if(i===failedAt)cls="err";else if(i<cur)cls="done";else if(i===cur)cls="now";' +
    'if(st&&st.ts&&st.ts[i]&&cls){var end=(i<cur&&st.ts[i+1])?st.ts[i+1]:(endAt?endSrv:nowSrv());if(i<cur&&!st.ts[i+1])end=tEnd[i]||(tEnd[i]=nowSrv());tm=fmt(end-st.ts[i]);}' +
    'li.className=cls;li.querySelector(".ic").textContent=(cls==="done")?"\\u2713":(cls==="err"?"!":"");li.querySelector(".tm").textContent=tm;li.querySelector("small").textContent=det;}' +
    'pc=doneAll?100:Math.min(99,Math.round(((cur+(st?st.f||0:0))/N)*100));$("fill").style.width=pc+"%";$("pct").textContent=pc+"%";' +
    '$("tot").textContent=fmt((endAt?endAt:Date.now())-t0);}' +
    'function poll(){google.script.run.withSuccessHandler(function(r){if(r&&timer){st=r;recv=Date.now();}}).getProgress(run);}' +
    'function stopAll(){clearInterval(timer);clearInterval(tick);timer=null;tick=null;$("stop").style.display="none";}' +
    'function finish(x){stopAll();if(x){st=x;recv=Date.now();}endAt=Date.now();endSrv=nowSrv();doneAll=true;render();msg.className="ok";msg.textContent="تم ✔ "+DONE+" — الإجمالي "+$("tot").textContent;$("done").style.display="block";$("done").focus();}' +
    'function start(){msg.className="";msg.textContent="";var v=$("v")?$("v").value:"";' +
    '$("inp").style.display="none";$("prog").style.display="block";$("ttl").textContent=TITLE+(v?" — "+v:"");' +
    'build();st=null;failedAt=-1;doneAll=false;stopped=false;endAt=0;endSrv=0;tEnd=[];$("stop").style.display="block";t0=Date.now();render();timer=setInterval(poll,1000);tick=setInterval(render,250);' +
    'var args={v:v,from:$("a")?$("a").value:"",to:$("b")?$("b").value:"",fresh:$("fr")?$("fr").checked:false};' +
    'function back(){$("inp").style.display="block";$("go").disabled=false;if($("v"))$("v").focus();}' +
    'google.script.run.withSuccessHandler(function(){if(stopped){msg.className="";msg.textContent="التقرير كان خلص قبل ما الإيقاف يتنفذ.";back();return;}google.script.run.withSuccessHandler(finish).withFailureHandler(function(){finish(null);}).getProgress(run);})' +
    '.withFailureHandler(function(err){var m=(err&&err.message)?err.message:String(err);if(stopped){msg.className="";msg.textContent=(m===CANCEL?"تم إيقاف التشغيل ✔":m);back();return;}stopAll();var fin=function(x){if(x){st=x;recv=Date.now();}failedAt=st?st.s:0;endAt=Date.now();endSrv=nowSrv();render();msg.textContent=m;};' +
    'google.script.run.withSuccessHandler(fin).withFailureHandler(function(){fin(null);}).getProgress(run);' +
    'setTimeout(function(){$("inp").style.display="block";$("go").disabled=false;if($("v"))$("v").focus();},50);})' +
    '.jobRun(JOB,args,run);}' +
    '$("stop").addEventListener("click",function(){if(!timer||stopped)return;stopped=true;google.script.run.cancelRun(run);stopAll();failedAt=st?st.s:0;endAt=Date.now();endSrv=nowSrv();render();msg.className="";msg.textContent="جاري الإيقاف… هيقف عند أقرب نقطة آمنة (لو فيه طلب كبير شغال ممكن ياخد لحد دقيقة).";$("done").style.display="block";});' +
    'f.addEventListener("submit",function(e){e.preventDefault();start();});' +
    '$("done").addEventListener("click",function(){google.script.host.close();});' +
    (job.auto ? 'window.addEventListener("load",start);' : '');
  return '<!DOCTYPE html><html dir="rtl"><head><base target="_top"><meta charset="utf-8"><style>' + css + '</style></head><body>' + body + '<script>' + js + '</script></body></html>';
}

// تاريخ مكتوب بأي شكل (2026-10-01 أو 01-10-2026 أو 1/10/2026) ← yyyy-MM-dd
function platformDayInput_(txt, dflt) {
  const s = String(txt).replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();
  if (!s) return dflt;
  let m = /^(\d{4})\D(\d{1,2})\D(\d{1,2})$/.exec(s), y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})\D(\d{1,2})\D(\d{4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else throw new Error('شكل التاريخ "' + s + '" غير مفهوم. اكتب اليوم والشهر والسنة، مثال: 01-10-2026');
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error('التاريخ "' + s + '" غير صحيح.');
  return y + '-' + p2_(mo) + '-' + p2_(d);
}

// اليوم (yyyy-MM-dd) بتوقيت المنصة
function platformDay_(ms) { return ymd_(Math.floor(ms / 1000) + PLATFORM.UTC_OFFSET_H * 3600); }

function platformLookupGpsNo_(ss, vehicle) {
  const sh = ss.getSheetByName(PLATFORM.MAP_SHEET);
  if (!sh) throw new Error('مش لاقي شيت "' + PLATFORM.MAP_SHEET + '" (جدول ربط رقم الجهاز برقم السيارة).');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (String(rows[i][2]).trim() === vehicle) { const n = Number(rows[i][0]); if (!n) throw new Error('السيارة "' + vehicle + '" موجودة في شيت ' + PLATFORM.MAP_SHEET + ' لكن رقم الجهاز في عمود A فاضي أو مش رقم.'); return n; }
  throw new Error('السيارة "' + vehicle + '" مش موجودة في عمود C في شيت ' + PLATFORM.MAP_SHEET + '.');
}
function platformFindDevice_(devices, gpsNo) {
  const hit = devices.filter(function (d) { const m = /^\s*(\d+)/.exec(d.name); return m && Number(m[1]) === gpsNo; });
  if (!hit.length) throw new Error('مفيش جهاز في المنصة اسمه بيبدأ بالرقم ' + gpsNo + '.');
  if (hit.length > 1) throw new Error('أكتر من جهاز اسمه بيبدأ بالرقم ' + gpsNo + ':\n- ' + hit.map(function (d) { return d.name; }).join('\n- '));
  return hit[0];
}
function platformLocValues_(ss) {
  const sheets = ss.getSheets();
  const look = function (sh) {
    if (sh.getLastRow() < 2) return null;
    const head = sh.getRange(1, 1, Math.min(30, sh.getLastRow()), Math.min(20, Math.max(2, sh.getLastColumn()))).getValues();
    return detectSheetKind_(head) === 'locations' ? sh.getDataRange().getValues() : null;
  };
  // الأول بالاسم (أسرع بكتير)، وبعدين فحص باقي الشيتات
  for (let i = 0; i < sheets.length; i++) if (/coordinates|احداثيات|إحداثيات/i.test(sheets[i].getName())) { const v = look(sheets[i]); if (v) return v; }
  for (let i = 0; i < sheets.length; i++) { const v = look(sheets[i]); if (v) return v; }
  throw new Error('مش لاقي شيت إحداثيات المواقع (Coordinates).');
}

// الجلسة بتتحفظ 20 دقيقة في الكاش (توفير طلب تسجيل دخول في كل تشغيل). fresh=true بيجبر تسجيل دخول جديد
function traccarCookie_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) { try { const c = cache.get('tc_cookie'); if (c) return c; } catch (e) {} }
  const token = PropertiesService.getScriptProperties().getProperty('TRACCAR_TOKEN');
  if (!token) throw new Error('مفيش TRACCAR_TOKEN في Script properties.');
  const s = fetchAllSafe_([{ url: PLATFORM.BASE_URL + '/api/session?token=' + encodeURIComponent(token), muteHttpExceptions: true }])[0];
  if (!s.getAllHeaders) throw new Error('المنصة مش بترد (' + s.getContentText().slice(0, 80) + '). جرب تاني بعد شوية.');
  const hs = s.getAllHeaders();
  let sc = hs['Set-Cookie'] || hs['set-cookie'];
  if (Array.isArray(sc)) sc = sc.join(';');
  const m = /JSESSIONID=[^;]+/.exec(String(sc));
  if (!m) throw new Error('فشل فتح الجلسة مع المنصة (كود ' + s.getResponseCode() + '). اتأكد من التوكن.');
  try { cache.put('tc_cookie', m[0], 1200); } catch (e) {}
  return m[0];
}
// ─── طبقة الشبكة: أي عطل مؤقت (انقطاع / مهلة / 5xx / 429) بيتعاد تلقائي بدل ما التقرير يفشل ───
const NET = { RETRIES: 2, WAIT_MS: 1500 };
function isTransient_(code) { return code === 0 || code === 429 || code >= 500; }
function fetchOneSafe_(rq) {
  try {
    const o = {}; Object.keys(rq).forEach(function (k) { if (k !== 'url') o[k] = rq[k]; });
    return UrlFetchApp.fetch(rq.url, o);
  } catch (e) {
    const m = String(e && e.message ? e.message : e);
    return { getResponseCode: function () { return 0; }, getContentText: function () { return m; } };
  }
}
// بتبعت الطلبات بالتوازي؛ لو fetchAll نفسها رمت خطأ بنكمل طلب طلب. اللي فشل مؤقتاً بيتعاد.
function fetchAllSafe_(reqs) {
  let resp;
  try { resp = UrlFetchApp.fetchAll(reqs); } catch (e) { resp = reqs.map(fetchOneSafe_); }
  for (let a = 0; a < NET.RETRIES; a++) {
    const bad = [];
    resp.forEach(function (r, i) { if (isTransient_(r.getResponseCode())) bad.push(i); });
    if (!bad.length) break;
    try { Utilities.sleep(NET.WAIT_MS * (a + 1)); } catch (e) {}
    bad.forEach(function (i) { resp[i] = fetchOneSafe_(reqs[i]); });
  }
  return resp;
}
function traccarGet_(path, cookie) {
  const mk = function (ck) { return { url: PLATFORM.BASE_URL + path, headers: { Cookie: ck, Accept: 'application/json' }, muteHttpExceptions: true }; };
  let r = fetchAllSafe_([mk(cookie)])[0];
  if (r.getResponseCode() === 401 || r.getResponseCode() === 403) r = fetchAllSafe_([mk(traccarCookie_(true))])[0];   // الجلسة المحفوظة انتهت
  if (r.getResponseCode() !== 200) throw new Error('المنصة ' + (r.getResponseCode() === 0 ? 'مش بترد (' + r.getContentText().slice(0, 80) + ')' : 'رجّعت ' + r.getResponseCode()) + ' لـ ' + path.split('?')[0] + (r.getResponseCode() === 0 ? '' : ': ' + r.getContentText().slice(0, 120)) + '. جرب تاني بعد شوية.');
  try { return JSON.parse(r.getContentText()); } catch (e) { throw new Error('رد المنصة لـ ' + path.split('?')[0] + ' مش JSON سليم. جرب تاني.'); }
}

// سحب المسار (شرايح) والرحلات لفترة أيام بتوقيت المنصة. الأيام اللي فاتت بتتقرا من كاش Drive وتتسحب من المنصة الأيام الناقصة بس.
function platformPull_(cookie, deviceId, fromDay, toDay, onProg, fresh) {
  onProg = onProg || function () {};
  const off = PLATFORM.UTC_OFFSET_H * 3600000, DAY = 86400000;
  const a = Date.parse(fromDay + 'T00:00:00Z') - off, b = Date.parse(toDay + 'T00:00:00Z') + DAY - off;
  if (isNaN(a) || isNaN(b)) throw new Error('شكل التاريخ غير صحيح.');
  if (b <= a) throw new Error('تاريخ النهاية قبل البداية.');
  const nDays = Math.round((b - a) / DAY);
  if (nDays > PLATFORM.MAX_DAYS + 2) throw new Error('الفترة ' + nDays + ' يوم. الحد الأقصى ' + PLATFORM.MAX_DAYS + ' يوم في المرة.');
  const q = function (x, y) { return '?deviceId=' + deviceId + '&from=' + new Date(x).toISOString() + '&to=' + new Date(y).toISOString(); };
  const days = [];
  for (let i = 0; i < nDays; i++) days.push(platformDay_(a + i * DAY + 1));
  const now = Date.now();
  const eligible = days.map(function (d, i) { return a + (i + 1) * DAY <= now - PLATFORM.CACHE_MIN_AGE_H * 3600000; });
  // 1) كاش المسار + كاش الرحلات
  const tc0 = Date.now();
  let folder = null, cacheErr = '';
  const months = {}, cached = {};
  let tc = { v: 1, off: PLATFORM.UTC_OFFSET_H, verified: false, bad: false, blocks: {} };
  try {
    folder = cacheFolder_();
    tc = cacheReadFile_(folder, tripsCacheName_(deviceId), tc);
    if (!fresh) {
      days.forEach(function (d, i) { if (eligible[i]) months[d.slice(0, 7)] = null; });
      Object.keys(months).forEach(function (m) { months[m] = cacheLoad_(folder, deviceId, m); });
      days.forEach(function (d, i) { const mo = months[d.slice(0, 7)]; if (eligible[i] && mo && mo.days[d]) cached[d] = mo.days[d]; });
    }
  } catch (e) { cacheErr = String(e && e.message ? e.message : e).slice(0, 80); folder = null; }
  const cacheLoadSec = Math.round((Date.now() - tc0) / 100) / 10;
  const missing = [];
  days.forEach(function (d, i) { if (!cached[d]) missing.push(i); });

  // 2) الرحلات: كتل متخزنة (محدودة بنقاط وقوف طويل فيها العربية مستحيل تكون ماشية) + سحب الباقي من المنصة
  const cutsKnown = {};   // أوقات القطع المعروفة من الأيام الموجودة في الكاش
  days.forEach(function (d, i) { if (cached[d] && eligible[i]) { const c = tripCutOfDay_(cached[d]); if (c !== null && c > a && c < b) cutsKnown[c] = 1; } });
  const usable = [];
  if (folder && !tc.bad && !fresh) {
    Object.keys(tc.blocks).forEach(function (k) {
      const f = Number(k.split('_')[0]), t = Number(k.split('_')[1]);
      if (f >= a && t <= b && cutsKnown[f] && cutsKnown[t]) usable.push({ f: f, t: t, trips: tc.blocks[k] });
    });
    usable.sort(function (x, y) { return x.f - y.f; });
  }
  const sel = [];   // اختيار كتل متتالية من غير تداخل
  usable.forEach(function (u) { if (!sel.length || u.f >= sel[sel.length - 1].t) sel.push(u); });
  const needFull = !sel.length || !tc.verified;     // أول مرة بنستخدم فيها كتل متخزنة: بنسحب الرحلات كاملة ونقارن (مرة واحدة)
  const live = [];                                   // فترات الرحلات اللي هتتسحب من المنصة
  if (needFull) live.push([a, b]);
  else {
    let x = a;
    sel.forEach(function (u) { if (u.f > x) live.push([x, u.f]); x = u.t; });
    if (x < b) live.push([x, b]);
  }
  // 3) الطلبات: الرحلات (فترات) + المسار للأيام الناقصة، كلهم بالتوازي
  const paths = live.map(function (r) { return '/api/reports/trips' + q(r[0], r[1]); });
  const nTrips = paths.length, chunks = [];
  for (let k = 0; k < missing.length;) {
    let e = k;
    while (e + 1 < missing.length && missing[e + 1] === missing[e] + 1 && (e + 1 - k) < PLATFORM.ROUTE_CHUNK_DAYS) e++;
    chunks.push({ k: paths.length, days: missing.slice(k, e + 1) });
    paths.push('/api/reports/route' + q(a + missing[k] * DAY, a + (missing[e] + 1) * DAY));
    k = e + 1;
  }
  const seenIds = {};   // منع تكرار نقطة جت في شريحتين متجاورتين
  const ingest = function (target, list) {   // نقاط المنصة ← شكل مضغوط، متقسمة على الأيام
    list.forEach(function (p) {
      if (p.id !== undefined) { if (seenIds[p.id]) return; seenIds[p.id] = 1; }
      const ms = platformParseIso_(p.fixTime || p.deviceTime);
      const d = platformDay_(ms);
      if (target[d]) target[d].push([ms, Math.round(p.latitude * 1e7) / 1e7, Math.round(p.longitude * 1e7) / 1e7, p.speed || 0, p.altitude || 0, p.valid === false ? 0 : 1]);
    });
  };
  onProg(0.03, (days.length - missing.length) + ' يوم من الكاش • جاري سحب ' + missing.length + ' يوم من المنصة…');
  const t0 = Date.now();
  const res = traccarGetAll_(cookie, paths, function (done, total) {
    onProg(0.05 + 0.95 * done / total, 'تم سحب ' + done + ' من ' + total + ' طلب (' + Math.round((Date.now() - t0) / 1000) + ' ث)');
  }, PLATFORM.PARALLEL, EXEC_T0_ ? EXEC_T0_ + PLATFORM.TIME_BUDGET_SEC * 1000 : 0);
  const fetchSec = Math.round((Date.now() - t0) / 100) / 10;
  if (res.length < paths.length) {   // الفترة كبيرة والوقت قرب يخلص: نحفظ في الكاش اللي اتسحب ونطلب إعادة التشغيل (بتكمل من حيث وقفت)
    let saved = 0;
    if (folder) {
      try {
        const part = {}, dirtyM = {};
        chunks.forEach(function (ch) { if (res[ch.k] && res[ch.k].data) ch.days.forEach(function (i) { part[days[i]] = []; }); });
        chunks.forEach(function (ch) { if (res[ch.k] && res[ch.k].data) ingest(part, res[ch.k].data); });
        Object.keys(part).forEach(function (d) {
          const i = days.indexOf(d);
          if (!eligible[i]) return;
          const m = d.slice(0, 7);
          if (!months[m]) months[m] = cacheLoad_(folder, deviceId, m);
          months[m].days[d] = part[d]; dirtyM[m] = 1; saved++;
        });
        Object.keys(dirtyM).forEach(function (m) { cacheSave_(folder, deviceId, m, months[m]); });
      } catch (e) {}
    }
    throw new Error('الفترة كبيرة والوقت المسموح لـ Google قرب يخلص. اتحفظ ' + saved + ' يوم في الكاش — شغّل نفس التقرير تاني وهيكمل من حيث وقف (وهيبقى أسرع). أو اختار فترة أقصر.');
  }
  const get = function (k) { return res[k].data ? res[k].data : traccarGet_(paths[k], cookie); };   // طلب فشل؟ نعيده لوحده
  const liveTrips = [];
  for (let k = 0; k < nTrips; k++) liveTrips.push(get(k));
  // 4) النقاط المسحوبة ← شكل مضغوط، متقسمة على الأيام
  const fetched = {};
  missing.forEach(function (i) { fetched[days[i]] = []; });
  for (let k = nTrips; k < paths.length; k++) ingest(fetched, get(k));
  // 5) تجميع الرحلات + (لو سحبنا كاملة) مقارنة الكتل المتخزنة بيها، وتخزين كتل جديدة
  const ts0 = Date.now();
  let trips = [], tripNote = '';
  const startOf = function (t) { return platformParseIso_(t.startTime); };
  if (needFull) {
    trips = liveTrips[0];
    if (sel.length) {   // مقارنة
      const full = trips;
      let ok = true;
      sel.forEach(function (u) {
        const mine = full.filter(function (t) { const st = startOf(t); return st >= u.f && st < u.t; });
        if (!sameTrips_(mine, u.trips)) ok = false;
      });
      if (ok) { tc.verified = true; tripNote = 'الرحلات المتخزنة اتطابقت مع السحب الكامل ✓'; }
      else { tc.bad = true; tc.blocks = {}; tc.verified = false; tripNote = 'تحذير: الرحلات المتخزنة اختلفت عن السحب الكامل — اتعطّل كاش الرحلات لهذا الجهاز'; }
    }
  } else {
    sel.forEach(function (u) { u.trips.forEach(function (t) { trips.push(t); }); });
    liveTrips.forEach(function (l) { l.forEach(function (t) { trips.push(t); }); });
    tripNote = 'رحلات: ' + sel.length + ' كتلة من الكاش';
  }
  // كل الأيام (مسار الكاش + المسحوب) بعد ما الأيام الجديدة وصلت: نحسب نقاط القطع ونخزن كتل الرحلات
  const dayPts = function (d) { return cached[d] || fetched[d] || []; };
  const cutsAll = [];
  if (folder && !tc.bad) {
    days.forEach(function (d, i) { if (eligible[i]) { const c = tripCutOfDay_(dayPts(d)); if (c !== null && c > a && c < b) cutsAll.push(c); } });
    cutsAll.sort(function (x, y) { return x - y; });
  }
  let tcDirty = !!(sel.length && needFull) || tc.bad;
  if (folder && !tc.bad) {
    live.forEach(function (r, k) {
      const inside = cutsAll.filter(function (c) { return c > r[0] && c < r[1]; });
      const bounds = [];
      if (cutsAll.indexOf(r[0]) >= 0) bounds.push(r[0]);
      inside.forEach(function (c) { bounds.push(c); });
      if (cutsAll.indexOf(r[1]) >= 0 && r[1] !== r[0]) bounds.push(r[1]);
      const list = liveTrips[k];
      for (let i = 0; i + 1 < bounds.length; i++) {
        const f = bounds[i], t = bounds[i + 1], key = f + '_' + t;
        const blk = list.filter(function (x) { const st = startOf(x); return st >= f && st < t; });
        if (blk.some(function (x) { return platformParseIso_(x.endTime) > t; })) { tripNote = 'تحذير: رحلة بتعدّي نقطة قطع — مش هتتخزن'; continue; }
        if (!tc.blocks[key]) { tc.blocks[key] = blk.map(compactTrip_); tcDirty = true; }
      }
    });
    // رحلة بتعدّي نقطة قطع في السحب الكامل = النظرية مش متحققة: نعطّل الكاش
    if (needFull) {
      const bad = trips.some(function (x) { const st = startOf(x), en = platformParseIso_(x.endTime); return cutsAll.some(function (c) { return st < c && en > c; }); });
      if (bad) { tc.bad = true; tc.blocks = {}; tc.verified = false; tcDirty = true; tripNote = 'تحذير: رحلات بتعدّي نقاط القطع — اتعطّل كاش الرحلات لهذا الجهاز'; }
    }
  }
  // 6) حفظ الكاش (لو فشل التقرير يكمل عادي)
  if (folder) {
    try {
      const dirty = {};
      missing.forEach(function (i) {
        if (!eligible[i]) return;
        const m = days[i].slice(0, 7);
        if (!months[m]) months[m] = cacheLoad_(folder, deviceId, m);
        months[m].days[days[i]] = fetched[days[i]];
        dirty[m] = 1;
      });
      Object.keys(dirty).forEach(function (m) { cacheSave_(folder, deviceId, m, months[m]); });
      if (tcDirty) cacheWriteFile_(folder, tripsCacheName_(deviceId), tc);
    } catch (e) { cacheErr = 'حفظ الكاش فشل: ' + String(e && e.message ? e.message : e).slice(0, 60); }
  }
  // 7) تجميع كل النقاط (الكاش + المسحوب) بنفس الشكل
  const route = [];
  const push = function (c) { route.push({ fixTime: c[0], latitude: c[1], longitude: c[2], speed: c[3], altitude: c[4], valid: c[5] !== 0 }); };
  days.forEach(function (d) { dayPts(d).forEach(push); });
  if (!route.length) throw new Error('المنصة ما رجّعتش أي نقطة للجهاز في الفترة دي.');
  return { route: route, trips: trips, info: { cachedDays: days.length - missing.length, fetchedDays: missing.length, cacheErr: cacheErr, tripNote: tripNote,
    cacheSec: cacheLoadSec + Math.round((Date.now() - ts0) / 100) / 10, fetchSec: fetchSec, requests: paths.length } };
}

// نقطة قطع في اليوم: أول وقوف تام (سرعة صفر) متواصل 30 دقيقة أو أكتر — بنقطع بعد 15 دقيقة من بدايته (جواه). الرحلة ما بتعدّيش وقوف طويل، فالقطع هناك مش بيغيّر نتايج الرحلات.
function tripCutOfDay_(pts) {
  let start = -1, prev = -1;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p[3] <= 0.01) {
      if (start < 0 || p[0] - prev > 15 * 60000) start = p[0];
      prev = p[0];
      if (prev - start >= 30 * 60000) return start + 15 * 60000;
    } else start = -1;
  }
  return null;
}
function compactTrip_(t) {
  return { startTime: t.startTime, endTime: t.endTime, distance: t.distance, duration: t.duration, startOdometer: t.startOdometer, endOdometer: t.endOdometer, startAddress: t.startAddress || '', endAddress: t.endAddress || '' };
}
function sameTrips_(x, y) {
  if (x.length !== y.length) return false;
  const k = function (t) { return platformParseIso_(t.startTime); };
  const xs = x.slice().sort(function (p, q) { return k(p) - k(q); }), ys = y.slice().sort(function (p, q) { return k(p) - k(q); });
  for (let i = 0; i < xs.length; i++) {
    if (k(xs[i]) !== k(ys[i]) || platformParseIso_(xs[i].endTime) !== platformParseIso_(ys[i].endTime) || Math.abs((xs[i].distance || 0) - (ys[i].distance || 0)) > 1) return false;
  }
  return true;
}

/* ── كاش Drive: ملف لكل جهاز في الشهر (مضغوط). الأيام بتتخزن كنقاط [وقت ms, lat, lon, سرعة, ارتفاع, صالحة] ── */
function cacheFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('GPS_CACHE_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName(PLATFORM.CACHE_FOLDER);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(PLATFORM.CACHE_FOLDER);
  props.setProperty('GPS_CACHE_FOLDER_ID', f.getId());
  return f;
}
function tripsCacheName_(deviceId) { return 't' + deviceId + '.gz64'; }
function cacheReadFile_(folder, name, empty) {
  const it = folder.getFilesByName(name);
  if (!it.hasNext()) return empty;
  try {
    const bytes = Utilities.base64Decode(it.next().getBlob().getDataAsString());
    const o = JSON.parse(Utilities.ungzip(Utilities.newBlob(bytes, 'application/x-gzip', 'c.gz')).getDataAsString());
    return (o && o.v === 1 && o.off === PLATFORM.UTC_OFFSET_H) ? o : empty;   // لو فرق التوقيت اتغير الكاش القديم بيتتجاهل
  } catch (e) { return empty; }
}
function cacheWriteFile_(folder, name, obj) {
  const gz = Utilities.gzip(Utilities.newBlob(JSON.stringify(obj), 'application/json', 'c.json'), 'c.gz');
  const txt = Utilities.base64Encode(gz.getBytes()), it = folder.getFilesByName(name);
  if (it.hasNext()) it.next().setContent(txt); else folder.createFile(name, txt, 'text/plain');
}
function cacheName_(deviceId, month) { return 'd' + deviceId + '_' + month + '.gz64'; }
function cacheLoad_(folder, deviceId, month) {
  const o = cacheReadFile_(folder, cacheName_(deviceId, month), null);
  return (o && o.days) ? o : { v: 1, off: PLATFORM.UTC_OFFSET_H, days: {} };
}
function cacheSave_(folder, deviceId, month, obj) { cacheWriteFile_(folder, cacheName_(deviceId, month), obj); }
// زرار في القائمة: مسح الكاش بالكامل
function clearGpsCache() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('مسح كاش البيانات', 'هيتمسح مسار الأيام المحفوظة. التشغيل الجاي هيسحب كل حاجة من المنصة من الأول. متأكد؟', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('GPS_CACHE_FOLDER_ID');
  let n = 0;
  if (id) { try { const it = DriveApp.getFolderById(id).getFiles(); while (it.hasNext()) { it.next().setTrashed(true); n++; } } catch (e) {} }
  SpreadsheetApp.getActiveSpreadsheet().toast('اتمسح ' + n + ' ملف كاش.', 'الكاش', 6);
}

// وقت المنصة (ISO / ms) ← نص "yyyy-MM-dd HH:mm:ss" بتوقيت المنصة (نفس شكل ملفات الإكسل)
function platformParseIso_(s) {
  if (typeof s === 'number') return s;
  let x = String(s).replace(/([+-]\d\d)(\d\d)$/, '$1:$2').replace(/([+-]\d\d)$/, '$1:00');
  if (/^\d{4}-\d\d-\d\d \d/.test(x)) x = x.replace(' ', 'T');
  return Date.parse(x);
}
function platformWall_(s, offH) {
  const d = new Date(platformParseIso_(s) + offH * 3600000);
  return d.getUTCFullYear() + '-' + p2_(d.getUTCMonth() + 1) + '-' + p2_(d.getUTCDate()) + ' ' + p2_(d.getUTCHours()) + ':' + p2_(d.getUTCMinutes()) + ':' + p2_(d.getUTCSeconds());
}

// ردود المنصة ← نفس مصفوفات ملفات Routing Points / Trips Report اللي التحليل متعود عليها
function traccarToValues_(positions, trips, deviceName, offH) {
  const routeValues = [[], ['Report type:', 'Route'], [], ['Device:', deviceName], [],
    ['Valid', 'Time', 'Latitude', 'Longitude', 'Altitude', 'Speed', 'Address', 'Attributes']];
  positions.slice().sort(function (p, q) { return platformParseIso_(p.fixTime || p.deviceTime) - platformParseIso_(q.fixTime || q.deviceTime); }).forEach(function (p) {
    routeValues.push([p.valid !== false, platformWall_(p.fixTime || p.deviceTime, offH), p.latitude, p.longitude, p.altitude || 0,
      ((p.speed || 0) * 1.852).toFixed(1) + ' km/h', '', '']);
  });
  const tripValues = [[], ['Report type:', 'Trips'], [], ['Device:', deviceName], [],
    ['Start', 'Start Address', 'Start Odometer', 'End', 'End Address', 'End Odometer', 'Duration', 'Length']];
  trips.slice().sort(function (p, q) { return platformParseIso_(p.startTime) - platformParseIso_(q.startTime); }).forEach(function (t) {
    tripValues.push([platformWall_(t.startTime, offH), t.startAddress || '', t.startOdometer || '', platformWall_(t.endTime, offH), t.endAddress || '', t.endOdometer || '',
      Math.round((t.duration || 0) / 1000), ((t.distance || 0) / 1000).toFixed(1) + ' km']);
  });
  return { routeValues: routeValues, tripValues: tripValues };
}

/* ═══════════════════════════ متابعة حالة الـ GPS (Online / Offline / Unknown) ═══════════════════════════
   المصدر: /api/devices (الحالة) + /api/reports/events (أحداث deviceOnline / deviceOffline / deviceUnknown)
           + /api/positions (آخر موقع) + /api/reports/route (مكان العربية وقت آخر Offline للمتصلة حالياً) */
const GPS_STATUS = {
  LOOKBACK_DAYS: 30,       // بندوّر في أحداث الاتصال آخر كام يوم
  OUT_DAYS: 30,            // الجهاز اللي مقطوع من أكتر من كدا بيتحط في آخر التقرير تحت "خارج الخدمة"
  SILENT_HOURS: 2,         // متصلة في المنصة لكن مفيش بيانات جاية بقالها أكتر من كدا = "صامتة" (محتاجة متابعة)
  MIN_OFFLINE_MIN: 10,     // الانقطاع الأقل من كدا (دقايق) بيتعتبر رمشة اتصال وبيتجاهل (الأجهزة بتقطع وترجع في ثواني)
  BATCH: 15,               // عدد الطلبات المتوازية
  NEAR_KM: 50,             // أقرب موقع في Coordinates لحد المسافة دي بس بيتذكر ("على بعد X كم من …")
  ROUTE_BACK_MIN: 90,      // لإيجاد مكان العربية وقت الـ Offline: بنقرأ المسار قبله بالمدة دي
  FLEET_SHEET: 'متابعة حالة GPS',
  VEHICLE_PREFIX: 'حالة GPS '
};

// زرار "متابعة حالة ال GPS": تقرير شامل لكل العربيات
function gpsStatusRun(runId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  progress_(runId, 0, '');
  const cookie = traccarCookie_();
  progress_(runId, 1, '');
  const devices = traccarGet_('/api/devices', cookie).filter(function (d) { return !d.disabled; });
  const positions = {};
  traccarGet_('/api/positions', cookie).forEach(function (p) { positions[p.id] = p; });   // بدون باراميترات = آخر موقع لكل الأجهزة
  progress_(runId, 1, devices.length + ' جهاز');
  progress_(runId, 2, '', 0);
  const now = Date.now();
  const events = gpsStatusEvents_(cookie, devices, now, function (done, total) { progress_(runId, 2, done + ' من ' + total + ' جهاز', done / total); });
  progress_(runId, 3, '', 0);
  const infos = devices.map(function (d, i) {
    return gpsStatusCompute_(d, events[i].list, positions[d.positionId], now);
  });
  gpsStatusOffPositions_(cookie, devices, infos, function (done, total) { progress_(runId, 3, done + ' من ' + total, total ? done / total : 1); });
  progress_(runId, 4, '');
  let sites = [], named = [];
  try { sites = parseLocations_(platformLocValues_(ss), GPS_CONFIG).sites; } catch (e) {}
  try { named = namedLoad_(ss); } catch (e) {}
  const names = platformGpsNames_(ss);
  const rows = devices.map(function (d, i) {
    const inf = infos[i], m = /^\s*(\d+)/.exec(d.name);
    const loc = inf.loc ? gpsPlaceName_(inf.loc.lat, inf.loc.lon, sites, named) : null;
    const cur = (inf.cur && (inf.cur.lat || inf.cur.lon)) ? gpsPlaceName_(inf.cur.lat, inf.cur.lon, sites, named) : null;
    return { vehicle: m && names[Number(m[1])] ? names[Number(m[1])] : '', device: d.name, inf: inf, place: loc, curPlace: cur, evErr: events[i].err };
  });
  progress_(runId, 5, '');
  gpsStatusWriteFleet_(ss, rows, now);
  try { const nn = gpsRegisterUnknown_(ss, rows.map(function (x) { return { loc: x.inf.loc, place: x.place, cur: x.inf.status === 'online' ? x.inf.cur : null, curPlace: x.curPlace, vehicle: x.vehicle || gpsCleanName_(x.device) }; }), now); if (nn) progress_(runId, 5, nn + ' مكان جديد اتسجل في شيت "' + NAMED.SHEET + '"'); } catch (e) {}
  progress_(runId, 6, '');
  return 'ok';
}

// ─── جلب أحداث الاتصال لكل الأجهزة (بالتوازي) ───
function gpsEventsPath_(d, now) {
  return '/api/reports/events?deviceId=' + d.id + '&type=deviceOnline&type=deviceOffline&type=deviceUnknown&from=' + new Date(now - GPS_STATUS.LOOKBACK_DAYS * 86400000).toISOString() + '&to=' + new Date(now + 3600000).toISOString();
}
function gpsStatusEvents_(cookie, devices, now, onProg) {
  const paths = devices.map(function (d) { return gpsEventsPath_(d, now); });
  const res = traccarGetAll_(cookie, paths, onProg);
  return res.map(function (r) { return { list: r.data || [], err: r.err }; });
}

// ─── مكان العربية وقت آخر Offline للعربيات المتصلة حالياً ───
function gpsStatusOffPositions_(cookie, devices, infos, onProg) {
  const idx = [], paths = [];
  infos.forEach(function (inf, i) {
    if (inf.status === 'online' && inf.lastOffline) {
      idx.push(i);
      paths.push('/api/reports/route?deviceId=' + devices[i].id + '&from=' + new Date(inf.lastOffline - GPS_STATUS.ROUTE_BACK_MIN * 60000).toISOString() + '&to=' + new Date(inf.lastOffline).toISOString());
    }
  });
  const res = traccarGetAll_(cookie, paths, onProg);
  res.forEach(function (r, k) {
    const list = r.data;
    if (list && list.length) {
      const p = list[list.length - 1];
      infos[idx[k]].loc = { lat: p.latitude, lon: p.longitude, t: platformParseIso_(p.fixTime || p.serverTime || p.deviceTime) };
    } else infos[idx[k]].locNote = 'مفيش نقاط مسار قبل الـ Offline';
  });
}

// طلبات GET متوازية. بترجّع [{data, err}] بنفس ترتيب المسارات.
function traccarGetAll_(cookie, paths, onProg, batch, deadline) {
  const out = [], B = batch || GPS_STATUS.BATCH;
  const mk = function (p, ck) { return { url: PLATFORM.BASE_URL + p, headers: { Cookie: ck, Accept: 'application/json' }, muteHttpExceptions: true }; };
  let ck = cookie;
  for (let i = 0; i < paths.length; i += B) {
    checkCancel_();
    if (deadline && Date.now() > deadline) break;     // الوقت قرب يخلص: نرجّع اللي اتسحب لحد دلوقتي (out أقصر من paths)
    const part = paths.slice(i, i + B);
    let resp = fetchAllSafe_(part.map(function (p) { return mk(p, ck); }));
    if (resp.some(function (r) { return r.getResponseCode() === 401 || r.getResponseCode() === 403; })) {   // الجلسة انتهت: نجدد ونعيد الدفعة
      ck = traccarCookie_(true);
      resp = fetchAllSafe_(part.map(function (p) { return mk(p, ck); }));
    }
    resp.forEach(function (r) {
      let data = null, err = null;
      if (r.getResponseCode() === 200) { try { data = JSON.parse(r.getContentText()); } catch (e) { err = 'JSON'; } }
      else err = r.getResponseCode();
      out.push({ data: data, err: err });
    });
    if (onProg) onProg(Math.min(i + B, paths.length), paths.length);
  }
  return out;
}

// رقم الجهاز ← رقم السيارة (من شيت الربط)
function platformGpsNames_(ss) {
  const o = {};
  const sh = ss.getSheetByName(PLATFORM.MAP_SHEET);
  if (!sh) return o;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) { const n = Number(rows[i][0]); if (n && String(rows[i][2]).trim()) o[n] = String(rows[i][2]).trim(); }
  return o;
}

// ─── تحليل حالة جهاز واحد (دالة صافية — متختبرة) ───
function gpsStatusCompute_(d, eventList, pos, now) {
  const status = String(d.status || 'unknown').toLowerCase();
  const OFF = ['deviceOffline', 'deviceUnknown'];
  const minMs = GPS_STATUS.MIN_OFFLINE_MIN * 60000;
  // المنصة بتسجل وقت الحدث في serverTime (أو eventTime في بعض الإصدارات)
  const evs = (eventList || []).map(function (e) { return { t: platformParseIso_(e.eventTime || e.serverTime), type: e.type }; })
    .filter(function (e) { return !isNaN(e.t); }).sort(function (x, y) { return x.t - y.t; });
  // فترات الانقطاع: من أول Offline/Unknown لحد ما يرجع Online. الأقل من MIN_OFFLINE_MIN دقيقة = رمشة اتصال بتتجاهل
  const periods = [];
  let open = null, blips = 0;
  evs.forEach(function (e) {
    if (OFF.indexOf(e.type) >= 0) { if (open === null) open = e.t; }
    else if (e.type === 'deviceOnline' && open !== null) {
      if (e.t - open >= minMs) periods.push({ s: open, e: e.t }); else blips++;
      open = null;
    }
  });
  const lastData = pos ? platformParseIso_(pos.serverTime || pos.fixTime || pos.deviceTime) : null;
  const upd = d.lastUpdate ? platformParseIso_(d.lastUpdate) : null;
  const here = pos ? { lat: pos.latitude, lon: pos.longitude, t: lastData } : null;
  const r = { status: status, since: null, durMs: null, lastOffline: null, lastOnline: null, loc: null, note: '', events: evs, blips: blips,
    cur: here, lastData: lastData !== null ? lastData : upd, periods: periods, openSince: open,
    drops7: periods.filter(function (p) { return p.s >= now - 7 * 86400000; }).length };
  if (status === 'online') {
    const lp = periods.length ? periods[periods.length - 1] : null;
    if (lp) { r.since = lp.e; r.lastOffline = lp.s; }
    else r.note = 'مفيش انقطاع أطول من ' + GPS_STATUS.MIN_OFFLINE_MIN + ' دقايق خلال آخر ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم';
    // المكان وقت الـ Offline بيتحدد بعدين من المسار (gpsStatusOffPositions_)
  } else {
    // بداية الانقطاع الحالي = أول حدث في آخر سلسلة Offline/Unknown
    let i = evs.length - 1;
    if (i >= 0 && OFF.indexOf(evs[i].type) >= 0) { while (i > 0 && OFF.indexOf(evs[i - 1].type) >= 0) i--; r.since = evs[i].t; }
    if (r.since === null) { r.since = upd; if (r.since !== null) r.note = 'مفيش حدث انقطاع مسجل — اتحسب من آخر تحديث للجهاز في المنصة'; }
    r.lastOnline = lastData !== null ? lastData : upd;
    r.loc = here;
  }
  if (r.since !== null) r.durMs = Math.max(0, now - r.since);
  return r;
}

// أقرب موقع معروف (من شيت Coordinates). مفيش أسماء من جوجل ماب.

// ─── تقييم صحة جهاز الـ GPS وتأثيره على دقة النقلات والتحليل (بيتكتب في شيت حالة السيارة) ───
// inf = نتيجة gpsStatusCompute_ • positions = نقاط المنصة الخام للفترة • quality = report.quality (ممكن تكون null) • hard = العربية في HARD_VEHICLES
function gpsHealthAssess_(inf, positions, quality, hard) {
  const issues = [], effects = [];
  let score = 0, rangeTxt = '';
  const P = (positions || []).map(function (p) { return { t: platformParseIso_(p.fixTime || p.deviceTime), lat: p.latitude, lon: p.longitude, sp: (p.speed || 0) * 1.852, ok: p.valid !== false }; })
    .filter(function (p) { return !isNaN(p.t) && !isNaN(p.lat) && !isNaN(p.lon); }).sort(function (a, b) { return a.t - b.t; });
  const n = P.length;
  if (n > 50) {
    rangeTxt = n + ' نقطة من ' + gpsShort_(P[0].t, P[n - 1].t) + ' إلى ' + gpsShort_(P[n - 1].t, P[n - 1].t);
    // 1) نقاط من غير إشارة
    const inv = P.filter(function (p) { return !p.ok; }).length, invPct = Math.round(inv / n * 100);
    if (invPct >= 10) {
      score += invPct >= 40 ? 3 : invPct >= 20 ? 2 : 1;
      issues.push('نقاط بدون إشارة (GPS fix): ' + invPct + '٪ من النقاط (' + inv + ' من ' + n + ').');
      effects.push('النقاط اللي من غير إشارة بتتشال من التحليل، فالعربية بتظهر ثابتة في آخر مكان معروف لفترات طويلة. وقت الوصول والمغادرة من المواقع بيبقى تقريبي، وأي زيارة قصيرة لموقع ممكن تتفوّت.');
    }
    // 2) سرعة وهمية والإحداثيات ثابتة + 3) انقطاع إشارة والعربية اتحركت
    let fake = 0, dark = 0, darkSec = 0, darkMax = 0;
    let prevOk = null;
    P.forEach(function (p, i) {
      if (i > 0 && p.sp > 0 && p.sp <= 15 && distM_(P[i - 1].lat, P[i - 1].lon, p.lat, p.lon) < 15) fake++;
      if (p.ok) {
        if (prevOk && p.t - prevOk.t >= 5400000 && distM_(prevOk.lat, prevOk.lon, p.lat, p.lon) > 1000) { dark++; darkSec += p.t - prevOk.t; darkMax = Math.max(darkMax, p.t - prevOk.t); }   // بالمللي ثانية
        prevOk = p;
      }
    });
    const fakePct = Math.round(fake / n * 100);
    if (fakePct >= 5) {
      score += fakePct >= 15 ? 2 : 1;
      issues.push('سرعة وهمية والعربية ثابتة: ' + fakePct + '٪ من النقاط (' + fake + ' نقطة بسرعة أكبر من صفر والإحداثيات نفسها).');
      effects.push(hard
        ? 'الجهاز بيبعت سرعة وهي واقفة. الكود بيصفّر السرعة دي للعربية دي (بروفايل العربيات الصعبة)، فالوقوف بيتحسب صح، لكن الرحلات في ملف المنصة ممكن تتدمج وتظهر أطول من حقيقتها.'
        : 'الجهاز بيبعت سرعة وهي واقفة، فالوقوف الطويل ممكن يظهر كحركة ورحلات بتتدمج. ضيف رقم العربية في HARD_VEHICLES (في الإعدادات) عشان الكود يصحّح ده.');
    }
    if (dark > 0) {
      score += dark >= 3 ? 3 : 2;
      issues.push('العربية اتحركت وإشارة الـ GPS مقطوعة: ' + dark + (dark === 1 ? ' مرة' : dark <= 10 ? ' مرات' : ' مرة') + '، مجموعها ' + gpsDurTxt_(darkSec) + '، وأطولها ' + gpsDurTxt_(darkMax) + '. (التفاصيل في شيت التنبيهات)');
      effects.push('أثناء الانقطاع مفيش تتبع، فلو العربية زارت الخلاطة أو الكسارة أو موقع تفريغ في الوقت ده، النقلة ممكن تتفوّت أو تتدمج مع اللي بعدها. أي نقلة قريبة من أوقات الانقطاع دي راجعها يدويًا.');
    }
  } else { issues.push('نقاط الفترة قليلة (' + n + ' نقطة)، فالتقييم من نقاط الفترة مش ممكن.'); }
  // 4) تقارير المشاوير (من تحليل التقرير نفسه)
  if (quality) {
    if (quality.jumps >= 1) {
      score += quality.jumps >= 10 ? 2 : 1;
      issues.push('قفزات مستحيلة في الموقع: ' + quality.jumps + ' نقطة اتشالت قبل التحليل.');
      effects.push('نقاط بعيدة جدًا (زي نقطة في بلد تانية) بتتشال، فعدد النقلات مش متأثر، لكن الأطوال المسجلة في ملف المنصة بتبقى مضروبة بأرقام كبيرة وغير حقيقية.');
    }
    const badKm = (quality.fixedLegs || 0) + (quality.suspectLegs || 0);
    if (badKm >= 1) {
      score += badKm >= 10 ? 2 : 1;
      issues.push('رحلات أطوالها غير منطقية: ' + badKm + ' رحلة (' + (quality.fixedLegs || 0) + ' اتصححت من نقاط الـ GPS، و' + (quality.suspectLegs || 0) + ' فاضلة مشكوك فيها وملوّنة بالأحمر).');
      effects.push('الكيلومترات في التقرير أقل دقة، لكن عدد النقلات بيعتمد على زيارة المواقع مش على الأطوال، فهو أقل تأثرًا. الرحلات الحمرا راجعها يدويًا.');
    }
  }
  // 5) انقطاعات الجهاز نفسه (من أحداث المنصة)
  const per = (inf && inf.periods) ? inf.periods.length : 0, drops7 = inf ? (inf.drops7 || 0) : 0, blips = inf ? (inf.blips || 0) : 0;
  if (drops7 >= 3 || per >= 8) {
    score += (drops7 >= 8 || per >= 20) ? 2 : 1;
    issues.push('انقطاعات الجهاز (Offline/Unknown أطول من ' + GPS_STATUS.MIN_OFFLINE_MIN + ' دقايق): ' + drops7 + ' في آخر 7 أيام، و' + per + ' في آخر ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم.');
    effects.push('الانقطاعات المتكررة معناها إن العربية بتشتغل في أوقات من غير تتبع. النقلات اللي بتحصل وقت الانقطاع ممكن ما تتحسبش.');
  }
  if (blips >= 20) {
    score += 1;
    issues.push('رمشات اتصال قصيرة (أقل من ' + GPS_STATUS.MIN_OFFLINE_MIN + ' دقايق): ' + blips + ' مرة. بتتجاهل في حالة الجهاز.');
    effects.push('الرمشات الكتير علامة على كابل أو تغذية أو شريحة ضعيفة. لوحدها مش بتأثر على النقلات، لكنها بتزيد احتمال فقدان نقاط.');
  }
  const lvl = score === 0 ? 0 : score <= 2 ? 1 : score <= 5 ? 2 : 3;
  const L = [
    ['سليم — مفيش مشاكل ملحوظة', 'عالية', '#e6f4ea', '#137333', 'عدد النقلات والتحليل يُعتمد عليهم.'],
    ['ملحوظات بسيطة', 'عالية', '#fff8e1', '#b06000', 'عدد النقلات يُعتمد عليه، مع مراجعة سريعة للمشاكل المذكورة.'],
    ['متقطّع — جزء من النقلات والأطوال تقديري', 'متوسطة', '#fef3e0', '#b06000', 'راجع النقلات قريب أوقات الانقطاع والرحلات الحمرا قبل ما تعتمد الأرقام.'],
    ['ضعيف — محتاج مراجعة يدوية', 'منخفضة', '#fce8e6', '#c5221f', 'ما تعتمدش على عدد النقلات من غير مراجعة يدوية لكل يوم. الأفضل إصلاح الجهاز أو تركيبه من جديد.']
  ][lvl];
  if (!issues.length) issues.push('مفيش مشاكل مرصودة في الفترة.');
  if (!effects.length) effects.push('لا يوجد تأثير على النقلات.');
  return { level: lvl, label: L[0], confidence: L[1], bg: L[2], fg: L[3], advice: L[4], issues: issues, effects: effects, rangeTxt: rangeTxt };
}

function gpsPlaceName_(lat, lon, sites, named) {
  // Coordinates → اسمه. Places → اسمه (+ على بعد من أقرب موقع في Coordinates لو في نفس المنطقة). غير كده: على بعد… أو "موقع غير معروف"
  const best = nearestSite_(lat, lon, sites);
  if (best && best.d <= best.s.radius) return best.s.label || best.s.name;
  let nb = null;
  (named || []).forEach(function (n) { const dm = distM_(lat, lon, n.lat, n.lon); if (dm <= n.r && (!nb || dm < nb.d)) nb = { d: dm, n: n }; });
  const nt = nearTxt_(lat, lon, sites);
  if (nb) return nb.n.name + (nt ? ' (' + nt + ')' : '');
  return nt || 'موقع غير معروف';
}
function gpsIsUnknownPlace_(name) { return name === 'خارج المواقع المعروفة' || name === 'موقع غير معروف' || /^على بعد /.test(String(name)); }

/* ═══════════ شيت "أماكن مسماة": الأماكن اللي مش في Coordinates بتتسجل هنا وانت بتكتب اسمها مرة واحدة ═══════════
   مش بنضيفها لشيت Coordinates عشان ده بيحدد مواقع النقلات (خلاطة/كسارة/تفريغ) ولو اتضاف مكان جديد هناك هيغيّر عد النقلات.
   هنا الأسماء بتستخدم في تقارير الحالة والأماكن بس. */
const NAMED = { SHEET: 'Places', OLD_SHEET: 'أماكن مسماة', RADIUS: 300, PENDING_DAYS: 30, MAX_NEW: 60 };

// الشيت بتاع الأماكن (لو لسه بالاسم القديم "أماكن مسماة" بيتغير اسمه لـ Places ومحتواه بيفضل)
function namedSheet_(ss) {
  let sh = ss.getSheetByName(NAMED.SHEET);
  if (!sh) { const old = ss.getSheetByName(NAMED.OLD_SHEET); if (old) { try { old.setName(NAMED.SHEET); sh = old; } catch (e) { sh = old; } } }
  return sh;
}
function namedLoad_(ss) {
  const sh = namedSheet_(ss);
  if (!sh || sh.getLastRow() < 3) return [];
  const v = sh.getRange(3, 1, sh.getLastRow() - 2, 4).getValues(), out = [];
  v.forEach(function (r) {
    const name = String(r[0] || '').trim(), la = Number(r[1]), lo = Number(r[2]);
    if (name && isFinite(la) && isFinite(lo) && (la || lo)) out.push({ name: name, lat: la, lon: lo, r: Number(r[3]) > 0 ? Number(r[3]) : NAMED.RADIUS });
  });
  return out;
}

// items: [{lat, lon, vehicle}] لأماكن العربيات اللي مش معروفة. بتتسجل (أو بيزيد عدّادها) في الشيت
function namedRegister_(ss, items, now) {
  items = (items || []).filter(function (x) { return x && isFinite(x.lat) && isFinite(x.lon) && (x.lat || x.lon); });
  if (!items.length) return 0;
  let sh = namedSheet_(ss);
  if (!sh) {
    let act = null; try { act = ss.getActiveSheet(); } catch (e) {}
    sh = ss.insertSheet(NAMED.SHEET);
    if (act) { try { ss.setActiveSheet(act); } catch (e) {} }   // إنشاء الشيت ما يخطفش الشاشة من التقرير
    sh.getRange(1, 1, 1, 8).merge().setValue('اكتب اسم المكان في العمود A وسيبه — الأماكن اللي ليها اسم هتظهر بالاسم ده في تقارير الحالة وتقارير النقلات. الصفوف الصفرا لسه من غير اسم.')
      .setFontWeight('bold').setBackground('#fff8e1').setWrap(true).setVerticalAlignment('middle');
    sh.setRowHeight(1, 36);
    sh.getRange(2, 1, 1, 8).setValues([['اسم المكان (اكتبه هنا)', 'خط العرض', 'خط الطول', 'نصف القطر (م)', 'عدد المرات', 'آخر ظهور', 'آخر عربية', 'الخريطة']])
      .setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff').setHorizontalAlignment('center');
    [210, 90, 90, 90, 80, 110, 200, 80].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
    sh.setFrozenRows(2);
    try { sh.setTabColor('#f9ab00'); } catch (e) {}
  }
  const last = sh.getLastRow();
  const n = Math.max(0, last - 2);
  const data = n ? sh.getRange(3, 1, n, 9).getValues() : [];
  const rows = data.map(function (r, i) { return { i: i, name: String(r[0] || '').trim(), lat: Number(r[1]), lon: Number(r[2]), r: Number(r[3]) > 0 ? Number(r[3]) : NAMED.RADIUS, cnt: Number(r[4]) || 0, txt: r[5], veh: r[6], t: Number(r[8]) || 0, dirty: false }; });
  const added = [];
  items.forEach(function (x) {
    let hit = null;
    rows.concat(added).forEach(function (q) { const dm = distM_(x.lat, x.lon, q.lat, q.lon); if (dm <= q.r && (!hit || dm < hit.d)) hit = { d: dm, q: q }; });
    const stamp = gpsShort_(now, now);
    if (hit) { hit.q.cnt++; hit.q.txt = stamp; hit.q.veh = x.vehicle || hit.q.veh; hit.q.t = now; hit.q.dirty = true; }
    else if (added.length < NAMED.MAX_NEW) added.push({ name: '', lat: Math.round(x.lat * 1e5) / 1e5, lon: Math.round(x.lon * 1e5) / 1e5, r: x.r > 0 ? x.r : NAMED.RADIUS, cnt: 1, txt: stamp, veh: x.vehicle || '', t: now, isNew: true });
  });
  // تحديث العدّاد وآخر ظهور (أعمدة E:G + I) للصفوف الموجودة — من غير ما نلمس اسم انت كتبته
  rows.forEach(function (q) {
    if (!q.dirty) return;
    sh.getRange(q.i + 3, 5, 1, 3).setValues([[q.cnt, q.txt, q.veh]]);
    sh.getRange(q.i + 3, 9).setValue(q.t);
  });
  if (added.length) {
    const at = last < 2 ? 3 : last + 1;
    ensureGrid_(sh, at + added.length, 9);
    sh.getRange(at, 1, added.length, 9).setValues(added.map(function (q) { return [q.name, q.lat, q.lon, q.r, q.cnt, q.txt, q.veh, 'فتح', q.t]; }));
    sh.getRange(at, 1, added.length, 1).setBackground('#fff59d');
    added.forEach(function (q, k) { sh.getRange(at + k, 8).setRichTextValue(SpreadsheetApp.newRichTextValue().setText('فتح').setLinkUrl(gpsMapUrl_(q.lat, q.lon)).build()); });
    try { sh.hideColumns(9); } catch (e) {}
  }
  // تنضيف: الصفوف من غير اسم ومشفناهاش من أكتر من PENDING_DAYS يوم
  const cutoff = now - NAMED.PENDING_DAYS * 86400000, del = [];
  rows.forEach(function (q) { if (!q.name && q.t && q.t < cutoff) del.push(q.i + 3); });
  del.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  return added.length;
}

// بيجمّع ويسجل الأماكن غير المعروفة من نتيجة تقرير الحالة
function gpsRegisterUnknown_(ss, list, now) {
  const items = [];
  list.forEach(function (x) {
    if (x.loc && gpsIsUnknownPlace_(x.place)) items.push({ lat: x.loc.lat, lon: x.loc.lon, vehicle: x.vehicle });
    if (x.cur && gpsIsUnknownPlace_(x.curPlace)) items.push({ lat: x.cur.lat, lon: x.cur.lon, vehicle: x.vehicle });
  });
  return namedRegister_(ss, items, now);
}

function gpsDurTxt_(ms) {
  if (ms === null || ms === undefined) return '—';
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60, parts = [];
  if (d) parts.push(d + ' يوم');
  if (h) parts.push(h + ' ساعة');
  if (mi && d < 3) parts.push(mi + ' دقيقة');
  return parts.length ? parts.join(' و') : 'أقل من دقيقة';
}
function gpsTimeTxt_(ms) { return ms === null || ms === undefined || isNaN(ms) ? '—' : platformWall_(ms, PLATFORM.UTC_OFFSET_H).slice(0, 16); }
function gpsStatusLabel_(s) { return s === 'online' ? 'Online (متصلة)' : s === 'offline' ? 'Offline (مقطوعة)' : 'Unknown (غير معروفة)'; }
function gpsStatusColor_(s) { return s === 'online' ? '#d9ead3' : s === 'offline' ? '#f4cccc' : '#e0e0e0'; }
function gpsEventLabel_(t) { return t === 'deviceOnline' ? 'Online' : t === 'deviceOffline' ? 'Offline' : t === 'deviceUnknown' ? 'Unknown' : t; }
function gpsMapUrl_(lat, lon) { return 'https://www.google.com/maps?q=' + lat + ',' + lon; }

// خلية فيها لينك الخريطة (من غير HYPERLINK عشان إعدادات اللغة)
function gpsSetLink_(sh, r, c, loc) {
  if (!loc) { sh.getRange(r, c).setValue('—'); return; }
  const txt = loc.lat.toFixed(5) + ', ' + loc.lon.toFixed(5);
  sh.getRange(r, c).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(txt).setLinkUrl(gpsMapUrl_(loc.lat, loc.lon)).build());
}

/* ── تقرير المتابعة الشامل: عربيات مجمعة حسب اللي محتاج تدخل ── */
function gpsShort_(ms, now) {
  if (ms === null || ms === undefined || isNaN(ms)) return '—';
  const w = platformWall_(ms, PLATFORM.UTC_OFFSET_H);   // yyyy-MM-dd HH:mm:ss
  const yr = w.slice(0, 4) !== platformWall_(now, PLATFORM.UTC_OFFSET_H).slice(0, 4) ? '/' + w.slice(0, 4) : '';
  return w.slice(8, 10) + '/' + w.slice(5, 7) + yr + ' ' + w.slice(11, 16);
}
function gpsAgo_(ms, now) { return ms === null || ms === undefined ? '—' : 'منذ ' + gpsDurTxt_(Math.max(0, now - ms)); }
function gpsCleanName_(n) { return String(n || '').replace(/\+?\d{10,}/g, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function gpsPlaceTxt_(loc, name) {
  if (!loc || (!loc.lat && !loc.lon)) return '—';
  return name || 'موقع غير معروف';
}
// تصنيف الجهاز: ok | silent | off | unk | out
function gpsGroupOf_(inf, now) {
  const outMs = GPS_STATUS.OUT_DAYS * 86400000;
  if (inf.status === 'online') return (inf.lastData !== null && now - inf.lastData > GPS_STATUS.SILENT_HOURS * 3600000) ? 'silent' : 'ok';
  if (inf.durMs !== null && inf.durMs > outMs) return 'out';
  return inf.status === 'offline' ? 'off' : 'unk';
}

function gpsStatusWriteFleet_(ss, rows, now) {
  const G = {
    off:    { title: '🔴  مقطوعة (Offline) — محتاجة متابعة', bg: '#fce8e6', fg: '#c5221f' },
    unk:    { title: '⚪  حالتها غير معروفة (Unknown)',       bg: '#f1f3f4', fg: '#5f6368' },
    silent: { title: '🟠  متصلة بالمنصة لكن مفيش بيانات جاية', bg: '#fef3e0', fg: '#b06000' },
    ok:     { title: '🟢  شغالة وسليمة',                      bg: '#e6f4ea', fg: '#137333' },
    out:    { title: '⚫  خارج الخدمة (مقطوعة من أكتر من ' + GPS_STATUS.OUT_DAYS + ' يوم)', bg: '#e8eaed', fg: '#3c4043' }
  };
  const order = ['off', 'unk', 'silent', 'ok', 'out'];
  const groups = { off: [], unk: [], silent: [], ok: [], out: [] };
  rows.forEach(function (r) { r.g = gpsGroupOf_(r.inf, now); groups[r.g].push(r); });
  const dur = function (r) { return r.inf.durMs === null ? -1 : r.inf.durMs; };
  groups.off.sort(function (a, b) { return dur(b) - dur(a); });
  groups.unk.sort(function (a, b) { return dur(b) - dur(a); });
  groups.silent.sort(function (a, b) { return (a.inf.lastData || 0) - (b.inf.lastData || 0); });
  groups.ok.sort(function (a, b) { return (b.inf.drops7 - a.inf.drops7) || (dur(a) - dur(b)); });
  groups.out.sort(function (a, b) { return dur(a) - dur(b); });

  const sh = getOrCreateSheet_(ss, GPS_STATUS.FLEET_SHEET);
  sh.setRightToLeft(false);   // من الشمال لليمين زي باقي التقارير
  try { sh.setHiddenGridlines(true); } catch (e) {}
  const NC = 7;
  const H = ['العربية', 'الحالة', 'آخر إشارة وصلت', 'حالتها دلوقتي بقالها', 'مكانها', 'آخر انقطاع / آخر اتصال', 'انقطاعات آخر 7 أيام'];
  const W = [230, 110, 120, 230, 230, 200, 90];   // الكروت: 5 مجموعات أعمدة (A) (B+C) (D) (E) (F+G) بعرض شبه متساوي
  for (let c = 0; c < NC; c++) sh.setColumnWidth(c + 1, W[c]);

  sh.getRange(1, 1, 1, NC).merge().setValue('متابعة حالة أجهزة الـ GPS').setFontSize(18).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f3a5f').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 42);
  sh.getRange(2, 1, 1, NC).merge().setValue('اتحدّث ' + gpsShort_(now, now) + '  •  ' + rows.length + ' جهاز').setFontColor('#5f6368').setHorizontalAlignment('center');
  // كروت الأرقام
  const cards = [['off', 'مقطوعة'], ['unk', 'غير معروفة'], ['silent', 'صامتة'], ['ok', 'سليمة'], ['out', 'خارج الخدمة']];
  const span = [[1, 1], [2, 2], [4, 1], [5, 1], [6, 2]];   // [أول عمود, عدد الأعمدة] لكل كارت
  cards.forEach(function (c, i) {
    const col = span[i][0], n = span[i][1];
    const top = sh.getRange(3, col, 1, n), bot = sh.getRange(4, col, 1, n);
    if (n > 1) { top.merge(); bot.merge(); }
    top.setValue(groups[c[0]].length).setFontSize(26).setFontWeight('bold').setFontColor(G[c[0]].fg).setBackground(G[c[0]].bg).setHorizontalAlignment('center').setVerticalAlignment('middle');
    bot.setValue(c[1]).setFontSize(11).setFontColor(G[c[0]].fg).setBackground(G[c[0]].bg).setHorizontalAlignment('center');
  });
  sh.setRowHeight(3, 44);
  sh.getRange(3, 1, 2, NC).setBorder(true, true, true, true, true, true, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THICK);

  let r = 6;
  order.forEach(function (key) {
    const list = groups[key];
    if (!list.length) return;
    sh.getRange(r, 1, 1, NC).merge().setValue(G[key].title + '   (' + list.length + ')').setFontWeight('bold').setFontSize(13).setFontColor(G[key].fg).setBackground(G[key].bg).setVerticalAlignment('middle');
    sh.setRowHeight(r, 30); r++;
    sh.getRange(r, 1, 1, NC).setValues([H]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f3a5f').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true).setFontSize(10);
    sh.setRowHeight(r, 28); r++;
    const body = list.map(function (x) {
      const inf = x.inf, on = inf.status === 'online';
      const nm = (x.vehicle ? x.vehicle + ' — ' : '') + gpsCleanName_(x.device);
      const stTxt = key === 'silent' ? 'Online (صامتة)' : key === 'out' ? 'خارج الخدمة' : inf.status === 'online' ? 'Online' : inf.status === 'offline' ? 'Offline' : 'Unknown';
      const sig = gpsAgo_(inf.lastData, now) + '\n' + gpsShort_(inf.lastData, now);
      const since = (on && inf.since === null) ? 'أكتر من ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم' : (inf.since === null ? '—' : gpsDurTxt_(inf.durMs) + '\n(من ' + gpsShort_(inf.since, now) + ')');
      let place, last;
      if (on) {
        place = gpsPlaceTxt_(inf.cur, x.curPlace);
        last = inf.lastOffline ? 'Offline ' + gpsShort_(inf.lastOffline, now) + '\nكانت عند: ' + (inf.loc ? gpsPlaceTxt_(inf.loc, x.place) : (inf.locNote || '—'))
                               : 'مفيش انقطاع أطول من ' + GPS_STATUS.MIN_OFFLINE_MIN + ' د\nفي آخر ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم';
      } else {
        place = gpsPlaceTxt_(inf.loc, x.place);
        last = 'كانت Online حتى\n' + gpsShort_(inf.lastOnline, now);
      }
      return [nm, stTxt, sig, since, place, last, inf.drops7];
    });
    const rg = sh.getRange(r, 1, list.length, NC);
    rg.setValues(body).setWrap(true).setVerticalAlignment('middle').setHorizontalAlignment('center').setFontSize(11);
    sh.getRange(r, 1, list.length, 1).setFontWeight('bold');
    sh.getRange(r, 2, list.length, 1).setFontWeight('bold').setFontColor(G[key].fg).setBackground(G[key].bg);
    rg.setBorder(null, null, true, null, null, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
    list.forEach(function (x, i) {
      const rr = r + i, inf = x.inf;
      sh.setRowHeight(rr, 52);
      const loc = inf.status === 'online' ? inf.cur : inf.loc;
      if (loc && (loc.lat || loc.lon)) {
        const txt = body[i][4];
        sh.getRange(rr, 5).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(txt).setLinkUrl(gpsMapUrl_(loc.lat, loc.lon)).build());
      }
      const dc = sh.getRange(rr, 7);
      if (inf.drops7 >= 8) dc.setBackground('#fce8e6').setFontColor('#c5221f').setFontWeight('bold');
      else if (inf.drops7 >= 3) dc.setBackground('#fef3e0').setFontColor('#b06000').setFontWeight('bold');
      if (key === 'out') sh.getRange(rr, 1, 1, NC).setFontColor('#80868b');
    });
    r += list.length + 1;
  });
  centerSheet_(sh);
  ss.setActiveSheet(sh);
}

// شيت حالة الـ GPS للسيارة اللي التقرير طالع بيها (بيتكتب مع باقي الشيتات)
function gpsStatusWriteVehicle_(ss, vehicle, device, inf, place, curPlace, evErr, now, health) {
  vehicle = safeVeh_(vehicle);
  const sh = getOrCreateSheet_(ss, GPS_STATUS.VEHICLE_PREFIX + vehicle);
  sh.setRightToLeft(false);   // من الشمال لليمين زي باقي التقارير
  try { sh.setHiddenGridlines(true); } catch (e) {}
  const on = inf.status === 'online', NC = 4;
  const col = { online: ['#e6f4ea', '#137333'], offline: ['#fce8e6', '#c5221f'], unknown: ['#f1f3f4', '#5f6368'] }[inf.status] || ['#f1f3f4', '#5f6368'];
  [170, 170, 170, 170].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  const merged = function (r, c, nc, v) { return sh.getRange(r, c, 1, nc).merge().setValue(v); };
  merged(1, 1, NC, 'حالة جهاز الـ GPS — سيارة ' + vehicle).setFontSize(17).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f3a5f').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 40);
  merged(2, 1, NC, gpsCleanName_(device) + '  •  اتحدّث ' + gpsShort_(now, now)).setFontColor('#5f6368').setHorizontalAlignment('center');
  merged(3, 1, NC, gpsStatusLabel_(inf.status)).setFontSize(16).setFontWeight('bold').setFontColor(col[1]).setBackground(col[0]).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(3, 38);
  // كروت
  const stale = on && inf.lastData !== null && now - inf.lastData > GPS_STATUS.SILENT_HOURS * 3600000;
  const cards = [
    [(on && inf.since === null) ? 'أكتر من ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم' : gpsDurTxt_(inf.durMs), on ? 'متصلة بقالها' : (inf.status === 'offline' ? 'مقطوعة بقالها' : 'Unknown بقالها')],
    [gpsAgo_(inf.lastData, now), 'آخر إشارة وصلت' + (stale ? ' ⚠' : '')],
    [inf.drops7, 'انقطاعات آخر 7 أيام'],
    [(inf.periods || []).length, 'انقطاعات آخر ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم']
  ];
  cards.forEach(function (c, i) {
    sh.getRange(4, i + 1).setValue(c[0]).setFontSize(15).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true).setBackground('#f8f9fa');
    sh.getRange(5, i + 1).setValue(c[1]).setFontSize(10).setFontColor('#5f6368').setHorizontalAlignment('center').setBackground('#f8f9fa');
  });
  sh.setRowHeight(4, 44);
  if (inf.drops7 >= 8) sh.getRange(4, 3).setFontColor('#c5221f'); else if (inf.drops7 >= 3) sh.getRange(4, 3).setFontColor('#b06000');
  if (stale) sh.getRange(4, 2).setFontColor('#b06000');
  sh.getRange(4, 1, 2, NC).setBorder(true, true, true, true, true, true, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THICK);
  // المكان
  let r = 7;
  const kv = function (label, val, loc) {
    sh.getRange(r, 1).setValue(label).setFontWeight('bold').setBackground('#f1f3f4').setVerticalAlignment('middle');
    const c = sh.getRange(r, 2, 1, 3).merge().setVerticalAlignment('middle').setWrap(true);
    if (loc && (loc.lat || loc.lon)) c.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(val).setLinkUrl(gpsMapUrl_(loc.lat, loc.lon)).build());
    else c.setValue(val);
    sh.setRowHeight(r, 30); r++;
  };
  const rowsStart = r;
  if (on) {
    kv('مكانها دلوقتي', gpsPlaceTxt_(inf.cur, curPlace), inf.cur);
    kv('Online من', (on && inf.since === null) ? 'أكتر من ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم' : gpsShort_(inf.since, now));
    kv('آخر انقطاع', inf.lastOffline ? gpsShort_(inf.lastOffline, now) + '  (كانت عند: ' + (inf.loc ? gpsPlaceTxt_(inf.loc, place) : (inf.locNote || '—')) + ')' : 'مفيش انقطاع أطول من ' + GPS_STATUS.MIN_OFFLINE_MIN + ' دقايق في آخر ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم', inf.loc);
  } else {
    kv('آخر مكان قبل الانقطاع', gpsPlaceTxt_(inf.loc, place), inf.loc);
    kv((inf.status === 'offline' ? 'Offline' : 'Unknown') + ' من', gpsShort_(inf.since, now));
    kv('آخر مرة كانت Online', gpsShort_(inf.lastOnline, now));
  }
  if (inf.note) kv('ملاحظة', inf.note);
  if (evErr) kv('سجل الأحداث', 'غير متاح (' + evErr + ')');
  sh.getRange(rowsStart, 1, r - rowsStart, NC).setBorder(null, null, true, null, null, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  // فترات الانقطاع
  r++;
  merged(r, 1, NC, 'آخر فترات الانقطاع (الأطول من ' + GPS_STATUS.MIN_OFFLINE_MIN + ' دقايق)').setFontWeight('bold').setFontSize(13).setBackground('#e8eaed').setVerticalAlignment('middle');
  sh.setRowHeight(r, 28); r++;
  const per = (inf.periods || []).slice(-10).reverse().map(function (p) { return [gpsShort_(p.s, now), gpsShort_(p.e, now), gpsDurTxt_(p.e - p.s), 'رجعت Online']; });
  if (!on && inf.since !== null) per.unshift([gpsShort_(inf.since, now), '—', gpsDurTxt_(inf.durMs), 'لسه مقطوعة']);
  if (per.length) {
    sh.getRange(r, 1, 1, NC).setValues([['من', 'إلى', 'المدة', 'الحالة']]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f3a5f').setHorizontalAlignment('center');
    sh.getRange(r + 1, 1, per.length, NC).setValues(per).setHorizontalAlignment('center');
    sh.getRange(r + 1, 1, per.length, NC).setBorder(null, null, true, null, null, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
    r += per.length + 1;
  } else { merged(r, 1, NC, 'مفيش انقطاعات أطول من ' + GPS_STATUS.MIN_OFFLINE_MIN + ' دقايق في آخر ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم ✔').setFontColor('#137333'); r++; }
  // تقييم صحة الـ GPS وتأثيره على التحليل
  if (health) {
    const txtH = function (txt, w) { return Math.max(24, 18 * Math.ceil(String(txt).length / (w || 72)) + 8); };
    r++;
    merged(r, 1, NC, 'تقييم صحة جهاز الـ GPS وتأثيره على التحليل').setFontWeight('bold').setFontSize(13).setBackground('#e8eaed').setVerticalAlignment('middle');
    sh.setRowHeight(r, 28); r++;
    merged(r, 1, NC, health.label).setFontWeight('bold').setFontSize(14).setBackground(health.bg).setFontColor(health.fg).setVerticalAlignment('middle');
    sh.setRowHeight(r, 34); r++;
    merged(r, 1, NC, 'درجة الاعتماد على عدد النقلات: ' + health.confidence + '. ' + health.advice).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
    sh.setRowHeight(r, txtH(health.advice, 60)); r++;
    merged(r, 1, NC, 'المشاكل المرصودة').setFontWeight('bold').setBackground('#f1f3f4'); r++;
    health.issues.forEach(function (t) { merged(r, 1, NC, '• ' + t).setWrap(true).setVerticalAlignment('middle'); sh.setRowHeight(r, txtH(t)); r++; });
    merged(r, 1, NC, 'تأثيرها على النقلات والتحليل').setFontWeight('bold').setBackground('#f1f3f4'); r++;
    health.effects.forEach(function (t) { merged(r, 1, NC, '• ' + t).setWrap(true).setVerticalAlignment('middle'); sh.setRowHeight(r, txtH(t)); r++; });
    if (health.rangeTxt) { merged(r, 1, NC, 'التقييم محسوب من: ' + health.rangeTxt + ' + أحداث الاتصال آخر ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم.').setFontColor('#80868b').setFontSize(9).setWrap(true); sh.setRowHeight(r, 28); r++; }
  }
  r++; merged(r, 1, NC, 'ملحوظة: الأوقات بتوقيت المنصة وأسماء الأماكن من شيت Coordinates وشيت "' + NAMED.SHEET + '".').setFontColor('#80868b').setFontSize(9).setWrap(true); sh.setRowHeight(r, 24);
  centerSheet_(sh);
}

// حالة جهاز واحد (لتقرير السيارة). بترجع null لو حصلت مشكلة عشان التقرير الأساسي ميتعطلش
function gpsStatusForDevice_(ss, cookie, dev, now) {
  // dev جاي من قايمة الأجهزة اللي اتسحبت لسه (فيه الحالة وآخر موقع). نطلب المواقع + الأحداث مع بعض
  const res = traccarGetAll_(cookie, ['/api/positions', gpsEventsPath_(dev, now)], null, 2);
  const pl = (res[0].data || []).filter(function (p) { return p.id === dev.positionId; });
  const pos = pl.length ? pl[0] : null;
  const inf = gpsStatusCompute_(dev, res[1].data || [], pos, now);
  gpsStatusOffPositions_(cookie, [dev], [inf]);
  let sites = [], named = [];
  try { sites = parseLocations_(platformLocValues_(ss), GPS_CONFIG).sites; } catch (e) {}
  try { named = namedLoad_(ss); } catch (e) {}
  const out = {
    inf: inf, evErr: res[1].err,
    place: inf.loc ? gpsPlaceName_(inf.loc.lat, inf.loc.lon, sites, named) : null,
    curPlace: (inf.cur && (inf.cur.lat || inf.cur.lon)) ? gpsPlaceName_(inf.cur.lat, inf.cur.lon, sites, named) : null
  };
  try { gpsRegisterUnknown_(ss, [{ loc: inf.loc, place: out.place, cur: inf.status === 'online' ? inf.cur : null, curPlace: out.curPlace, vehicle: gpsCleanName_(dev.name) }], now); } catch (e) {}
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Petro App ▸ طلب عهدة
   بترفع ملفين (Excel): (1) استهلاك الوقود لكل سائق وعربية  (2) كشف الحساب
   والسكريبت بينضّفهم وينسّقهم في تبويبين جداد جوه الملف (القديم بيتمسح ويتعمل من الأول)
   ═══════════════════════════════════════════════════════════════════════════ */
const PETRO = {
  FUEL_TAB: 'Petro - الوقود', STMT_TAB: 'Petro - كشف الحساب',
  // أعمدة ملف الوقود اللي بتتمسح (بالترتيب من الأصل): A الفاتورة • B الفرع • E طراز • F الرقم الداخلي • M لتر/100كم • P طريقة السداد • R المحطة • S فرع المحطة • T المنطقة • U موقع المحطة
  FUEL_DELETE: [0, 1, 4, 5, 12, 15, 17, 18, 19, 20],
  FONT: 12, PAD_PX: 36, ROW_H: 26
};

function petroOpen() {
  const html = HtmlService.createHtmlOutput(petroHtml_()).setWidth(560).setHeight(470);
  SpreadsheetApp.getUi().showModalDialog(html, 'Petro App — طلب عهدة');
}

function petroHtml_() {
  return '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><base target="_top">' +
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>' +
    '<style>body{font-family:Arial,sans-serif;margin:16px;color:#202124}h3{margin:0 0 12px}label{display:block;font-weight:bold;margin:14px 0 4px}' +
    'input[type=file]{width:100%}button{background:#1a73e8;color:#fff;border:0;border-radius:6px;padding:10px 22px;font-size:15px;cursor:pointer;margin-top:18px}' +
    'button:disabled{background:#9aa0a6}#msg{margin-top:14px;white-space:pre-wrap;line-height:1.7;font-size:14px}.ok{color:#137333}.err{color:#c5221f}.hint{color:#5f6368;font-size:12px}</style></head><body>' +
    '<h3>طلب عهدة</h3>' +
    '<label>1) ملف استهلاك الوقود (لكل سائق وعربية)</label><input type="file" id="f1" accept=".xlsx,.xls,.csv">' +
    '<label>2) ملف كشف الحساب</label><input type="file" id="f2" accept=".xlsx,.xls,.csv">' +
    '<div class="hint">تقدر ترفع ملف واحد بس لو عايز. التبويبات القديمة بتتمسح وتتعمل من الأول.</div>' +
    '<button id="go">ابدأ</button><div id="msg"></div>' +
    '<script>' +
    'function rd(f){return new Promise(function(res,rej){var fr=new FileReader();fr.onerror=function(){rej(fr.error)};fr.onload=function(e){try{' +
    'var wb=XLSX.read(new Uint8Array(e.target.result),{type:"array"});var ws=wb.Sheets[wb.SheetNames[0]];var ref=XLSX.utils.decode_range(ws["!ref"]||"A1");var out=[];' +
    'for(var r=0;r<=ref.e.r;r++){var row=[];for(var c=0;c<=ref.e.c;c++){var cell=ws[XLSX.utils.encode_cell({r:r,c:c})];var v="";' +
    'if(cell){v=cell.v;if(cell.t==="n"&&cell.z&&XLSX.SSF.is_date(cell.z)){var d=XLSX.SSF.parse_date_code(cell.v);var p=function(n){return(n<10?"0":"")+n};' +
    'v=d.y+"-"+p(d.m)+"-"+p(d.d)+((d.H||d.M||d.S)?" "+p(d.H)+":"+p(d.M)+":"+p(Math.floor(d.S)):"")}if(v===undefined||v===null)v=""}row.push(v)}out.push(row)}res(out)}catch(x){rej(x)}};fr.readAsArrayBuffer(f)})}' +
    'var msg=document.getElementById("msg"),go=document.getElementById("go");' +
    'go.onclick=function(){var a=document.getElementById("f1").files[0],b=document.getElementById("f2").files[0];' +
    'if(!a&&!b){msg.className="err";msg.textContent="اختار ملف واحد على الأقل.";return}' +
    'if(typeof XLSX==="undefined"){msg.className="err";msg.textContent="مكتبة قراءة Excel ماتحمّلتش (النت؟). جرّب تاني.";return}' +
    'go.disabled=true;msg.className="";msg.textContent="جاري القراءة والتنسيق...";' +
    'Promise.all([a?rd(a):null,b?rd(b):null]).then(function(x){google.script.run.withSuccessHandler(function(t){msg.className="ok";msg.textContent=t;go.disabled=false})' +
    '.withFailureHandler(function(e){msg.className="err";msg.textContent="فشل: "+(e&&e.message?e.message:e);go.disabled=false}).petroBuild({fuel:x[0],stmt:x[1]})})' +
    '.catch(function(e){msg.className="err";msg.textContent="مش قادر أقرا الملف: "+(e&&e.message?e.message:e);go.disabled=false})};' +
    '</script></body></html>';
}

function petroStr_(v) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim(); }
function petroIsBlank_(row) { return row.every(function (v) { return petroStr_(v) === ''; }); }

// ملف الوقود: 1) الإجماليات من (A,B) لـ (C,D)  2) مسح الأعمدة  3) ترتيب بالحرف اللي جنب اسم السائق مع فاصل بين كل سائق
// بيرجّع { rows: [[...]], groups: [[firstRow,lastRow]...] (أرقام صفوف من 1), totalsAt, nCols, cols: {driver,date,vehicle,brand} , info }
function petroFuelTransform_(raw) {
  const W = 22;
  let rows = raw.map(function (r) { const a = r.slice(0, W); while (a.length < W) a.push(''); return a; });
  while (rows.length && petroIsBlank_(rows[rows.length - 1])) rows.pop();
  if (rows.length < 2) throw new Error('ملف الوقود فاضي أو مفيهوش صفوف.');
  const hdr = rows[0];
  if (petroStr_(hdr[0]).indexOf('فاتورة') < 0 || petroStr_(hdr[16]).indexOf('قائد') < 0 || petroStr_(hdr[20]).indexOf('موقع') < 0)
    throw new Error('ترتيب أعمدة ملف الوقود مش زي المتوقع (A رقم الفاتورة، Q قائد المركبة، U موقع المحطة). اتأكد إنه الملف الصح.');
  // الإجماليات: الصفوف اللي بعد آخر صف فيه سائق (الاسم في A والقيمة في B)
  let dataEnd = 1;
  for (let i = 1; i < rows.length; i++) if (petroStr_(rows[i][16]) !== '') dataEnd = i + 1;
  const totals = [];
  for (let i = dataEnd; i < rows.length; i++) if (!petroIsBlank_(rows[i])) {
    const val = rows[i].slice(1).filter(function (v) { return petroStr_(v) !== ''; })[0];
    totals.push([rows[i][0], val === undefined ? '' : val]);
  }
  const data = rows.slice(1, dataEnd).filter(function (r) { return !petroIsBlank_(r); });
  // (1) الإجماليات اتنقلت لـ C و D (فمش بتتمسح مع A و B) (2) مسح الأعمدة
  const keep = []; for (let c = 0; c < W; c++) if (PETRO.FUEL_DELETE.indexOf(c) < 0) keep.push(c);
  const proj = function (r) { return keep.map(function (c) { return r[c]; }); };
  const header = proj(hdr), body = data.map(proj);
  const iTrip = keep.indexOf(6);   // رقم الرحلة: العمود يفضل فاضي (العنوان والقيم)
  if (iTrip >= 0) { header[iTrip] = ''; body.forEach(function (r) { r[iTrip] = ''; }); }
  const iDriver = keep.indexOf(16), iDate = keep.indexOf(21);
  const letterOf = function (name) { const m = petroStr_(name).match(/(?:^|\s)([A-Za-z])$/); return m ? m[1].toUpperCase() : '~'; };
  const nameOf = function (name) { return petroStr_(name); };
  // (3) تجميع بالسائق
  const byDriver = {}, order = [];
  body.forEach(function (r, i) { const k = nameOf(r[iDriver]); if (!byDriver[k]) { byDriver[k] = []; order.push(k); } byDriver[k].push({ r: r, i: i }); });
  order.sort(function (a, b) { const la = letterOf(a), lb = letterOf(b); return la < lb ? -1 : la > lb ? 1 : a.localeCompare(b, 'ar'); });
  const out = [header], groups = [[1, 1]];
  order.forEach(function (k, gi) {
    if (gi > 0) out.push(new Array(keep.length).fill(''));
    const items = byDriver[k].slice().sort(function (x, y) {
      const dx = petroStr_(x.r[iDate]), dy = petroStr_(y.r[iDate]);
      return dx < dy ? 1 : dx > dy ? -1 : x.i - y.i;      // الأحدث الأول
    });
    const first = out.length + 1;
    items.forEach(function (it) { out.push(it.r); });
    groups.push([first, out.length]);
  });
  // صف المجاميع تحت آخر صف مباشرةً: التكلفة • إكرامية العامل • عدد اللترات
  const lastData = out.length;
  const sumCols = [];
  header.forEach(function (h, i) { const t = petroStr_(h); if (t.indexOf('التكلفة') === 0 || t.indexOf('إكرامية') === 0 || t.indexOf('عدد اللترات') === 0) sumCols.push(i); });
  out.push(new Array(keep.length).fill(''));
  const sumsAt = out.length;
  let totalsAt = 0;
  if (totals.length) {
    totalsAt = out.length + 1;
    totals.forEach(function (t) { const row = new Array(keep.length).fill(''); row[0] = t[0]; row[1] = t[1]; out.push(row); });   // C→A و D→B بعد المسح
  }
  return { rows: out, groups: groups, sumsAt: sumsAt, sumCols: sumCols, lastData: lastData, totalsAt: totalsAt, totalsN: totals.length, nCols: keep.length, nDrivers: order.length, nData: body.length,
           iDate: iDate, textCols: [keep.indexOf(2), keep.indexOf(3)] };
}

// كشف الحساب: مسح أول صف (عنوان الشركة)
function petroStmtTransform_(raw) {
  const W = 6;
  let rows = raw.map(function (r) { const a = r.slice(0, W); while (a.length < W) a.push(''); return a; });
  while (rows.length && petroIsBlank_(rows[rows.length - 1])) rows.pop();
  if (rows.length < 3) throw new Error('كشف الحساب فاضي أو مش بالشكل المتوقع.');
  const isTitle = petroStr_(rows[0][0]).indexOf('الشركة') >= 0 || (petroStr_(rows[1][0]).toLowerCase() === 'num');
  if (isTitle) rows = rows.slice(1);
  if (petroStr_(rows[0][0]).toLowerCase() !== 'num') throw new Error('كشف الحساب: مش لاقي صف العناوين (num / date / statement…).');
  return { rows: rows, nCols: W };
}

function petroSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (sh) { sh.clear(); try { sh.setFrozenRows(0); } catch (e) {} } else sh = ss.insertSheet(name);
  sh.setRightToLeft(false);
  try { sh.setHiddenGridlines(true); } catch (e) {}
  return sh;
}
function petroWidths_(sh, nCols, nRows) {
  for (let c = 1; c <= nCols; c++) { sh.autoResizeColumn(c); sh.setColumnWidth(c, Math.max(90, sh.getColumnWidth(c) + PETRO.PAD_PX)); }
}

function petroBuild(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), msgs = [];
  if (payload && payload.fuel) {
    const t = petroFuelTransform_(payload.fuel), sh = petroSheet_(ss, PETRO.FUEL_TAB), nR = t.rows.length, nC = t.nCols;
    const all = sh.getRange(1, 1, nR, nC);
    t.textCols.forEach(function (c) { if (c >= 0) sh.getRange(1, c + 1, nR, 1).setNumberFormat('@'); });
    if (t.iDate >= 0) sh.getRange(2, t.iDate + 1, nR - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    all.setValues(t.rows);
    all.setFontSize(PETRO.FONT).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
    t.groups.forEach(function (g) { sh.getRange(g[0], 1, g[1] - g[0] + 1, nC).setBorder(true, true, true, true, true, true); });
    t.sumCols.forEach(function (c) {      // مجموع كل عمود (بيتحدّث لوحده لو غيّرت حاجة)
      const col = String.fromCharCode(65 + c), cell = sh.getRange(t.sumsAt, c + 1, 1, 1);
      cell.setFormula('=SUM(' + col + '2:' + col + t.lastData + ')').setNumberFormat('0.###').setBorder(true, true, true, true, true, true);
    });
    if (t.totalsAt) sh.getRange(t.totalsAt, 1, t.totalsN, 2).setBorder(true, true, true, true, true, true);
    sh.setRowHeights(1, nR, PETRO.ROW_H);
    petroWidths_(sh, nC, nR);
    sh.setFrozenRows(1);
    msgs.push('الوقود: ' + t.nData + ' صف، ' + t.nDrivers + ' سائق، ومجاميع التكلفة والإكرامية واللترات تحت الجدول' + (t.totalsN ? '، والإجماليات (' + t.totalsN + ') تحت الجدول' : '') + ' ← تبويب "' + PETRO.FUEL_TAB + '"');
  }
  if (payload && payload.stmt) {
    const t = petroStmtTransform_(payload.stmt), sh = petroSheet_(ss, PETRO.STMT_TAB), nR = t.rows.length, nC = t.nCols;
    sh.getRange(1, 2, nR, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(1, 3, nR, 1).setNumberFormat('@');
    const all = sh.getRange(1, 1, nR, nC);
    all.setValues(t.rows);
    all.setFontSize(PETRO.FONT).setFontWeight('normal').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true);
    sh.getRange(1, 1, 2, nC).setFontWeight('bold');
    sh.setRowHeights(1, nR, PETRO.ROW_H - 2);
    petroWidths_(sh, nC, nR);
    msgs.push('كشف الحساب: ' + (nR - 2) + ' حركة ← تبويب "' + PETRO.STMT_TAB + '"');
  }
  if (!msgs.length) throw new Error('مفيش ملفات.');
  return 'تم ✔\n' + msgs.join('\n');
}