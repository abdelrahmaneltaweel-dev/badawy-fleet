/* ════════════════════════════════════════════════════════════════════════
   Badawy Group — إدارة مشاكل العربيات (صفحة التحكم + صفحة المهندس / السائق)
   ملف إضافي في نفس مشروع Apps Script. بيشتغل كـ Web App، والبيانات في Google Sheets:
     Engineers / Drivers / Issues / Issue Replies   (الداشبورد في Looker هيقرا من Issues)
   - صفحة التحكم (إنت بس): تضيف مشكلة لمهندس أو سائق، تردّ عليهم، تقفلها وتفتحها. محدش غيرك يقدر يقفل أو يفتح.
   - صفحة المهندس / السائق: رابط خاص لكل واحد، يشوف مشاكله ويرد عليها بس.
   - المشكلة تفضل ظاهرة عندهم لحد ما إنت تقفلها (تم الحل)، وبعدها تظهر 3 أيام وتختفي.
   - الإرسال: واتساب (بيفتح واتساب والرسالة جاهزة، إنت اللي بتدوس إرسال) أو إيميل Gmail.
   ════════════════════════════════════════════════════════════════════════ */

const ISS = {
  ENG: 'Engineers', DRV: 'Drivers', ISSUES: 'Issues', REPLIES: 'Issue Replies', DEVICES: 'Devices Naming Connection',
  VEHICLES: ['104', '114', '115', '116', '117', '118', '120', '122', '123', '124'],   // قائمة احتياطية بس: لو شيت "Devices Naming Connection" موجود، القائمة بتتجاب منه
  TYPES: ['عربية واقفة', 'GPS مقطوع', 'أخرى'],   // الأنواع الأساسية. أي نوع جديد بتضيفه من الصفحة بيتحفظ مع القايمة
  ST_WAIT: 'في انتظار رد المهندس', ST_REPLY: 'رد المهندس', ST_DONE: 'تم الحل',
  SHOW_DONE_DAYS: 3,                // بعد الحل بتفضل ظاهرة الأيام دي وبعدها تختفي
  MAX_TEXT: 2000,
  ADMIN: 'الإدارة',                 // اسم الإدارة في الردود
  CACHE_TTL: 120,                   // ثواني: كاش قراءة الشيتات (أي كتابة من الصفحات أو تعديل يدوي بيمسحه)
  POLL_MS: 4000,                    // كل كام مللي ثانية الصفحة تسأل "فيه جديد؟" (وهي مفتوحة وظاهرة بس)
  SHEET_CHECK_SEC: 15,              // كل كام ثانية (على الأكتر) نتأكد إن الشيتات ما اتعدلتش بإيدك
  IH: ['رقم', 'العربية', 'النوع', 'الشرح', 'كود المسؤول', 'المسؤول', 'تاريخ الإضافة', 'الحالة', 'آخر رد', 'وقت آخر رد', 'تاريخ الحل', 'ظاهرة في الداشبورد', 'نوع المسؤول'],
  EH: ['كود', 'الاسم', 'الإيميل', 'المفتاح (Token) — سري', 'نشط', 'واتساب'],
  RH: ['رقم المشكلة', 'الوقت', 'المسؤول', 'الرد']
};

/* ───────────── إعداد أول مرة + القائمة ───────────── */
function issuesSetup() {
  const ui = SpreadsheetApp.getUi();
  issEnsureSheets_();
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ISSUES_ADMIN_KEY')) p.setProperty('ISSUES_ADMIN_KEY', issRand_(32));
  ui.alert('تم تجهيز نظام المشاكل',
    'اتعملت التبويبات: Engineers و Drivers و Issues و Issue Replies.\n\n' +
    'الخطوات:\n1) ➕ إضافة مهندس / ➕ إضافة سائق (لكل واحد).\n2) من محرر Apps Script: Deploy ← New deployment ← Web app\n' +
    '   Execute as: Me   |   Who has access: Anyone\n3) انسخ الـ Web app URL (ينتهي بـ /exec)، واحفظه من 🌐 حفظ رابط الـ Web app، وبعدها افتح 🔗 روابط الصفحات.\n\n' +
    'مهم: بعد أي تعديل في الكود لازم Deploy ← Manage deployments ← Edit ← New version.', ui.ButtonSet.OK);
}
function issNextPersonId_(sh, prefix) {
  let mx = 0; const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { const m = String(r[0]).match(/^[A-Za-z]+(\d+)$/); if (m && Number(m[1]) > mx) mx = Number(m[1]); });
  return prefix + (mx + 1);
}
function issAddPerson_(isDriver) {
  const ui = SpreadsheetApp.getUi(), label = isDriver ? 'سائق' : 'مهندس';
  const s = issEnsureSheets_(), sh = isDriver ? s.drv : s.eng;
  const n = ui.prompt('إضافة ' + label, 'اسم ال' + label + ':', ui.ButtonSet.OK_CANCEL);
  if (n.getSelectedButton() !== ui.Button.OK || !n.getResponseText().trim()) return;
  const w = ui.prompt('إضافة ' + label, 'رقم واتساب ال' + label + ' (بكود الدولة، أو 01xxxxxxxxx للمصري) — ممكن تسيبه فاضي:', ui.ButtonSet.OK_CANCEL);
  if (w.getSelectedButton() !== ui.Button.OK) return;
  const m = ui.prompt('إضافة ' + label, 'إيميل ال' + label + ' (Gmail) — ممكن تسيبه فاضي:', ui.ButtonSet.OK_CANCEL);
  if (m.getSelectedButton() !== ui.Button.OK) return;
  const id = issNextPersonId_(sh, isDriver ? 'D' : 'E');
  sh.appendRow([id, n.getResponseText().trim(), m.getResponseText().trim(), issRand_(32), true, '']);
  const r = sh.getLastRow();
  sh.getRange(r, 6).setNumberFormat('@').setValue(w.getResponseText().trim());   // نص: عشان الصفر اللي في أول الرقم ما يضيعش
  issBump_();
  ui.alert('اتضاف ال' + label + ' "' + n.getResponseText().trim() + '". افتح 🔗 روابط الصفحات تاخد رابطه.');
}
function issuesAddEngineer() { issAddPerson_(false); }
function issuesAddDriver() { issAddPerson_(true); }
function issuesShowLinks() {
  const ui = SpreadsheetApp.getUi();
  issEnsureSheets_();
  const base = issBaseUrl_();
  const key = PropertiesService.getScriptProperties().getProperty('ISSUES_ADMIN_KEY');
  if (!key) { ui.alert('شغّل الأول: 🛠 إعداد نظام المشاكل.'); return; }
  if (!base) { ui.alert('لسه مفيش رابط Web app محفوظ. بعد Deploy استخدم 🌐 حفظ رابط الـ Web app والصق الرابط (ينتهي بـ /exec).'); return; }
  const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  let h = '<div style="font-family:Arial;direction:rtl;font-size:14px;margin:12px">' +
    '<b>رابط صفحة التحكم (ليك إنت بس — سري)</b><br><input readonly style="width:100%;margin:6px 0 14px;padding:6px;direction:ltr" value="' + esc(base + '?page=control&k=' + key) + '" onclick="this.select()">';
  issPeopleFresh_().forEach(function (e) {
    h += '<b>' + esc(e.name) + (e.role === 'drv' ? ' (سائق)' : ' (مهندس)') + (e.active ? '' : ' — غير نشط') + '</b><br><input readonly style="width:100%;margin:6px 0 14px;padding:6px;direction:ltr" value="' + esc(base + '?page=eng&k=' + e.token) + '" onclick="this.select()">';
  });
  h += '<div style="color:#666">كل رابط خاص: ما تبعتهوش لحد غير صاحبه.</div></div>';
  ui.showModalDialog(HtmlService.createHtmlOutput(h).setWidth(560).setHeight(480), 'روابط الصفحات');
}

/* ───────────── Web app ───────────── */
function doGet(e) {
  const page = e && e.parameter && e.parameter.page, k = e && e.parameter && e.parameter.k;
  let out = null;
  try {
    if (page === 'stmt') { out = stmtPageOut_(k); if (out) return out.addMetaTag('viewport', 'width=device-width, initial-scale=1'); }   // صفحة تقرير بيان الخلاطة (Statements.gs)
    issCheckSheets_(true);   // فتح الصفحة دايماً بيتأكد إن الشيتات ما اتعدلتش بإيدك (مسح / تعديل) قبل ما يعرض البيانات
    if (page === 'control' && issAdminOk_(k)) {
      let init = null; try { init = issAdminPayload_(); } catch (x) { init = null; }
      out = HtmlService.createHtmlOutput(issControlHtml_(k, init)).setTitle('صفحة التحكم — مشاكل العربيات');
    } else if (page === 'eng') {
      const eng = issEngByToken_(k);
      if (eng) {
        let init = null; try { init = issEngPayload_(eng); } catch (x) { init = null; }
        out = HtmlService.createHtmlOutput(issEngineerHtml_(k, eng.name, init, eng.role)).setTitle((eng.role === 'drv' ? 'مشاكل عربيتي — ' : 'عربياتي — ') + eng.name);
      }
    }
  } catch (err) { out = null; }
  if (!out) out = HtmlService.createHtmlOutput('<div style="font-family:Arial;direction:rtl;margin:40px;text-align:center"><h2>الرابط غير صحيح</h2><p>اطلب الرابط الصحيح من الإدارة.</p></div>').setTitle('رابط غير صحيح');
  return out.addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// تعديل يدوي في تبويبات النظام (من الشيت نفسه) يمسح الكاش فوراً — simple trigger (مكمّل لفحص البصمة اللي في issCheckSheets_)
function onEdit(e) {
  try { const n = e && e.range && e.range.getSheet().getName(); if (n === ISS.ISSUES || n === ISS.ENG || n === ISS.DRV || n === ISS.REPLIES || n === ISS.DEVICES) issBump_(); } catch (err) {}
}

/* ───────────── رسايل الإرسال (واتساب / إيميل) ───────────── */
function issWaNumber_(s) {   // رقم واتساب بصيغة دولية من غير + (المصري: 01x… أو 1x… بيتحوّل لـ 20…)
  let d = String(s === null || s === undefined ? '' : s).replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 1632); }).replace(/\D/g, '');
  if (!d) return '';
  if (d.indexOf('00') === 0) d = d.slice(2);
  else if (d.charAt(0) === '0') d = '20' + d.slice(1);
  else if (d.length === 10 && d.charAt(0) === '1') d = '20' + d;
  return d.length >= 8 ? d : '';
}
function issWaUrl_(p, text) { const n = issWaNumber_(p && p.wa); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text) : ''; }
function issClip_(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }
function issPersonLink_(p) { const base = issBaseUrl_(); return base ? base + '?page=eng&k=' + p.token : ''; }
function issLinkLine_(p) { const l = issPersonLink_(p); return l ? '\n\nادخل ارد من رابطك الخاص:\n' + l : ''; }
function issMail_(to, subject, body) { try { if (to) MailApp.sendEmail(to, subject, body); return !!to; } catch (err) { return false; } }
// via: 'wa' | 'email' | '' → { mailed, mailMissing, wa (رابط واتساب جاهز), waMissing }
function issDeliver_(via, p, subject, text) {
  const r = { mailed: false, mailMissing: false, wa: '', waMissing: false };
  if (via === 'email') { if (p.email) r.mailed = issMail_(p.email, subject, text); else r.mailMissing = true; }
  else if (via === 'wa') { r.wa = issWaUrl_(p, text); if (!r.wa) r.waMissing = true; }
  return r;
}

/* ───────────── API: الإدارة ───────────── */
function issPersonBrief_(p) { return { id: p.id, name: p.name, wa: !!issWaNumber_(p.wa), email: !!p.email }; }
function issAdminPayload_() {
  const ver = issVersion_();   // النسخة بتتقرا قبل البيانات: لو حصل تغيير بينهم الصفحة تعيد التحميل في الدورة اللي بعدها
  const people = issPeople_().filter(function (p) { return p.active; });
  return { ver: ver, issues: issAllIssues_(),
    engineers: people.filter(function (p) { return p.role === 'eng'; }).map(issPersonBrief_),
    drivers: people.filter(function (p) { return p.role === 'drv'; }).map(issPersonBrief_),
    vehicles: issVehicles_(), types: issTypes_(), stmt: stmtSafeInfo_() };
}
function issuesAdminList(key) { issAdminCheck_(key); return issAdminPayload_(); }
// بيتنادى كل كام ثانية من صفحة التحكم: لو مفيش تغيير بيرجّع النسخة بس (سريع جداً)، ولو فيه تغيير بيرجّع البيانات كلها
function issuesAdminSync(key, known) {
  issAdminCheck_(key);
  issCheckSheets_(false);
  const ver = issVersion_();
  if (known && known === ver) return { ver: ver, same: true };
  return issAdminPayload_();
}

function issuesAdminAdd(key, o) {
  issAdminCheck_(key);
  o = o || {};
  const vehicle = String(o.vehicle || '').trim(), desc = String(o.desc || '').trim(), type = String(o.type || '').replace(/\s+/g, ' ').trim();
  const role = o.role === 'drv' ? 'drv' : 'eng', via = o.via === 'wa' || o.via === 'email' ? o.via : '';
  if (!vehicle || vehicle.length > 30) throw new Error('اختار العربية.');
  const person = issPeople_().filter(function (p) { return p.id === String(o.personId || '') && p.active && p.role === role; })[0];
  if (!person) throw new Error(role === 'drv' ? 'اختار السائق.' : 'اختار المهندس المسؤول.');
  if (!type) throw new Error('اختار نوع المشكلة أو اكتب نوع جديد.');
  if (type.length > 40) throw new Error('اسم النوع طويل (الحد 40 حرف).');
  if (!desc) throw new Error('اكتب شرح المشكلة.');
  if (desc.length > ISS.MAX_TEXT) throw new Error('الشرح طويل جداً (الحد ' + ISS.MAX_TEXT + ' حرف).');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let id;
  try {
    issAddType_(type);   // لو النوع جديد بيتحفظ في القايمة
    const sh = issEnsureSheets_().issues, last = sh.getLastRow();
    id = 1; if (last >= 2) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { if (Number(r[0]) >= id) id = Number(r[0]) + 1; });
    sh.appendRow([id, vehicle, type, desc, person.id, person.name, new Date(), ISS.ST_WAIT, '', '', '', '', role === 'drv' ? 'سائق' : 'مهندس']);
    const r = sh.getLastRow();
    sh.getRange(r, 12).setFormula('=IF(H' + r + '<>"' + ISS.ST_DONE + '",TRUE,NOW()-K' + r + '<=' + ISS.SHOW_DONE_DAYS + ')');
    sh.getRange(r, 7).setNumberFormat('yyyy-mm-dd hh:mm');
    issBump_();
  } finally { lock.releaseLock(); }
  const payload = issAdminPayload_();
  const d = issDeliver_(via, person, 'مشكلة جديدة في عربية ' + vehicle + ' — محتاجة ردك',
    'السلام عليكم ' + person.name + '،\n\nمشكلة جديدة في عربية ' + vehicle + ' (' + type + '):\n' + issClip_(desc, 700) + issLinkLine_(person));
  return { id: id, payload: payload, mailed: d.mailed, mailMissing: d.mailMissing, wa: d.wa, waMissing: d.waMissing };
}

// رد الإدارة على المهندس / السائق (من غير ما تقفل المشكلة). المشكلة بترجع "في انتظار رد المهندس"
function issuesAdminReply(key, id, text, via) {
  issAdminCheck_(key);
  text = String(text || '').trim(); via = via === 'wa' || via === 'email' ? via : '';
  if (!text) throw new Error('اكتب الرد.');
  if (text.length > ISS.MAX_TEXT) throw new Error('الرد طويل جداً (الحد ' + ISS.MAX_TEXT + ' حرف).');
  let vehicle = '', person = null;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const s = issEnsureSheets_(), row = issFindRow_(s.issues, id);
    if (!row) throw new Error('المشكلة مش موجودة.');
    const v = s.issues.getRange(row, 1, 1, 12).getValues()[0];
    if (v[7] === ISS.ST_DONE) throw new Error('المشكلة مقفولة. افتحها الأول عشان تردّ.');
    vehicle = v[1];
    person = issPeople_().filter(function (e) { return e.id === String(v[4]); })[0] || null;
    s.replies.appendRow([Number(id), new Date(), ISS.ADMIN, text]);
    s.replies.getRange(s.replies.getLastRow(), 2).setNumberFormat('yyyy-mm-dd hh:mm');
    s.issues.getRange(row, 8).setValue(ISS.ST_WAIT);
    issBump_();
  } finally { lock.releaseLock(); }
  const payload = issAdminPayload_();
  const res = { payload: payload, mailed: false, mailMissing: false, wa: '', waMissing: false };
  if (via && person) {
    const d = issDeliver_(via, person, 'رد من الإدارة على مشكلة عربية ' + vehicle,
      'السلام عليكم ' + person.name + '،\n\nرد الإدارة بخصوص عربية ' + vehicle + ':\n' + issClip_(text, 700) + issLinkLine_(person));
    res.mailed = d.mailed; res.mailMissing = d.mailMissing; res.wa = d.wa; res.waMissing = d.waMissing;
  } else if (via) res.waMissing = via === 'wa';
  return res;
}
// تذكير واتساب بمشكلة مفتوحة (من زرار "واتساب" على كارت المشكلة)
function issuesAdminWa(key, id) {
  issAdminCheck_(key);
  const it = issAllIssues_().filter(function (x) { return x.id === Number(id); })[0];
  if (!it) throw new Error('المشكلة مش موجودة.');
  const person = issPeople_().filter(function (e) { return e.id === it.engId; })[0];
  if (!person) throw new Error('المسؤول عن المشكلة مش موجود في الشيت.');
  const last = it.replies.length ? it.replies[it.replies.length - 1] : null;
  const text = 'السلام عليكم ' + person.name + '،\n\nتذكير بمشكلة عربية ' + it.vehicle + ' (' + it.type + '):\n' + issClip_(it.desc, 500) +
    (last && last.by === ISS.ADMIN ? '\n\nآخر رد من الإدارة:\n' + issClip_(last.text, 300) : '') + issLinkLine_(person);
  const url = issWaUrl_(person, text);
  if (!url) throw new Error('مفيش رقم واتساب محفوظ لـ ' + person.name + ' (عمود "واتساب" في شيت ' + (person.role === 'drv' ? ISS.DRV : ISS.ENG) + ').');
  return { wa: url };
}
function issuesAdminSetDone(key, id, done) {
  issAdminCheck_(key);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const s = issEnsureSheets_(), sh = s.issues, row = issFindRow_(sh, id);
    if (!row) throw new Error('المشكلة مش موجودة.');
    if (done) {
      sh.getRange(row, 8).setValue(ISS.ST_DONE);
      sh.getRange(row, 11).setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm');
    } else {
      // لو آخر رد كان من المسؤول (مهندس / سائق) → "رد المهندس"، غير كده (رد الإدارة أو مفيش ردود) → "في انتظار رد المهندس"
      let last = null; const rn = s.replies.getLastRow();
      if (rn >= 2) s.replies.getRange(2, 1, rn - 1, 3).getValues().forEach(function (r) { if (Number(r[0]) === Number(id)) last = String(r[2]); });
      sh.getRange(row, 8).setValue(last !== null && last !== ISS.ADMIN ? ISS.ST_REPLY : ISS.ST_WAIT);
      sh.getRange(row, 11).clearContent();
    }
    issBump_();
  } finally { lock.releaseLock(); }
  return issAdminPayload_();
}

/* ───────────── API: المهندس / السائق ───────────── */
function issEngFor_(eng) {
  const now = Date.now(), lim = ISS.SHOW_DONE_DAYS * 86400000;
  return issAllIssues_(true).filter(function (x) {
    return x.engId === eng.id && (x.status !== ISS.ST_DONE || (x.doneMs && now - x.doneMs <= lim));
  }).map(function (x) { delete x.doneMs; return x; });
}
function issEngPayload_(eng) { const ver = issVersion_(); return { ver: ver, list: issEngFor_(eng) }; }
function issEngAuth_(token) {
  const eng = issEngByToken_(token);
  if (!eng || !eng.active) throw new Error('الرابط غير صحيح.');
  return eng;
}
function issuesEngList(token) { return issEngFor_(issEngAuth_(token)); }
function issuesEngSync(token, known) {
  const eng = issEngAuth_(token);
  issCheckSheets_(false);
  const ver = issVersion_();
  if (known && known === ver) return { ver: ver, same: true };
  return issEngPayload_(eng);
}
function issuesEngReply(token, id, text) {
  const eng = issEngAuth_(token);
  text = String(text || '').trim();
  if (!text) throw new Error('اكتب الرد.');
  if (text.length > ISS.MAX_TEXT) throw new Error('الرد طويل جداً (الحد ' + ISS.MAX_TEXT + ' حرف).');
  let vehicle = '';
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const s = issEnsureSheets_(), row = issFindRow_(s.issues, id);
    if (!row) throw new Error('المشكلة مش موجودة.');
    const v = s.issues.getRange(row, 1, 1, 12).getValues()[0];
    if (String(v[4]) !== eng.id) throw new Error('المشكلة دي مش تبعك.');
    if (v[7] === ISS.ST_DONE) throw new Error('المشكلة اتقفلت من الإدارة.');
    vehicle = v[1];
    const now = new Date();
    s.replies.appendRow([Number(id), now, eng.name, text]);
    s.replies.getRange(s.replies.getLastRow(), 2).setNumberFormat('yyyy-mm-dd hh:mm');
    s.issues.getRange(row, 8, 1, 3).setValues([[ISS.ST_REPLY, text, now]]);
    s.issues.getRange(row, 10).setNumberFormat('yyyy-mm-dd hh:mm');
    issBump_();
  } finally { lock.releaseLock(); }
  const payload = issEngPayload_(eng);
  try { issMail_(Session.getEffectiveUser().getEmail(), eng.name + ' رد على مشكلة عربية ' + vehicle, eng.name + ':\n' + text); } catch (err) {}
  return payload;
}

/* ───────────── مساعدات ───────────── */
function issRand_(n) { let s = ''; while (s.length < n) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n); }
function issBaseUrl_() {
  const saved = PropertiesService.getScriptProperties().getProperty('ISSUES_WEB_URL');
  if (saved) return saved;
  try { const u = ScriptApp.getService().getUrl() || ''; return /\/exec$/.test(u) ? u : ''; } catch (e) { return ''; }
}
// الصق هنا رابط الـ Web app زي ما ظهر في نافذة Deploy (لازم ينتهي بـ /exec)
function issuesSetUrl() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('رابط الـ Web app', 'الصق الرابط اللي ظهر بعد Deploy (ينتهي بـ /exec):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const u = r.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[^\/]+\/)?macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u)) { ui.alert('الرابط مش صحيح. لازم يبدأ بـ https://script.google.com/macros/s/ وينتهي بـ /exec (مش /dev).'); return; }
  PropertiesService.getScriptProperties().setProperty('ISSUES_WEB_URL', u);
  ui.alert('اتحفظ. افتح 🔗 روابط الصفحات.');
}
function issSame_(a, b) { a = String(a || ''); b = String(b || ''); if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function issAdminOk_(k) { return issSame_(k, PropertiesService.getScriptProperties().getProperty('ISSUES_ADMIN_KEY')); }
function issAdminCheck_(k) { if (!issAdminOk_(k)) throw new Error('غير مصرح.'); }
function issEnsureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  function mk(name, head, widths, hide) {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
      if (hide) { try { sh.hideSheet(); } catch (e) {} }
    }
    return sh;
  }
  const s = {
    eng: mk(ISS.ENG, ISS.EH, [60, 160, 220, 320, 60, 140]),
    drv: mk(ISS.DRV, ISS.EH, [60, 160, 220, 320, 60, 140], true),
    issues: mk(ISS.ISSUES, ISS.IH, [50, 80, 110, 320, 90, 130, 130, 150, 260, 130, 130, 110, 90]),
    replies: mk(ISS.REPLIES, ISS.RH, [90, 130, 130, 420])
  };
  issEnsureHeads_(s);
  return s;
}
// شيتات اتعملت بنسخة قديمة: بنضيف عمود "واتساب" (Engineers) و"نوع المسؤول" (Issues) لو مش موجودين — مرة واحدة كل فترة
function issEnsureHeads_(s) {
  try {
    const c = CacheService.getScriptCache(); if (c.get('iss_heads')) return;
    [[s.eng, 6, ISS.EH[5]], [s.drv, 6, ISS.EH[5]], [s.issues, 13, ISS.IH[12]]].forEach(function (x) {
      if (String(x[0].getRange(1, x[1]).getValue() || '') === '') x[0].getRange(1, x[1]).setValue(x[2]).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
      if (x[1] === 6) x[0].getRange(2, 6, Math.max(1, x[0].getMaxRows() - 1), 1).setNumberFormat('@');
    });
    c.put('iss_heads', '1', 21600);
  } catch (e) {}
}

/* ───────────── كاش + رقم نسخة التغيير (أساس السرعة والتحديث اللحظي) ─────────────
   أي كتابة (إضافة / رد / قفل / فتح / تعديل يدوي في الشيت) بتغيّر رقم النسخة وتمسح الكاش.
   الصفحات بتسأل كل كام ثانية "النسخة اتغيرت؟" (سريع جداً)، ولو اتغيرت بتجيب البيانات. */
let ISS_TZ_ = null;
function issTz_() { return ISS_TZ_ || (ISS_TZ_ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone()); }
function issFmt_(d) { return d instanceof Date ? Utilities.formatDate(d, issTz_(), 'dd/MM/yyyy HH:mm') : ''; }
function issNewVer_() { return String(Date.now()) + String(Math.floor(Math.random() * 1000)); }
function issVersion_() {
  try {
    const c = CacheService.getScriptCache();
    let v = c.get('iss_ver');
    if (!v) { v = issNewVer_(); c.put('iss_ver', v, 21600); }
    return v;
  } catch (e) { return issNewVer_(); }
}
function issBump_() {
  try {
    const c = CacheService.getScriptCache();
    c.put('iss_ver', issNewVer_(), 21600);
    c.removeAll(['iss_all_n', 'iss_ppl', 'iss_veh', 'iss_types', 'iss_fp']);
  } catch (e) {}
}
// بصمة محتوى الشيتات: لو اتغيّرت من برّه الصفحات (مسحت صفوف، عدّلت، رتبت…) الكاش بيتمسح. بتتفحص عند فتح أي صفحة، وكل SHEET_CHECK_SEC ثانية على الأكتر أثناء التحديث التلقائي
function issSheetsFp_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = '';
  [[ISS.ISSUES, 13, [11]], [ISS.REPLIES, 4, []], [ISS.ENG, 6, []], [ISS.DRV, 6, []], [ISS.DEVICES, 5, []], [STMT.REQ_SHEET, 10, []], [STMT.MGR_SHEET, 6, []]].forEach(function (c) {
    const sh = ss.getSheetByName(c[0]);
    if (!sh) { s += '|-'; return; }
    const n = sh.getLastRow(); s += '|' + n;
    if (n >= 1) sh.getRange(1, 1, n, c[1]).getValues().forEach(function (r) {
      c[2].forEach(function (i) { r[i] = ''; });   // عمود الصيغة (ظاهرة في الداشبورد) بيتغير لوحده
      s += JSON.stringify(r);
    });
  });
  let hsh = 5381; for (let i = 0; i < s.length; i++) hsh = ((hsh << 5) + hsh + s.charCodeAt(i)) | 0;
  return (hsh >>> 0).toString(36) + ':' + s.length;
}
function issCheckSheets_(force) {
  try {
    const c = CacheService.getScriptCache();
    if (!force && c.get('iss_fp_t')) return;
    c.put('iss_fp_t', '1', ISS.SHEET_CHECK_SEC);
    const fp = issSheetsFp_(), old = c.get('iss_fp');
    if (old === fp) return;
    issBump_(); c.put('iss_fp', fp, 21600);   // اتغيّرت (أو مفيش بصمة قديمة): امسح الكاش وخزّن البصمة الجديدة
  } catch (e) {}
}
function issCacheGetJson_(key) {
  try { const v = CacheService.getScriptCache().get(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function issCachePutJson_(key, obj, ttl) {
  try { const s = JSON.stringify(obj); if (s.length <= 30000) CacheService.getScriptCache().put(key, s, ttl); } catch (e) {}
}
// قايمة المشاكل ممكن تكبر: بتتخزن على أجزاء (حد الكاش 100KB للقيمة)
function issAllGetCache_() {
  try {
    const c = CacheService.getScriptCache(), n = Number(c.get('iss_all_n'));
    if (!n) return null;
    const keys = []; for (let i = 0; i < n; i++) keys.push('iss_all_' + i);
    const got = c.getAll(keys); let s = '';
    for (let i = 0; i < n; i++) { const p = got[keys[i]]; if (p === undefined || p === null) return null; s += p; }
    return JSON.parse(s);
  } catch (e) { return null; }
}
function issAllPutCache_(list) {
  try {
    const s = JSON.stringify(list), size = 30000, o = {}; let n = 0;
    for (let i = 0; i < s.length; i += size) o['iss_all_' + (n++)] = s.slice(i, i + size);
    if (n > 30) return;
    const c = CacheService.getScriptCache();
    c.putAll(o, ISS.CACHE_TTL);
    c.put('iss_all_n', String(n), ISS.CACHE_TTL);
  } catch (e) {}
}

/* ───────────── المهندسين والسواقين ───────────── */
function issPeopleRead_() {
  const s = issEnsureSheets_();
  const rd = function (sh, role) {
    const last = sh.getLastRow();
    return last < 2 ? [] : sh.getRange(2, 1, last - 1, 6).getValues().filter(function (r) { return r[0] && r[3]; }).map(function (r) {
      return { id: String(r[0]), name: String(r[1]), email: String(r[2] || ''), token: String(r[3]), role: role, wa: String(r[5] === null || r[5] === undefined ? '' : r[5]).trim(),
        active: r[4] !== false && String(r[4]).toLowerCase() !== 'false' };
    });
  };
  return rd(s.eng, 'eng').concat(rd(s.drv, 'drv'));
}
function issPeopleFresh_() { return issPeopleRead_(); }
function issPeople_() {
  const cached = issCacheGetJson_('iss_ppl'); if (cached) return cached;
  const v0 = issVersion_();
  const out = issPeopleRead_();
  if (issVersion_() === v0) issCachePutJson_('iss_ppl', out, ISS.CACHE_TTL);
  return out;
}
function issEngByToken_(t) {
  t = String(t || '');
  const all = issPeople_();
  for (let i = 0; i < all.length; i++) if (issSame_(t, all[i].token)) return all[i];
  return null;
}
function issFindRow_(sh, id) {
  const last = sh.getLastRow(); if (last < 2) return 0;
  const v = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < v.length; i++) if (Number(v[i][0]) === Number(id)) return i + 2;
  return 0;
}

/* ───────────── العربيات وأنواع المشاكل ───────────── */
// [الرقم، النص المعروض، نص البحث] من شيت "Devices Naming Connection": عمود C = رقم السيارة، B = رقم المركبة، وأي أعمدة بعدهم (اسم مثلاً) بتتحط في العرض والبحث
function issVehicles_() {
  const cached = issCacheGetJson_('iss_veh'); if (cached) return cached;
  let out = null;
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ISS.DEVICES);
    if (sh && sh.getLastRow() >= 2) {
      const seen = {}, arr = [], nc = Math.max(3, sh.getLastColumn());
      sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues().forEach(function (r) {
        const t = function (x) { return String(x === null || x === undefined ? '' : x).replace(/\s+/g, ' ').trim(); };
        const v = t(r[2]); if (!v || v.length > 30 || seen[v]) return;
        seen[v] = 1;
        const b = t(r[1]), ex = r.slice(3).map(t).filter(function (x) { return x; }).join(' ');
        arr.push([v, v + (b && b !== v ? ' — ' + b : '') + (ex ? ' · ' + ex : ''), v + ' ' + b + ' ' + ex]);
      });
      if (arr.length) out = arr.sort(function (a, b) { return a[0].localeCompare(b[0], undefined, { numeric: true }); });
    }
  } catch (e) {}
  if (!out) out = ISS.VEHICLES.map(function (v) { return [v, v, v]; });
  issCachePutJson_('iss_veh', out, ISS.CACHE_TTL);
  return out;
}
function issTypes_() {
  const cached = issCacheGetJson_('iss_types'); if (cached) return cached;
  let t = null;
  try { t = JSON.parse(PropertiesService.getScriptProperties().getProperty('ISSUES_TYPES') || 'null'); } catch (e) {}
  if (!Array.isArray(t) || !t.length) t = ISS.TYPES.slice();
  issCachePutJson_('iss_types', t, ISS.CACHE_TTL);
  return t;
}
function issAddType_(name) {   // بتتنادى جوه الـ lock
  let t = [];
  try { t = JSON.parse(PropertiesService.getScriptProperties().getProperty('ISSUES_TYPES') || 'null'); } catch (e) {}
  if (!Array.isArray(t) || !t.length) t = ISS.TYPES.slice();
  if (t.indexOf(name) >= 0) return;
  const i = t.indexOf('أخرى');
  if (i >= 0) t.splice(i, 0, name); else t.push(name);   // النوع الجديد قبل "أخرى"
  PropertiesService.getScriptProperties().setProperty('ISSUES_TYPES', JSON.stringify(t));
}

/* ───────────── قراءة المشاكل ───────────── */
function issReadIssues_() {
  const s = issEnsureSheets_(), n = s.issues.getLastRow();
  if (n < 2) return [];
  const reps = {}, rn = s.replies.getLastRow();
  if (rn >= 2) s.replies.getRange(2, 1, rn - 1, 4).getValues().forEach(function (r) {
    (reps[r[0]] = reps[r[0]] || []).push({ t: issFmt_(r[1]), by: String(r[2]), text: String(r[3]) });
  });
  return s.issues.getRange(2, 1, n - 1, 11).getValues().filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return { id: Number(r[0]), vehicle: String(r[1]), type: String(r[2]), desc: String(r[3]), engId: String(r[4]), engName: String(r[5]), role: String(r[4]).charAt(0) === 'D' ? 'drv' : 'eng',
      created: issFmt_(r[6]), status: String(r[7]), done: issFmt_(r[10]), replies: reps[r[0]] || [], doneMs: r[10] instanceof Date ? r[10].getTime() : 0 };
  }).sort(function (a, b) { return b.id - a.id; });
}
function issAllIssues_(keepMs) {
  let list = issAllGetCache_();
  if (!list) {
    const v0 = issVersion_();
    list = issReadIssues_();
    if (issVersion_() === v0) {   // لو حصلت كتابة أثناء القراءة ما نخزّنش بيانات قديمة
      issAllPutCache_(list);
      try { CacheService.getScriptCache().put('iss_fp', issSheetsFp_(), 21600); } catch (e) {}   // بصمة الشيتات وقت تخزين الكاش: أي تعديل بعدها من برّه الصفحات يتكشف
    }
  }
  if (!keepMs) list.forEach(function (x) { delete x.doneMs; });
  return list;
}

/* ───────────── الصفحات (HTML) ───────────── */
const ISS_CSS_ = `body{margin:0;background:#f1f3f4;font-family:Tahoma,Arial,sans-serif;color:#202124;direction:rtl}
.wrap{max-width:1200px;margin:0 auto;padding:20px 16px 40px;display:flex;flex-direction:column;gap:16px}
.hd{background:#1e3a5f;color:#fff;border-radius:14px;padding:18px 22px}.hd h1{margin:0;font-size:24px}.hd div{opacity:.85;font-size:14px;margin-top:2px}
.card{background:#fff;border-radius:14px;padding:18px;box-shadow:0 1px 3px rgba(60,64,67,.15)}
.chip{display:inline-block;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:600;white-space:nowrap}
.c-amb{background:#fef3e0;color:#8a4b00}.c-blu{background:#e8f0fe;color:#174ea6}.c-grn{background:#e6f4ea;color:#0d652d}.c-gry{background:#f1f3f4;color:#3c4043}
label{display:block;font-size:14px;font-weight:700;margin-bottom:6px}
.fld{width:100%;box-sizing:border-box;border:1px solid #dadce0;border-radius:8px;padding:10px 12px;font:15px Tahoma,Arial,sans-serif;min-height:44px;background:#fff;color:#202124}
.btn{border:0;border-radius:8px;padding:10px 18px;font:700 14px Tahoma,Arial,sans-serif;min-height:44px;cursor:pointer;background:#1a73e8;color:#fff}.btn:disabled{opacity:.55;cursor:default}
.btn.g{background:#1e8e3e}.btn.o{background:#fff;color:#1a73e8;border:1px solid #1a73e8}.btn.w{width:100%}.btn.wa{background:#25d366;color:#fff}
.seg{display:flex;gap:8px}.seg .btn{flex:1;min-height:40px;padding:8px 10px}
.msg{padding:10px 14px;border-radius:8px;font-size:14px}.ok{background:#e6f4ea;color:#0d652d}.er{background:#fce8e6;color:#a50e0e}
.rep{background:#e8f0fe;border-radius:10px;padding:10px 12px;margin-top:8px;font-size:14px;line-height:1.7;white-space:pre-wrap}.rep.adm{background:#f1f3f4}
.desc{white-space:pre-wrap;line-height:1.7;font-size:15px}.mut{color:#5f6368;font-size:13px}
.dd{position:absolute;top:100%;right:0;left:0;z-index:20;background:#fff;border:1px solid #dadce0;border-radius:8px;box-shadow:0 4px 12px rgba(60,64,67,.25);max-height:240px;overflow:auto;margin-top:2px}
.ddi{padding:10px 12px;cursor:pointer;font-size:14px}.ddi:hover,.ddi.on{background:#e8f0fe}.ddn{padding:10px 12px;color:#5f6368;font-size:13px}`;

// كود مشترك بين الصفحتين (JavaScript بتاع المتصفح): بناء العناصر، تحديث تلقائي، والحفاظ على اللي بتكتبه وقت التحديث
const ISS_JS_ = `var ADMIN=__ADMIN__,VER='',LASTSIG='',TICKS=0,DRAFT={};
function $(i){return document.getElementById(i);}
function h(t,a,c){var e=document.createElement(t);for(var k in (a||{})){if(k==='cls')e.className=a[k];else if(k==='on')for(var ev in a[k])e.addEventListener(ev,a[k][ev]);else e.setAttribute(k,a[k]);}(c==null?[]:[].concat(c)).forEach(function(x){e.appendChild(typeof x==='string'||typeof x==='number'?document.createTextNode(String(x)):x);});return e;}
function chipFor(s){return h('span',{cls:'chip '+(s==='تم الحل'?'c-grn':s==='رد المهندس'?'c-blu':'c-amb')},s==='تم الحل'?'تم الحل ✓':s);}
function msg(el,t,ok){el.className='msg '+(ok?'ok':'er');el.textContent=t;el.style.display=t?'block':'none';}
function errText(e){return (e&&e.message?e.message:String(e)).replace('Error: ','').replace('Exception: ','');}
function repsBox(list){var d=h('div');list.forEach(function(r){d.appendChild(h('div',{cls:'rep'+(r.by===ADMIN?' adm':'')},[h('b',null,r.by+' — '+r.t+':'),h('div',null,r.text)]));});return d;}
function keepFocus(fn){var a=document.activeElement,id=a&&a.getAttribute?a.getAttribute('data-iid'):null,pos=a&&a.selectionStart!=null?a.selectionStart:0,sy=window.pageYOffset;fn();if(id){var n=document.querySelector('textarea[data-iid="'+id+'"]');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}}window.scrollTo(0,sy);}
function startSync(call,onData,ms){var busy=false;
 function tick(force){if(busy||(document.hidden&&!force))return;busy=true;TICKS++;var known=(TICKS%15===0)?'':VER;
  call(known,function(r){busy=false;if(r&&!r.same)onData(r);},function(){busy=false;});}
 setInterval(function(){tick(false);},ms);
 document.addEventListener('visibilitychange',function(){if(!document.hidden)tick(true);});}
function norm(s){s=String(s==null?'':s).toLowerCase();var o='';for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);
 if(c>=1632&&c<=1641)o+=String(c-1632);else if(c>=1776&&c<=1785)o+=String(c-1776);else if((c>=1611&&c<=1631)||c===1600)continue;else if(c===1571||c===1573||c===1570)o+='ا';else if(c===1609)o+='ي';else if(c===1577)o+='ه';else o+=s.charAt(i);}
 return o.replace(/ +/g,' ').trim();}
function combo(ph,onPick){
 var inp=h('input',{cls:'fld',placeholder:ph,autocomplete:'off'}),box=h('div',{cls:'dd',style:'display:none'}),wrap=h('div',{style:'position:relative'},[inp,box]);
 var st={items:[],value:'',label:'',idx:-1,shown:[]};
 function pick(it){st.value=it[0];st.label=it[1];inp.value=it[1];box.style.display='none';if(onPick)onPick(it[0],it);}
 function render(){var q=norm(inp.value);
  var xs=st.items.filter(function(it){return !q||norm(it[2]||it[1]).indexOf(q)>=0;});
  if(q)xs=xs.filter(function(it){return norm(it[0]).indexOf(q)===0;}).concat(xs.filter(function(it){return norm(it[0]).indexOf(q)!==0;}));
  st.shown=xs.slice(0,60);box.textContent='';
  if(!st.shown.length)box.appendChild(h('div',{cls:'ddn'},'مفيش نتايج'));
  st.shown.forEach(function(it,i){var d=h('div',{cls:'ddi'+(i===st.idx?' on':'')},it[1]);d.addEventListener('mousedown',function(e){e.preventDefault();pick(it);});box.appendChild(d);});
  box.style.display='block';}
 inp.addEventListener('focus',function(){st.idx=-1;try{inp.select();}catch(e){}render();});
 inp.addEventListener('input',function(){if(st.value){st.value='';if(onPick)onPick('',null);}st.idx=-1;render();});
 inp.addEventListener('blur',function(){setTimeout(function(){box.style.display='none';
  if(!st.value){var q=norm(inp.value);if(q){var ex=st.items.filter(function(x){return norm(x[0])===q||norm(x[1])===q;});if(ex.length===1)pick(ex[0]);}}
  else inp.value=st.label;},150);});
 inp.addEventListener('keydown',function(e){
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(box.style.display==='none')render();var n=st.shown.length;if(!n)return;st.idx=e.key==='ArrowDown'?(st.idx+1)%n:(st.idx<=0?n-1:st.idx-1);render();var el=box.children[st.idx];if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest'});}
  else if(e.key==='Enter'){if(box.style.display!=='none'&&st.shown.length){e.preventDefault();pick(st.shown[st.idx>=0?st.idx:0]);}}
  else if(e.key==='Escape'){box.style.display='none';}});
 return {el:wrap,val:function(){return st.value;},
  setItems:function(a){st.items=a;if(st.value&&!a.filter(function(x){return x[0]===st.value;})[0]){st.value='';st.label='';inp.value='';}},
  clear:function(){st.value='';st.label='';inp.value='';},focus:function(){inp.focus();}};}
function openWa(w,url){if(w&&!w.closed){try{w.location.href=url;return true;}catch(e){}}return false;}
`;

const ISS_CONTROL_JS_ = `var DATA=null,FLT='open',formEl=null,ROLE='eng',VIA='wa',F={};
function load(){google.script.run.withSuccessHandler(setData).withFailureHandler(function(e){msg($('top'),errText(e),false);}).issuesAdminSync(KEY,'');}
function setData(d){DATA=d;VER=d.ver;var sig=JSON.stringify([d.issues,d.engineers,d.drivers,d.vehicles,d.types,d.stmt]);if(sig===LASTSIG)return;LASTSIG=sig;keepFocus(draw);}
function draw(){drawForm();drawFlt();drawList();if(window.drawStmt)drawStmt();}
function note(t,ok,url){var el=$('top');el.className='msg '+(ok?'ok':'er');el.textContent=t;if(url){el.appendChild(document.createTextNode(' '));el.appendChild(h('a',{href:url,target:'_blank',rel:'noopener',style:'font-weight:700;color:#0d652d'},'افتح واتساب وابعت'));}el.style.display=t?'block':'none';}
function resNote(r,base){var t=base,ok=true;if(r.mailed)t+=' واتبعت إيميل.';if(r.mailMissing){t+=' (مفيش إيميل محفوظ، ما اتبعتش).';ok=false;}if(r.waMissing){t+=' (مفيش رقم واتساب محفوظ).';ok=false;}return {t:t,ok:ok};}
function finishWa(w,r,base){var n=resNote(r,base);
 if(r.wa){if(openWa(w,r.wa))note(n.t+' اتفتح واتساب.',true);else note(n.t,true,r.wa);}
 else{if(w)try{w.close();}catch(e){}note(n.t,n.ok);}}
function fillSel(el,first,items){var s=JSON.stringify(items);if(el._s===s)return;el._s=s;var cur=el.value;el.textContent='';el.appendChild(h('option',{value:''},first));items.forEach(function(x){el.appendChild(h('option',{value:x[0]},x[1]));});el.value=cur;}
function seg(opts,get,set){var box=h('div',{cls:'seg'});function paint(){box.textContent='';opts.forEach(function(o){box.appendChild(h('button',{type:'button',cls:'btn '+(get()===o[0]?(o[2]||''):'o'),on:{click:function(){set(o[0]);paint();}}},o[1]));});}paint();box.paint=paint;return box;}
function people(){return ROLE==='drv'?DATA.drivers:DATA.engineers;}
function hint(){var p=F[ROLE==='drv'?'pd':'pe'].val(),el=F.hint,t='';
 if(p&&VIA!==''){var x=people().filter(function(q){return q.id===p;})[0];if(x&&VIA==='wa'&&!x.wa)t='مفيش رقم واتساب محفوظ للشخص ده — هتتحفظ المشكلة بس من غير رسالة.';if(x&&VIA==='email'&&!x.email)t='مفيش إيميل محفوظ للشخص ده — هتتحفظ المشكلة بس من غير رسالة.';}
 el.textContent=t;el.style.display=t?'block':'none';}
function drawForm(){
 if(!formEl){var f=$('form');
  F.v=combo('ابحث برقم أو اسم العربية…');F.pe=combo('ابحث باسم المهندس…',hint);F.pd=combo('ابحث باسم السائق…',hint);
  F.we=h('div',null,[h('label',null,'المهندس المسؤول'),F.pe.el]);F.wd=h('div',{style:'display:none'},[h('label',null,'السائق'),F.pd.el]);
  F.roleSeg=seg([['eng','مهندس'],['drv','سائق']],function(){return ROLE;},function(v){ROLE=v;F.we.style.display=v==='eng'?'block':'none';F.wd.style.display=v==='drv'?'block':'none';hint();});
  F.t=h('select',{cls:'fld'});F.nt=h('input',{cls:'fld',placeholder:'اكتب اسم النوع الجديد (هيتحفظ في القايمة)',style:'display:none;margin-top:8px'});
  F.t.addEventListener('change',function(){F.nt.style.display=F.t.value==='__new__'?'block':'none';if(F.t.value==='__new__')F.nt.focus();});
  F.d=h('textarea',{cls:'fld',style:'min-height:110px',placeholder:'اكتب المشكلة بالتفصيل…'});
  F.viaSeg=seg([['wa','واتساب','wa'],['email','إيميل (Gmail)'],['','بدون إرسال']],function(){return VIA;},function(v){VIA=v;hint();});
  F.hint=h('div',{cls:'msg er',style:'display:none'});
  var out=h('div',{cls:'msg',style:'display:none'});var go=h('button',{cls:'btn w'},'حفظ وإرسال');
  go.addEventListener('click',function(){var w=null;if(VIA==='wa'){try{w=window.open('about:blank','_blank');}catch(e){w=null;}}
   go.disabled=true;msg(out,'',true);
   google.script.run.withSuccessHandler(function(r){go.disabled=false;F.v.clear();F.pe.clear();F.pd.clear();F.t.value='';F.nt.value='';F.nt.style.display='none';F.d.value='';msg(out,'',true);$('fcard').style.display='none';hint();setData(r.payload);finishWa(w,r,'اتضافت المشكلة رقم '+r.id+'.');})
    .withFailureHandler(function(x){go.disabled=false;if(w)try{w.close();}catch(e){}msg(out,errText(x),false);})
    .issuesAdminAdd(KEY,{vehicle:F.v.val(),role:ROLE,personId:F[ROLE==='drv'?'pd':'pe'].val(),type:F.t.value==='__new__'?F.nt.value:F.t.value,desc:F.d.value,via:VIA});});
  [['العربية',F.v.el],['الإرسال إلى',F.roleSeg]].forEach(function(p){var w=h('div');w.appendChild(h('label',null,p[0]));w.appendChild(p[1]);f.appendChild(w);});
  f.appendChild(F.we);f.appendChild(F.wd);
  var tw=h('div');tw.appendChild(h('label',null,'نوع المشكلة'));tw.appendChild(F.t);tw.appendChild(F.nt);f.appendChild(tw);
  var dw=h('div');dw.appendChild(h('label',null,'شرح تفصيلي للمشكلة'));dw.appendChild(F.d);f.appendChild(dw);
  var vw=h('div');vw.appendChild(h('label',null,'طريقة الإرسال'));vw.appendChild(F.viaSeg);f.appendChild(vw);
  f.appendChild(F.hint);f.appendChild(go);f.appendChild(out);formEl=f;}
 F.v.setItems(DATA.vehicles);
 F.pe.setItems(DATA.engineers.map(function(x){return [x.id,x.name,x.name];}));F.pd.setItems(DATA.drivers.map(function(x){return [x.id,x.name,x.name];}));
 fillSel(F.t,'اختار نوع المشكلة…',DATA.types.map(function(x){return [x,x];}).concat([['__new__','➕ إضافة نوع جديد…']]));
}
function drawFlt(){var b=$('flt');b.textContent='';[['open','المفتوحة'],['done','تم الحل'],['all','الكل']].forEach(function(x){b.appendChild(h('button',{cls:'btn '+(FLT===x[0]?'':'o'),style:'min-height:38px;padding:6px 14px',on:{click:function(){FLT=x[0];keepFocus(function(){drawFlt();drawList();});}}},x[1]));});}
var LASTVIA='wa';
function replyBox(i){
 var ta=h('textarea',{cls:'fld','data-iid':String(i.id),style:'min-height:64px',placeholder:i.replies.length?'اكتب ردك…':'اكتب رسالة…'});
 ta.value=DRAFT[i.id]||'';ta.addEventListener('input',function(){DRAFT[i.id]=ta.value;});
 var sel=h('select',{cls:'fld',style:'width:auto;min-height:40px'},[h('option',{value:'wa'},'واتساب'),h('option',{value:'email'},'إيميل (Gmail)'),h('option',{value:''},'بدون إرسال')]);sel.value=LASTVIA;sel.addEventListener('change',function(){LASTVIA=sel.value;});
 var out=h('div',{cls:'msg',style:'display:none;margin-top:8px'});var go=h('button',{cls:'btn',style:'min-height:40px'},'إرسال الرد');
 go.addEventListener('click',function(){var via=sel.value,w=null;if(via==='wa'){try{w=window.open('about:blank','_blank');}catch(e){w=null;}}
  go.disabled=true;msg(out,'',true);
  google.script.run.withSuccessHandler(function(r){go.disabled=false;DRAFT[i.id]='';setData(r.payload);finishWa(w,r,'اتسجل ردك.');})
   .withFailureHandler(function(e){go.disabled=false;if(w)try{w.close();}catch(x){}msg(out,errText(e),false);}).issuesAdminReply(KEY,i.id,ta.value,via);});
 return h('div',{style:'margin-top:10px'},[ta,h('div',{style:'display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:8px'},[go,h('label',{style:'display:flex;gap:6px;align-items:center;font-weight:400;margin:0'},['إرسال عن طريق',sel])]),out]);
}
function drawList(){var L=$('list');L.textContent='';var xs=DATA.issues.filter(function(i){return FLT==='all'||(FLT==='done'?i.status==='تم الحل':i.status!=='تم الحل');});
 if(!xs.length)L.appendChild(h('div',{cls:'mut'},'مفيش مشاكل هنا.'));
 xs.forEach(function(i){var done=i.status==='تم الحل';var btn=h('button',{cls:'btn '+(done?'o':'g'),style:'min-height:40px'},done?'إعادة فتح المشكلة':'تم الحل');
  btn.addEventListener('click',function(){if(!confirm(done?'تعيد فتح المشكلة؟':'تقفل المشكلة (تم الحل)؟'))return;btn.disabled=true;google.script.run.withSuccessHandler(setData).withFailureHandler(function(e){btn.disabled=false;note(errText(e),false);}).issuesAdminSetDone(KEY,i.id,!done);});
  var acts=[];
  if(!done){var wb=h('button',{cls:'btn wa',style:'min-height:40px'},'تذكير واتساب');
   wb.addEventListener('click',function(){var w=null;try{w=window.open('about:blank','_blank');}catch(e){w=null;}
    google.script.run.withSuccessHandler(function(r){if(openWa(w,r.wa))note('اتفتح واتساب.',true);else note('',true,r.wa);}).withFailureHandler(function(e){if(w)try{w.close();}catch(x){}note(errText(e),false);}).issuesAdminWa(KEY,i.id);});
   acts.push(wb);}
  acts.push(btn);
  var kids=[h('div',{style:'display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center'},[h('div',null,[h('b',{style:'font-size:17px'},'عربية '+i.vehicle),' ',h('span',{cls:'chip c-gry'},i.type),' ',chipFor(i.status)]),h('div',{style:'display:flex;gap:8px'},acts)]),
   h('div',{cls:'mut',style:'margin:4px 0 8px'},(i.role==='drv'?'السائق: ':'المهندس: ')+i.engName+' · اتضافت '+i.created+(i.done?' · اتحلت '+i.done:'')+' · رقم '+i.id),
   h('div',{cls:'desc'},i.desc),
   i.replies.length?repsBox(i.replies):h('div',{cls:'mut',style:'margin-top:8px'},'مفيش رد من '+(i.role==='drv'?'السائق':'المهندس')+' لسه.')];
  if(!done)kids.push(replyBox(i));
  L.appendChild(h('div',{style:'border:1px solid #e8eaed;border-radius:12px;padding:14px'},kids));});}
$('addBtn').addEventListener('click',function(){var c=$('fcard');c.style.display=c.style.display==='none'?'block':'none';if(c.style.display==='block'){c.scrollIntoView({behavior:'smooth'});if(F.v)F.v.focus();}});
if(INIT)setData(INIT);else load();
startSync(function(known,ok,fail){google.script.run.withSuccessHandler(ok).withFailureHandler(fail).issuesAdminSync(KEY,known);},setData,POLL);
`;

const ISS_ENG_JS_ = `$('ttl').textContent=(ROLE==='drv'?'مشاكل عربيتي — ':'عربياتي — ')+NAME;
function load(){google.script.run.withSuccessHandler(setData).withFailureHandler(function(e){msg($('top'),errText(e),false);}).issuesEngSync(TOKEN,'');}
function setData(r){VER=r.ver;var sig=JSON.stringify(r.list);if(sig===LASTSIG)return;LASTSIG=sig;keepFocus(function(){draw(r.list);});}
function draw(xs){var L=$('list');L.textContent='';
 if(!xs.length)L.appendChild(h('div',{cls:'card mut'},'مفيش مشاكل محتاجة ردك دلوقتي.'));
 xs.forEach(function(i){var done=i.status==='تم الحل',replied=i.status==='رد المهندس';
  var chip=done?chipFor(i.status):(replied?h('span',{cls:'chip c-blu'},'ردّك اتبعت'):chipFor('محتاجة ردك'));
  var kids=[h('div',{style:'display:flex;justify-content:space-between;align-items:center;gap:8px'},[h('b',{style:'font-size:18px'},'عربية '+i.vehicle+' — '+i.type),chip]),
   h('div',{cls:'mut',style:'margin:6px 0 8px'},'من الإدارة · '+i.created),h('div',{cls:'desc'},i.desc)];
  if(i.replies.length)kids.push(repsBox(i.replies));
  if(done){kids.push(h('div',{cls:'mut',style:'margin-top:10px'},'الإدارة قفلت المشكلة.'));}
  else{var last=i.replies.length?i.replies[i.replies.length-1]:null;
   var ph=!last?'اكتب السبب والمتوقع…':(last.by===ADMIN?'اكتب ردك على الإدارة…':'أضف ردًا جديدًا…');
   var ta=h('textarea',{cls:'fld','data-iid':String(i.id),style:'min-height:90px;margin-top:12px',placeholder:ph});ta.value=DRAFT[i.id]||'';ta.addEventListener('input',function(){DRAFT[i.id]=ta.value;});
   var out=h('div',{cls:'msg',style:'display:none;margin-top:8px'});var go=h('button',{cls:'btn w',style:'margin-top:10px'},'إرسال الرد');
   go.addEventListener('click',function(){go.disabled=true;google.script.run.withSuccessHandler(function(r){DRAFT[i.id]='';setData(r);}).withFailureHandler(function(e){go.disabled=false;msg(out,errText(e),false);}).issuesEngReply(TOKEN,i.id,ta.value);});
   kids.push(ta,go,out,h('div',{cls:'mut',style:'margin-top:8px'},'المشكلة هتفضل ظاهرة لحد ما الإدارة تقفلها.'));}
  L.appendChild(h('div',{cls:'card',style:'border-top:5px solid '+(done?'#1e8e3e':replied?'#1a73e8':'#f9ab00')},kids));});}
if(INIT)setData(INIT);else load();
startSync(function(known,ok,fail){google.script.run.withSuccessHandler(ok).withFailureHandler(fail).issuesEngSync(TOKEN,known);},setData,POLL);
`;

function issJsonForHtml_(s) { return JSON.stringify(String(s)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'); }
function issInitJs_(init) { return 'var INIT=' + (init ? 'JSON.parse(' + issJsonForHtml_(JSON.stringify(init)) + ')' : 'null') + ';var POLL=' + ISS.POLL_MS + ';\n'; }
function issCommonJs_() { return ISS_JS_.replace('__ADMIN__', JSON.stringify(ISS.ADMIN)); }

function issControlHtml_(key, init) {
  const body = '<div class="wrap">' +
    '<div class="hd" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center"><div><h1>صفحة التحكم — إدارة مشاكل العربيات</h1><div>إنت بس اللي تقدر تقفل المشكلة أو تفتحها · الصفحة بتتحدّث تلقائي</div></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button id="addBtn" class="btn" style="background:#fff;color:#1e3a5f">+ إضافة مشكلة جديدة</button><button id="sBtn" class="btn" style="background:#fff;color:#1e3a5f">📋 طلب بيان جديد</button></div></div>' +
    '<div id="top" class="msg" style="display:none"></div>' +
    '<div id="sreqs" class="card" style="display:none"></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">' +
    '<div id="fcard" class="card" style="display:none;flex:1 1 320px;min-width:0"><h2 style="margin:0 0 14px;font-size:19px">مشكلة جديدة</h2><div id="form" style="display:flex;flex-direction:column;gap:12px"></div></div>' +
    '<div id="scard" class="card" style="display:none;flex:1 1 320px;min-width:0"><h2 style="margin:0 0 14px;font-size:19px">طلب بيان جديد</h2><div id="sform" style="display:flex;flex-direction:column;gap:12px"></div></div>' +
    '<div class="card" style="flex:3 1 560px;min-width:0"><div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:19px">كل المشاكل</h2><div id="flt" style="display:flex;gap:8px"></div></div>' +
    '<div class="mut" style="margin:6px 0 12px">المشكلة بتفضل عند المسؤول لحد ما تقفلها. بعد «تم الحل» بتفضل ظاهرة 3 أيام في الداشبورد وعند المهندس / السائق وبعدين تختفي.</div><div id="list" style="display:flex;flex-direction:column;gap:12px"></div></div>' +
    '</div></div>';
  const js = 'var KEY=' + issJsonForHtml_(key) + ';' + issInitJs_(init) + issCommonJs_() + STMT_CONTROL_JS_ + ISS_CONTROL_JS_;
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base target="_top"><style>' + ISS_CSS_ + '</style></head><body>' + body + '<script>' + js + '</script></body></html>';
}

function issEngineerHtml_(token, name, init, role) {
  const body = '<div style="max-width:560px;margin:0 auto;padding:16px 14px 32px;display:flex;flex-direction:column;gap:14px">' +
    '<div class="hd"><h1 id="ttl" style="font-size:21px"></h1><div>المشاكل اللي محتاجة ردك · الصفحة بتتحدّث تلقائي</div></div><div id="top" class="msg" style="display:none"></div><div id="list" style="display:flex;flex-direction:column;gap:14px"></div></div>';
  const js = 'var TOKEN=' + issJsonForHtml_(token) + ';var NAME=' + issJsonForHtml_(name) + ';var ROLE=' + issJsonForHtml_(role || 'eng') + ';' + issInitJs_(init) + issCommonJs_() + ISS_ENG_JS_;
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base target="_top"><style>' + ISS_CSS_ + '</style></head><body>' + body + '<script>' + js + '</script></body></html>';
}