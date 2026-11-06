/* ═════════════════════════════════════════════════════════════════════════════
   Statements.gs — بيان الخلاطة وبيان الجراج (الاتنين بنفس الفكرة: طلب من صفحة التحكم ← رابط للمسؤول ← صفحة يسجّل فيها يوم بيوم)
   ─ شيتين مخفيين ومحميين: "بيان الخلاطة" و"بيان الجراج". الكود بيقراهم كل مرة بيتعمل فيها "ملخص يومي" ويحط البيان في أعمدته، وملاحظات الصيانة / "بدون نقلات" في "ملاحظات".
   ─ بيان الخلاطة (الشكل الجديد، 13 عمود): صف لكل بيان (نقلة / صيانة / بدون نقلات) لكل سيارة في اليوم. لو في أكتر من صف في نفس اليوم: النقلات بتتجمع، وأول خروج وآخر عودة بيتاخدوا من كل الصفوف.
   ─ الإدخال من 3 أماكن بنفس البيانات: (1) صفحة "تقرير بيان الخلاطة" اللي المهندس بيفتحها برابط الطلب (Web App)، (2) زرار "🏭 بيان الخلاطة" في الشيت (إدخال يدوي)، (3) الكتابة المباشرة في الشيت.
   ─ مدير الخلاطة: بيتسجل من زرار "👷 مدير الخلاطة" في الشيت (شيت مخفي Statement Managers). الطلبات في شيت مخفي Statement Requests، وبتتعمل من صفحة التحكم (زرار "طلب بيان جديد" في Issues management.gs).
   ─ بيان الجراج (الشكل الجديد، 9 أعمدة): صف لكل بيان (دخلت الجراج / لم تدخل الجراج) لكل سيارة في اليوم: السائق، دخول، خروج، والصيانة اللي اتعملت (من غير ما نقول في الواجهة إنها اختيارية). نفس الإدخال من 3 أماكن، والمسؤول = "قسم الأمن والعمليات" (شيت Statement Managers بنوع garage).
   ملحوظة أمان: أي دالة public هنا (من غير _ في آخرها) ممكن تتنادى من أي صفحة Web App، عشان كده دوال الشيت بتتأكد إن اللي بينادي هو صاحب الشيت (stmtEditorOnly_)، ودوال الصفحة بتتأكد من التوكن، ودوال الإدارة من مفتاح الإدارة.
   ═════════════════════════════════════════════════════════════════════════════ */
const STMT = {
  MIXER_SHEET: 'بيان الخلاطة', GARAGE_SHEET: 'بيان الجراج', MGR_SHEET: 'Statement Managers', REQ_SHEET: 'Statement Requests',
  MIXER_HEAD: ['التاريخ', 'السيارة', 'نوع البيان', 'السائق', 'عدد النقلات', 'نوع النقلات', 'أول خروج من الخلاطة', 'آخر عودة للخلاطة', 'سبب الصيانة', 'مكان الصيانة', 'ملاحظات', 'رقم الطلب (داخلي)', 'وقت التسجيل (داخلي)'],
  GARAGE_HEAD: ['التاريخ', 'السيارة', 'نوع البيان', 'السائق', 'دخول الجراج', 'خروج من الجراج', 'الصيانة اللي اتعملت', 'رقم الطلب (داخلي)', 'وقت التسجيل (داخلي)'],
  MGR_HEAD: ['النوع', 'الاسم', 'واتساب', 'الإيميل', 'نشط', 'تاريخ التعيين'],
  REQ_HEAD: ['رقم الطلب', 'النوع', 'من', 'إلى', 'المسؤول', 'واتساب', 'الإيميل', 'Token — سري', 'وقت الطلب', 'الحالة'],
  TYPES: ['نقلة', 'صيانة', 'بدون نقلات'],
  GARAGE_TYPES: ['دخلت الجراج', 'لم تدخل الجراج'],
  TRIP_TYPES: ['سن', 'بيتومين'],                   // الأنواع الأساسية. أي نوع جديد بيضيفه المهندس بيتحفظ (Script Property: STMT_TRIP_TYPES)
  PLACES: ['الجراج', 'مركز ال سعفان'],            // أماكن الصيانة الأساسية. أي مكان جديد بيتحفظ (Script Property: STMT_PLACES)
  MAX_DAYS: 62,                                   // أقصى فترة في الطلب الواحد
  MAX_TEXT: 500, MAX_SHORT: 60, MAX_TRIPS: 50,
  KINDS: {
    mixer: { label: 'بيان الخلاطة', mgr: 'مدير الخلاطة', hon: 'مهندس', none: 'مفيش مدير خلاطة معين. قم بإضافة مدير خلاطة جديد.', add: '➕ إضافة مدير خلاطة جديد', change: '✏️ تغيير مدير الخلاطة' },
    garage: { label: 'بيان الجراج', mgr: 'قسم الأمن والعمليات', hon: 'أستاذ', none: 'مفيش مسؤول معين لقسم الأمن والعمليات. قم بإضافة مسؤول جديد.', add: '➕ إضافة مسؤول قسم الأمن والعمليات', change: '✏️ تغيير مسؤول قسم الأمن والعمليات' }
  }
};

/* ───────────── أدوات عامة ───────────── */
function stmtDigits_(v) { return String(v === null || v === undefined ? '' : v).replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 1632); }).replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 1776); }); }
function stmtTxt_(v) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim(); }
function stmtKeyToDMY_(key) { const p = String(key).split('-'); return (+p[2]) + '/' + (+p[1]) + '/' + p[0]; }
function stmtDateKey_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = stmtDigits_(v).trim(); if (!s) return '';
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return m[1] + '-' + p2_(+m[2]) + '-' + p2_(+m[3]);
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (m) return m[3] + '-' + p2_(+m[2]) + '-' + p2_(+m[1]);   // يوم/شهر/سنة
  return '';
}
function stmt12_(mins) {   // دقايق من بداية اليوم → hh:mm AM/PM
  mins = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60), m = mins % 60, ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 === 0 ? 12 : h % 12;
  return p2_(h12) + ':' + p2_(m) + ' ' + ap;
}
function stmtMinsOf_(s) {   // نص فيه وقت (03:14 AM / 3:40 PM / 18:40 / 07:00 م) → دقايق من أول اليوم، أو -1
  const m = String(s).match(/(\d{1,2})\s*[:.]\s*(\d{2})/); if (!m) return -1;
  let h = +m[1]; const mi = +m[2], rest = String(s).slice(m.index + m[0].length);
  if (h > 24 || mi > 59) return -1;
  if (/ص|a\.?\s*m/i.test(rest)) { if (h === 12) h = 0; }
  else if (/م|p\.?\s*m/i.test(rest)) { if (h < 12) h += 12; }
  return (h % 24) * 60 + mi;
}
function stmtTime_(v, tz) {   // (للجراج) الناتج دايماً بصيغة 03:14 AM / 03:40 PM
  if (v instanceof Date) {
    if (v.getFullYear() < 1950) return stmt12_((v.getTime() - new Date(1899, 11, 30, 0, 0, 0).getTime()) / 60000);   // خلية وقت فقط (من غير فرق التوقيت التاريخي)
    const hm = Utilities.formatDate(v, tz, 'HH:mm').split(':'); return stmt12_(+hm[0] * 60 + +hm[1]);
  }
  if (typeof v === 'number') return stmt12_(v * 1440);
  const s = stmtDigits_(v).trim(); if (!s) return '';
  const m = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (!m) return stmtTxt_(s);
  const sf = s.match(/\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)/);   // لو العودة في يوم تاني: (2/10)
  const mins = stmtMinsOf_(s);
  return stmt12_(mins < 0 ? 0 : mins) + (sf ? ' (' + (+sf[1]) + '/' + (+sf[2]) + ')' : '');
}
// خلية تاريخ+وقت (أو وقت بس) → { key: 'yyyy-MM-dd', mins, ms } أو null. defKey = تاريخ الصف (للخلايا اللي فيها وقت بس)
function stmtDT_(v, tz, defKey) {
  if (v === '' || v === null || v === undefined) return null;
  const mk = function (key, mins) { if (!key) return null; const p = key.split('-'); return { key: key, mins: mins, ms: Date.UTC(+p[0], +p[1] - 1, +p[2], 0, mins) }; };
  if (v instanceof Date) {
    if (v.getFullYear() < 1950) return mk(defKey, ((Math.round((v.getTime() - new Date(1899, 11, 30, 0, 0, 0).getTime()) / 60000) % 1440) + 1440) % 1440);
    const hm = Utilities.formatDate(v, tz, 'HH:mm').split(':');
    return mk(Utilities.formatDate(v, tz, 'yyyy-MM-dd'), +hm[0] * 60 + +hm[1]);
  }
  if (typeof v === 'number') return mk(defKey, ((Math.round(v * 1440) % 1440) + 1440) % 1440);
  let s = stmtDigits_(v).trim(); if (!s) return null;
  let key = '', m = s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) { key = m[1] + '-' + p2_(+m[2]) + '-' + p2_(+m[3]); s = s.replace(m[0], ' '); }
  else { m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/); if (m) { key = m[3] + '-' + p2_(+m[2]) + '-' + p2_(+m[1]); s = s.replace(m[0], ' '); } }
  const sf = s.match(/\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)/);
  if (sf) {
    s = s.replace(sf[0], ' ');
    if (!key && defKey) { const y = +defKey.slice(0, 4), dm = +defKey.slice(5, 7), mo = +sf[2]; key = (mo < dm ? y + 1 : y) + '-' + p2_(mo) + '-' + p2_(+sf[1]); }
  }
  const mins = stmtMinsOf_(s); if (mins < 0) return null;
  return mk(key || defKey, mins);
}
function stmtFmtDT_(o) { return stmtKeyToDMY_(o.key) + ' ' + stmt12_(o.mins); }   // 1/10/2026 03:14 AM
function stmtParseLocal_(s) {   // قيمة input datetime-local: 2026-10-01T03:14
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { key: m[1] + '-' + m[2] + '-' + m[3], mins: +m[4] * 60 + +m[5], t: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]), ms: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]), d: +m[3], mo: +m[2], y: +m[1] };
}
function stmtDaysBetween_(from, to) {
  const a = String(from).split('-').map(Number), b = String(to).split('-').map(Number), out = [];
  for (let t = Date.UTC(a[0], a[1] - 1, a[2]), e = Date.UTC(b[0], b[1] - 1, b[2]); t <= e && out.length <= 400; t += 86400000) { const d = new Date(t); out.push(d.getUTCFullYear() + '-' + p2_(d.getUTCMonth() + 1) + '-' + p2_(d.getUTCDate())); }
  return out;
}
// دوال الشيت (النوافذ) مش متاحة لأي حد غير صاحب الشيت (الصفحات العامة ممكن تنادي أي دالة public)
function stmtEditorOnly_() {
  let a = '', e = '';
  try { a = Session.getActiveUser().getEmail(); e = Session.getEffectiveUser().getEmail(); } catch (x) {}
  if (!a || !e || a !== e) throw new Error('غير مصرح.');
}
function stmtHideSafe_(sh) { try { sh.hideSheet(); } catch (e) {} }

/* ───────────── القوايم (سائقين / عربيات / أنواع / أماكن) ───────────── */
function stmtVehicles_() {   // عربيات النقل (نفس قايمة الداشبورد)
  try { if (typeof DASH !== 'undefined' && DASH.NAKLA_VEHICLES && DASH.NAKLA_VEHICLES.length) return DASH.NAKLA_VEHICLES.slice(); } catch (e) {}
  return ISS.VEHICLES.slice();
}
function stmtDrivers_() {   // السواقين النشطين من شيت Drivers (نفس نظام المشاكل)
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ISS.DRV);
    if (!sh || sh.getLastRow() < 2) return [];
    const seen = {}, out = [];
    sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
      const n = stmtTxt_(r[1]); if (!r[0] || !n || seen[n] || r[4] === false || String(r[4]).toLowerCase() === 'false') return;
      seen[n] = 1; out.push(n);
    });
    return out;
  } catch (e) { return []; }
}
function stmtList_(prop, def) {
  try { const t = JSON.parse(PropertiesService.getScriptProperties().getProperty(prop) || 'null'); if (Array.isArray(t) && t.length) return t; } catch (e) {}
  return def.slice();
}
function stmtListAdd_(prop, def, name) {   // جوه الـ lock
  const t = stmtList_(prop, def);
  if (t.indexOf(name) < 0) { t.push(name); PropertiesService.getScriptProperties().setProperty(prop, JSON.stringify(t)); }
}
function stmtLists_() { return { vehicles: stmtVehicles_(), drivers: stmtDrivers_(), tripTypes: stmtList_('STMT_TRIP_TYPES', STMT.TRIP_TYPES), places: stmtList_('STMT_PLACES', STMT.PLACES) }; }

/* ───────────── الشيتات: إنشاء + الشكل + ترحيل الشكل القديم ───────────── */
function stmtHeadStyle_(sh, n) { sh.getRange(1, 1, 1, n).setBackground('#3d85c6').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center'); }
function stmtFormatMixer_(sh) {
  const n = STMT.MIXER_HEAD.length;
  ensureGrid_(sh, 999, n);
  sh.getRange(1, 1, 1, n).setValues([STMT.MIXER_HEAD]); stmtHeadStyle_(sh, n);
  sh.getRange(2, 1, 998, n).setNumberFormat('@').setHorizontalAlignment('center');   // نص: عشان Sheets ما يحوّلش التاريخ والوقت
  sh.getRange(2, 5, 998, 1).setNumberFormat('0');
  sh.setColumnWidths(1, n, 130); sh.setColumnWidth(3, 100); sh.setColumnWidth(7, 170); sh.setColumnWidth(8, 170); sh.setColumnWidth(9, 200); sh.setColumnWidth(11, 260);
  sh.setFrozenRows(1);
  sh.getRange(2, 3, 998, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STMT.TYPES, true).setAllowInvalid(true).build());
}
function stmtFormatSimple_(sh, head, widthLast) {
  const n = head.length;
  sh.getRange(1, 1, 1, n).setValues([head]); stmtHeadStyle_(sh, n);
  sh.getRange(2, 1, 998, n).setNumberFormat('@').setHorizontalAlignment('center');
  sh.setColumnWidths(1, n, 150); sh.setColumnWidth(n, widthLast || 320);
  sh.setFrozenRows(1);
}
// صف قديم (6 أعمدة: تاريخ | سيارة | عدد | خروج | عودة | ملاحظة صيانة) → صف أو اتنين بالشكل الجديد
function stmtMigrateRow_(r, tz) {
  const key = stmtDateKey_(r[0], tz), dateStr = key ? stmtKeyToDMY_(key) : stmtTxt_(r[0]);
  const veh = stmtDigits_(r[1]).trim(), cnt = stmtDigits_(r[2]).replace(/[^0-9]/g, ''), note = stmtTxt_(r[5]);
  const ex = stmtTime_(r[3], tz), rtRaw = stmtTime_(r[4], tz);
  const exFull = ex ? (key ? dateStr + ' ' + ex : ex) : '';
  let rtFull = '';
  if (rtRaw) {
    const m = rtRaw.match(/^(.*?)\s*\((\d{1,2})\/(\d{1,2})\)\s*$/);
    if (m && key) { const y = +key.slice(0, 4), dm = +key.slice(5, 7), mo = +m[3]; rtFull = (+m[2]) + '/' + mo + '/' + (mo < dm ? y + 1 : y) + ' ' + m[1]; }
    else rtFull = key ? dateStr + ' ' + rtRaw : rtRaw;
  }
  const row = function (type, count, reason, notes) { return [dateStr, veh, type, '', count, '', exFull, rtFull, reason, '', notes, 'قديم', '']; };
  const out = [];
  if (cnt !== '') { out.push(row('نقلة', Number(cnt), '', '')); if (note) out.push(row('صيانة', '', note, '')); }   // الملاحظة القديمة كانت ملاحظة صيانة
  else if (note) out.push(row('صيانة', '', note, ''));
  else out.push(row('نقلة', '', '', ''));
  return out;
}
function stmtMixerMigrate_(sh, ss) {
  if (String(sh.getRange(1, 3).getValue()) !== 'عدد النقلات') return;   // الشكل القديم: العمود C = عدد النقلات
  const tz = ss.getSpreadsheetTimeZone(), last = sh.getLastRow();
  const old = last >= 2 ? sh.getRange(2, 1, last - 1, 6).getValues() : [];
  const bkName = STMT.MIXER_SHEET + ' - نسخة قبل التحديث';
  if (!ss.getSheetByName(bkName)) { try { const bk = sh.copyTo(ss); bk.setName(bkName); stmtHideSafe_(bk); } catch (e) {} }
  let out = [];
  old.forEach(function (r) { if (stmtDigits_(r[1]).trim() || stmtTxt_(r[0])) out = out.concat(stmtMigrateRow_(r, tz)); });
  sh.clear();
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations(); } catch (e) {}
  stmtFormatMixer_(sh);
  if (out.length) { ensureGrid_(sh, out.length + 1, STMT.MIXER_HEAD.length); sh.getRange(2, 1, out.length, STMT.MIXER_HEAD.length).setValues(out); }
}
function stmtFormatGarage_(sh) {
  const n = STMT.GARAGE_HEAD.length;
  ensureGrid_(sh, 999, n);
  sh.getRange(1, 1, 1, n).setValues([STMT.GARAGE_HEAD]); stmtHeadStyle_(sh, n);
  sh.getRange(2, 1, 998, n).setNumberFormat('@').setHorizontalAlignment('center');   // نص: عشان Sheets ما يحوّلش التاريخ والوقت
  sh.setColumnWidths(1, n, 130); sh.setColumnWidth(3, 120); sh.setColumnWidth(5, 170); sh.setColumnWidth(6, 170); sh.setColumnWidth(7, 300);
  sh.setFrozenRows(1);
  sh.getRange(2, 3, 998, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STMT.GARAGE_TYPES, true).setAllowInvalid(true).build());
}
// وقت (03:14 AM أو 03:14 AM (2/10)) + تاريخ الصف → وقت كامل بتاريخه (20/10/2026 03:14 AM)
function stmtFullTime_(raw, key, dateStr) {
  if (!raw) return '';
  const m = raw.match(/^(.*?)\s*\((\d{1,2})\/(\d{1,2})\)\s*$/);
  if (m && key) { const y = +key.slice(0, 4), dm = +key.slice(5, 7), mo = +m[3]; return (+m[2]) + '/' + mo + '/' + (mo < dm ? y + 1 : y) + ' ' + m[1]; }
  return key ? dateStr + ' ' + raw : raw;
}
// الشكل القديم (5 أعمدة: تاريخ | سيارة | أول دخول | آخر خروج | ملاحظة صيانة) → الشكل الجديد (9 أعمدة) مرة واحدة، ونسخة احتياطية مخفية
function stmtGarageMigrate_(sh, ss) {
  if (String(sh.getRange(1, 3).getValue()) !== 'أول دخول للجراج') return;   // الشكل القديم: العمود C = أول دخول للجراج
  const tz = ss.getSpreadsheetTimeZone(), last = sh.getLastRow();
  const old = last >= 2 ? sh.getRange(2, 1, last - 1, 5).getValues() : [];
  const bkName = STMT.GARAGE_SHEET + ' - نسخة قبل التحديث';
  if (!ss.getSheetByName(bkName)) { try { const bk = sh.copyTo(ss); bk.setName(bkName); stmtHideSafe_(bk); } catch (e) {} }
  const out = [];
  old.forEach(function (r) {
    const veh = stmtDigits_(r[1]).trim(); if (!veh && !stmtTxt_(r[0])) return;
    const key = stmtDateKey_(r[0], tz), dateStr = key ? stmtKeyToDMY_(key) : stmtTxt_(r[0]);
    out.push([dateStr, veh, 'دخلت الجراج', '', stmtFullTime_(stmtTime_(r[2], tz), key, dateStr), stmtFullTime_(stmtTime_(r[3], tz), key, dateStr), stmtTxt_(r[4]), 'قديم', '']);   // الملاحظة القديمة كانت ملاحظة صيانة
  });
  sh.clear();
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations(); } catch (e) {}
  stmtFormatGarage_(sh);
  if (out.length) { ensureGrid_(sh, out.length + 1, STMT.GARAGE_HEAD.length); sh.getRange(2, 1, out.length, STMT.GARAGE_HEAD.length).setValues(out); }
}
function setupStatementSheets() { statementsEnsure_(SpreadsheetApp.getActiveSpreadsheet(), false); }
function statementsEnsure_(ss, hide) {
  let sh = ss.getSheetByName(STMT.MIXER_SHEET);
  if (!sh) { sh = ss.insertSheet(STMT.MIXER_SHEET); stmtFormatMixer_(sh); if (hide) stmtHideSafe_(sh); }
  else stmtMixerMigrate_(sh, ss);
  let g = ss.getSheetByName(STMT.GARAGE_SHEET);
  if (!g) { g = ss.insertSheet(STMT.GARAGE_SHEET); stmtFormatGarage_(g); if (hide) stmtHideSafe_(g); }
  else stmtGarageMigrate_(g, ss);
}
function stmtMgrSheet_(ss) {
  let sh = ss.getSheetByName(STMT.MGR_SHEET);
  if (!sh) { sh = ss.insertSheet(STMT.MGR_SHEET); stmtFormatSimple_(sh, STMT.MGR_HEAD, 160); sh.setColumnWidth(3, 150); sh.setColumnWidth(4, 220); stmtHideSafe_(sh); }
  return sh;
}
function stmtReqSheet_(ss) {
  let sh = ss.getSheetByName(STMT.REQ_SHEET);
  if (!sh) { sh = ss.insertSheet(STMT.REQ_SHEET); stmtFormatSimple_(sh, STMT.REQ_HEAD, 120); sh.setColumnWidth(8, 260); stmtHideSafe_(sh); }
  return sh;
}

/* ───────────── قراءة بيان الخلاطة ───────────── */
function stmtMixerRow_(r, tz) {
  const key = stmtDateKey_(r[0], tz); if (!key) return null;
  const veh = stmtDigits_(r[1]).trim(); if (!veh) return null;
  const n = stmtDigits_(r[4]).replace(/[^0-9]/g, ''), reason = stmtTxt_(r[8]), notes = stmtTxt_(r[10]);
  let type = stmtTxt_(r[2]);
  if (STMT.TYPES.indexOf(type) < 0) type = n !== '' ? 'نقلة' : ((reason || notes) ? 'صيانة' : '');   // صف اتكتب بإيدك من غير نوع
  return { key: key, veh: veh, type: type, driver: stmtTxt_(r[3]), count: n === '' ? '' : Number(n), tripType: stmtTxt_(r[5]),
    exit: stmtDT_(r[6], tz, key), ret: stmtDT_(r[7], tz, key), reason: reason, place: stmtTxt_(r[9]), notes: notes, req: stmtTxt_(r[11]) };
}
function stmtReadMixerRows_(ss, tz) {
  const sh = ss.getSheetByName(STMT.MIXER_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const out = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, STMT.MIXER_HEAD.length).getValues().forEach(function (r) { const x = stmtMixerRow_(r, tz); if (x) out.push(x); });
  return out;
}

function stmtGarageRow_(r, tz) {
  const key = stmtDateKey_(r[0], tz); if (!key) return null;
  const veh = stmtDigits_(r[1]).trim(); if (!veh) return null;
  const maint = stmtTxt_(r[6]), entry = stmtDT_(r[4], tz, key), exit = stmtDT_(r[5], tz, key);
  let type = stmtTxt_(r[2]);
  if (STMT.GARAGE_TYPES.indexOf(type) < 0) type = (entry || exit || maint) ? 'دخلت الجراج' : '';   // صف اتكتب بإيدك من غير نوع
  if (!type) return null;
  return { key: key, veh: veh, type: type, driver: stmtTxt_(r[3]), entry: entry, exit: exit, maint: maint, req: stmtTxt_(r[7]) };
}
function stmtReadGarageRows_(ss, tz) {
  const sh = ss.getSheetByName(STMT.GARAGE_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const out = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, STMT.GARAGE_HEAD.length).getValues().forEach(function (r) { const x = stmtGarageRow_(r, tz); if (x) out.push(x); });
  return out;
}

// بيقرا الشيتين مرة واحدة ويرجّع { 'yyyy-MM-dd': { mixerRows: [...], garageRows: [...] } } لسيارة واحدة
function statementsLoad_(ss, vehicle) {
  statementsEnsure_(ss, true);
  const tz = ss.getSpreadsheetTimeZone(), vk = stmtDigits_(vehicle).trim();
  const out = {};
  const day = function (k) { return out[k] || (out[k] = { mixerRows: [], garageRows: [] }); };
  stmtReadMixerRows_(ss, tz).forEach(function (r) { if (r.veh === vk) day(r.key).mixerRows.push(r); });
  stmtReadGarageRows_(ss, tz).forEach(function (r) { if (r.veh === vk) day(r.key).garageRows.push(r); });
  return out;
}

// بيان اليوم: { mixer, garage, notes: [...], mixerCount } أو null لو مفيش بيانات لليوم ده
function statementsFor_(stm, dateKey) {
  const d = stm[dateKey]; if (!d) return null;
  const res = { mixer: '', garage: '', notes: [], mixerCount: '' };
  const rows = d.mixerRows || [];
  const trips = rows.filter(function (r) { return r.type === 'نقلة'; }), maint = rows.filter(function (r) { return r.type === 'صيانة'; }), none = rows.filter(function (r) { return r.type === 'بدون نقلات'; });
  if (trips.length) {
    const hasCnt = trips.some(function (r) { return r.count !== ''; });
    const total = trips.reduce(function (s, r) { return s + (r.count === '' ? 0 : r.count); }, 0);
    if (hasCnt) res.mixerCount = total;
    const exits = trips.filter(function (r) { return r.exit; }).map(function (r) { return r.exit; }).sort(function (a, b) { return a.ms - b.ms; });
    const rets = trips.filter(function (r) { return r.ret; }).map(function (r) { return r.ret; }).sort(function (a, b) { return a.ms - b.ms; });
    const p = [];
    if (hasCnt) p.push(total + ' نقلة');
    if (exits.length) p.push('أول خروج من الخلاطة ' + stmt12_(exits[0].mins));
    if (rets.length) { const lr = rets[rets.length - 1]; p.push('آخر عودة للخلاطة ' + stmt12_(lr.mins) + (lr.key !== dateKey ? ' (' + (+lr.key.slice(8, 10)) + '/' + (+lr.key.slice(5, 7)) + ')' : '')); }
    res.mixer = p.join(' | ');
  } else if (none.length) { res.mixerCount = 0; res.mixer = 'بدون نقلات'; }
  maint.forEach(function (r) { const t = [r.reason, r.place].filter(function (x) { return x; }).join(' — '); res.notes.push('صيانة (خلاطة): ' + (t || 'بدون تفاصيل')); });
  none.forEach(function (r) { res.notes.push('بدون نقلات (خلاطة): ' + (r.notes || 'بدون تفاصيل')); });
  const gr = d.garageRows || [];
  const gin = gr.filter(function (r) { return r.type === 'دخلت الجراج'; }), gno = gr.filter(function (r) { return r.type === 'لم تدخل الجراج'; });
  if (gin.length) {
    const ens = gin.filter(function (r) { return r.entry; }).map(function (r) { return r.entry; }).sort(function (a, b) { return a.ms - b.ms; });
    const exs = gin.filter(function (r) { return r.exit; }).map(function (r) { return r.exit; }).sort(function (a, b) { return a.ms - b.ms; });
    const p = [];
    if (ens.length) p.push('أول دخول للجراج ' + stmt12_(ens[0].mins));
    if (exs.length) { const lx = exs[exs.length - 1]; p.push('آخر خروج من الجراج ' + stmt12_(lx.mins) + (lx.key !== dateKey ? ' (' + (+lx.key.slice(8, 10)) + '/' + (+lx.key.slice(5, 7)) + ')' : '')); }
    res.garage = p.length ? p.join(' | ') : 'دخلت الجراج';
    gin.forEach(function (r) { if (r.maint) res.notes.push('صيانة (جراج): ' + r.maint); });
  } else if (gno.length) res.garage = 'لم تدخل الجراج';
  return (res.mixer || res.garage || res.notes.length || res.mixerCount !== '') ? res : null;
}

/* ───────────── حفظ بيان الخلاطة (مشترك: صفحة المهندس + الإدخال اليدوي) ───────────── */
// rec: { veh, day:'yyyy-MM-dd', type:'trip|maint|none', driver, count, tripType, reason, place, exit, ret, notes }   ctx: { mode:'page'|'manual', req }
function stmtSaveMixerRec_(rec, ctx) {
  rec = rec || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  const veh = stmtDigits_(rec.veh).trim();
  if (!veh) throw new Error('اختار السيارة.');
  if (veh.length > 30) throw new Error('رقم السيارة طويل.');
  if (ctx.mode === 'page' && stmtVehicles_().indexOf(veh) < 0) throw new Error('السيارة دي مش من عربيات النقل.');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(rec.day || '')) ? String(rec.day) : '';
  if (!day) throw new Error('اختار اليوم.');
  if (ctx.mode === 'page' && (day < ctx.req.from || day > ctx.req.to)) throw new Error('اليوم ده خارج الفترة المطلوبة.');
  const typeMap = { trip: 'نقلة', maint: 'صيانة', none: 'بدون نقلات' }, type = typeMap[rec.type];
  if (!type) throw new Error('اختار نوع البيان.');
  const lim = function (s, n, what) { s = stmtTxt_(s); if (s.length > n) throw new Error(what + ' طويل (الحد ' + n + ' حرف).'); return s; };
  const notes = lim(rec.notes, STMT.MAX_TEXT, 'الملاحظات');
  let driver = '', tripType = '', reason = '', place = '', cnt = '', ex = null, rt = null;
  if (type !== 'بدون نقلات') {
    driver = lim(rec.driver, STMT.MAX_SHORT, 'اسم السائق'); if (!driver) throw new Error('اختار السائق.');
    ex = stmtParseLocal_(rec.exit); rt = stmtParseLocal_(rec.ret);
    if (!ex) throw new Error('اختار تاريخ ووقت الخروج من الخلاطة.');
    if (ex.key !== day) throw new Error('تاريخ الخروج لازم يكون نفس اليوم المختار (' + stmtKeyToDMY_(day) + ').');
    if (rt && rt.ms < ex.ms) throw new Error('وقت العودة قبل وقت الخروج.');
  }
  if (type === 'نقلة') {
    const n = stmtDigits_(rec.count).replace(/[^0-9]/g, '');
    if (n === '' || Number(n) < 1) throw new Error('اكتب عدد النقلات (1 أو أكتر). لو مفيش نقلات اختار «بدون نقلات».');
    if (Number(n) > STMT.MAX_TRIPS) throw new Error('عدد النقلات كبير (الحد ' + STMT.MAX_TRIPS + '). راجعه.');
    cnt = Number(n);
    tripType = lim(rec.tripType, STMT.MAX_SHORT, 'نوع النقلات'); if (!tripType) throw new Error('اختار نوع النقلات.');
    if (!rt) throw new Error('اختار تاريخ ووقت العودة للخلاطة.');
  } else if (type === 'صيانة') {
    reason = lim(rec.reason, STMT.MAX_TEXT, 'سبب الصيانة'); if (!reason) throw new Error('اكتب سبب الصيانة.');
    place = lim(rec.place, STMT.MAX_SHORT, 'مكان الصيانة'); if (!place) throw new Error('اختار مكان الصيانة.');
  } else if (!notes) throw new Error('اكتب في الملاحظات سبب عدم وجود نقلات.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    statementsEnsure_(ss, true);
    const sh = ss.getSheetByName(STMT.MIXER_SHEET);
    const dup = stmtReadMixerRows_(ss, tz).some(function (r) {   // نفس البيان اتبعت مرتين (دوسة مزدوجة)
      return r.veh === veh && r.key === day && r.type === type && r.driver === driver && r.count === cnt && r.tripType === tripType && r.reason === reason && r.place === place &&
        (r.exit ? r.exit.ms : 0) === (ex ? ex.ms : 0) && (r.ret ? r.ret.ms : 0) === (rt ? rt.ms : 0) && r.notes === notes;
    });
    if (dup) throw new Error('البيان ده متسجل قبل كده بنفس البيانات.');
    if (tripType) stmtListAdd_('STMT_TRIP_TYPES', STMT.TRIP_TYPES, tripType);
    if (place) stmtListAdd_('STMT_PLACES', STMT.PLACES, place);
    const row = Math.max(2, sh.getLastRow() + 1), n = STMT.MIXER_HEAD.length;
    ensureGrid_(sh, row, n);
    const rg = sh.getRange(row, 1, 1, n);
    rg.setNumberFormat('@').setHorizontalAlignment('center');
    rg.setValues([[stmtKeyToDMY_(day), veh, type, driver, cnt, tripType, ex ? stmtFmtDT_(ex) : '', rt ? stmtFmtDT_(rt) : '', reason, place, notes,
      ctx.mode === 'page' ? String(ctx.req.id) : 'يدوي', Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm')]]);
    sh.getRange(row, 5).setNumberFormat('0');
    try { issBump_(); } catch (e) {}   // صفحة التحكم تتحدث (التقدم)
  } finally { lock.releaseLock(); }
  return { ok: true, key: day, veh: veh, msg: 'تم الحفظ ✔ سيارة ' + veh + ' — ' + stmtKeyToDMY_(day) + ' (' + type + ')' };
}

/* ───────────── حفظ بيان الجراج (مشترك: صفحة قسم الأمن والعمليات + الإدخال اليدوي) ───────────── */
// rec: { veh, day:'yyyy-MM-dd', type:'in|no', driver, entry, exit, maint }   ctx: { mode:'page'|'manual', req }
function stmtSaveGarageRec_(rec, ctx) {
  rec = rec || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  const veh = stmtDigits_(rec.veh).trim();
  if (!veh) throw new Error('اختار السيارة.');
  if (veh.length > 30) throw new Error('رقم السيارة طويل.');
  if (ctx.mode === 'page' && stmtVehicles_().indexOf(veh) < 0) throw new Error('السيارة دي مش من عربيات النقل.');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(rec.day || '')) ? String(rec.day) : '';
  if (!day) throw new Error('اختار اليوم.');
  if (ctx.mode === 'page' && (day < ctx.req.from || day > ctx.req.to)) throw new Error('اليوم ده خارج الفترة المطلوبة.');
  const typeMap = { 'in': 'دخلت الجراج', 'no': 'لم تدخل الجراج' }, type = typeMap[rec.type];
  if (!type) throw new Error('اختار نوع البيان.');
  const lim = function (s, n, what) { s = stmtTxt_(s); if (s.length > n) throw new Error(what + ' طويل (الحد ' + n + ' حرف).'); return s; };
  let driver = '', maint = '', en = null, ex = null;
  if (rec.type === 'in') {
    driver = lim(rec.driver, STMT.MAX_SHORT, 'اسم السائق'); if (!driver) throw new Error('اختار السائق.');
    en = stmtParseLocal_(rec.entry); ex = stmtParseLocal_(rec.exit);
    if (!en) throw new Error('اختار تاريخ ووقت دخول الجراج.');
    if (en.key !== day) throw new Error('تاريخ الدخول لازم يكون نفس اليوم المختار (' + stmtKeyToDMY_(day) + ').');
    if (ex && ex.ms < en.ms) throw new Error('وقت الخروج من الجراج قبل وقت الدخول.');
    maint = lim(rec.maint, STMT.MAX_TEXT, 'الصيانة');   // مش إجباري (ومش بنقول كده في الواجهة)
  }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    statementsEnsure_(ss, true);
    const sh = ss.getSheetByName(STMT.GARAGE_SHEET);
    const dup = stmtReadGarageRows_(ss, tz).some(function (r) {   // نفس البيان اتبعت مرتين (دوسة مزدوجة)
      return r.veh === veh && r.key === day && r.type === type && r.driver === driver && r.maint === maint &&
        (r.entry ? r.entry.ms : 0) === (en ? en.ms : 0) && (r.exit ? r.exit.ms : 0) === (ex ? ex.ms : 0);
    });
    if (dup) throw new Error('البيان ده متسجل قبل كده بنفس البيانات.');
    const row = Math.max(2, sh.getLastRow() + 1), n = STMT.GARAGE_HEAD.length;
    ensureGrid_(sh, row, n);
    const rg = sh.getRange(row, 1, 1, n);
    rg.setNumberFormat('@').setHorizontalAlignment('center');
    rg.setValues([[stmtKeyToDMY_(day), veh, type, driver, en ? stmtFmtDT_(en) : '', ex ? stmtFmtDT_(ex) : '', maint,
      ctx.mode === 'page' ? String(ctx.req.id) : 'يدوي', Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm')]]);
    try { issBump_(); } catch (e) {}   // صفحة التحكم تتحدث (التقدم)
  } finally { lock.releaseLock(); }
  return { ok: true, key: day, veh: veh, msg: 'تم الحفظ ✔ سيارة ' + veh + ' — ' + stmtKeyToDMY_(day) + ' (' + type + ')' };
}

/* ───────────── الإدخال اليدوي من الشيت (زرار 🏭 بيان الخلاطة) ───────────── */
function stmtOpenMixer() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(stmtManualHtml_()).setWidth(500).setHeight(740), 'بيان الخلاطة');
}
function stmtManualInfo() { stmtEditorOnly_(); return stmtLists_(); }
function stmtManualSave(rec) {
  stmtEditorOnly_();
  const r = stmtSaveMixerRec_(rec, { mode: 'manual' });
  return { msg: r.msg, info: stmtLists_() };
}

/* ───────────── مدير الخلاطة (وأمن الجراج بعدين): سجل في شيت مخفي ───────────── */
function stmtMgrCurrent_(kind) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STMT.MGR_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  for (let i = v.length - 1; i >= 0; i--) {
    if (String(v[i][0]) === kind && String(v[i][4]) === 'نعم' && stmtTxt_(v[i][1])) return { name: stmtTxt_(v[i][1]), wa: stmtTxt_(v[i][2]), email: stmtTxt_(v[i][3]), since: stmtTxt_(v[i][5]) };
  }
  return null;
}
function stmtMgrInfo(kind) {
  stmtEditorOnly_();
  if (!STMT.KINDS[kind]) throw new Error('نوع غير معروف.');
  const m = stmtMgrCurrent_(kind);
  const K = STMT.KINDS[kind];
  return { kind: kind, title: K.mgr, none: K.none, add: K.add, change: K.change, mgr: m };
}
function stmtMgrSave(kind, o) {
  stmtEditorOnly_();
  if (!STMT.KINDS[kind]) throw new Error('نوع غير معروف.');
  o = o || {};
  const name = stmtTxt_(o.name), wa = stmtDigits_(stmtTxt_(o.wa)), email = stmtTxt_(o.email);
  if (!name) throw new Error('اكتب الاسم.');
  if (name.length > STMT.MAX_SHORT) throw new Error('الاسم طويل (الحد ' + STMT.MAX_SHORT + ' حرف).');
  if (!issWaNumber_(wa)) throw new Error('رقم الواتساب مش صحيح. اكتبه بكود الدولة أو 01xxxxxxxxx للمصري.');
  if (email && (email.length > 100 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) throw new Error('الإيميل مش صحيح (أو سيبه فاضي).');
  const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = stmtMgrSheet_(ss), last = sh.getLastRow();
    if (last >= 2) { const v = sh.getRange(2, 1, last - 1, 5).getValues(); v.forEach(function (r, i) { if (String(r[0]) === kind && String(r[4]) === 'نعم') sh.getRange(i + 2, 5).setValue('لا'); }); }
    const row = Math.max(2, last + 1);
    ensureGrid_(sh, row, 6);
    const rg = sh.getRange(row, 1, 1, 6); rg.setNumberFormat('@');
    rg.setValues([[kind, name, wa, email, 'نعم', Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm')]]);
    try { issBump_(); } catch (e) {}
  } finally { lock.releaseLock(); }
  const K = STMT.KINDS[kind];
  return { kind: kind, title: K.mgr, none: K.none, add: K.add, change: K.change, mgr: stmtMgrCurrent_(kind) };
}
function stmtManagerMixerOpen() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(stmtManagerHtml_('mixer')).setWidth(440).setHeight(520), STMT.KINDS.mixer.mgr);
}

function stmtManagerGarageOpen() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(stmtManagerHtml_('garage')).setWidth(440).setHeight(520), STMT.KINDS.garage.mgr);
}

/* ───────────── الطلبات (صفحة التحكم ← المسؤول) ───────────── */
function stmtReqRead_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STMT.REQ_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const out = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues().forEach(function (r, i) {
    if (r[0] === '' || !r[7]) return;
    out.push({ id: Number(r[0]), kind: String(r[1]), from: stmtTxt_(r[2]), to: stmtTxt_(r[3]), name: stmtTxt_(r[4]), wa: stmtTxt_(r[5]), email: stmtTxt_(r[6]), token: String(r[7]), at: stmtTxt_(r[8]), status: stmtTxt_(r[9]) || 'مفتوح', row: i + 2 });
  });
  return out;
}
function stmtReqByToken_(t) {
  t = String(t || ''); if (!t) return null;
  const all = stmtReqRead_();
  for (let i = 0; i < all.length; i++) if (issSame_(t, all[i].token)) return all[i];
  return null;
}
function stmtReqById_(id) { const a = stmtReqRead_().filter(function (r) { return r.id === Number(id); }); return a[0] || null; }
function stmtDoneMap_(rows, days) {   // { veh: [keys اتسجلت] } لأيام الطلب
  const inDays = {}; days.forEach(function (k) { inDays[k] = 1; });
  const m = {};
  rows.forEach(function (r) { if (inDays[r.key]) { (m[r.veh] = m[r.veh] || {})[r.key] = 1; } });
  const out = {}; Object.keys(m).forEach(function (v) { out[v] = Object.keys(m[v]).sort(); });
  return out;
}
function stmtReqProgress_(req, rows, vehicles) {
  const days = stmtDaysBetween_(req.from, req.to), dm = stmtDoneMap_(rows, days);
  let done = 0; vehicles.forEach(function (v) { done += (dm[v] || []).length; });
  return { days: days, done: done, total: vehicles.length * days.length, doneMap: dm };
}
function stmtAdminInfo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone(), vehicles = stmtVehicles_();
  const mm = stmtMgrCurrent_('mixer'), gm = stmtMgrCurrent_('garage');
  const rowsBy = { mixer: stmtReadMixerRows_(ss, tz), garage: stmtReadGarageRows_(ss, tz) };
  const reqs = stmtReqRead_().sort(function (a, b) { return b.id - a.id; }).slice(0, 15).map(function (q) {
    const p = stmtReqProgress_(q, rowsBy[q.kind] || [], vehicles);
    return { id: q.id, kind: q.kind, label: (STMT.KINDS[q.kind] || {}).label || q.kind, from: stmtKeyToDMY_(q.from), to: stmtKeyToDMY_(q.to), mgr: q.name, at: q.at,
      status: q.status === 'ملغي' ? 'ملغي' : (p.total > 0 && p.done >= p.total ? 'مكتمل' : 'مفتوح'), done: p.done, total: p.total };
  });
  const brief = function (m) { return m ? { name: m.name, wa: !!issWaNumber_(m.wa), email: !!m.email } : null; };
  return { managers: { mixer: brief(mm), garage: brief(gm) }, requests: reqs };
}
function stmtSafeInfo_() { try { return stmtAdminInfo_(); } catch (e) { return { managers: {}, requests: [] }; } }

function stmtRequestText_(req, link, reminder) {
  const k = STMT.KINDS[req.kind] || STMT.KINDS.mixer;
  return 'السلام عليكم ورحمة الله\n' + k.hon + ' ' + req.name + '\nيا رب يكون حضرتك بخير\n' +
    (reminder ? 'تذكير ب' : 'بستأذن حضرتك في ') + k.label + ' في الفترة من ' + stmtKeyToDMY_(req.from) + ' إلى ' + stmtKeyToDMY_(req.to) + '.\n' +
    'برجاء تسجيل البيان من خلال الدخول على الرابط التالي:\n' + link +
    '\n\nلو حاولت تفتح الرابط ومفتحش، برجاء إرسال بيان الفترة المحددة على واتساب بشكل مؤقت حتى عودة الموقع للعمل.';
}
function stmtAdminCreate(key, o) {
  issAdminCheck_(key);
  o = o || {};
  const kind = String(o.kind || 'mixer');
  if (!STMT.KINDS[kind]) throw new Error('نوع البيان غير معروف.');
  const from = String(o.from || ''), to = String(o.to || ''), via = o.via === 'wa' || o.via === 'email' ? o.via : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error('اختار تاريخ البداية والنهاية.');
  if (to < from) throw new Error('تاريخ النهاية قبل البداية.');
  const days = stmtDaysBetween_(from, to);
  if (days.length > STMT.MAX_DAYS) throw new Error('الفترة طويلة (الحد ' + STMT.MAX_DAYS + ' يوم).');
  const mgr = stmtMgrCurrent_(kind);
  if (!mgr) throw new Error('مفيش ' + STMT.KINDS[kind].mgr + ' معيّن. عيّنه من قائمة الشيت: خلاطة / جراج ← ' + STMT.KINDS[kind].mgr + '.');
  const base = issBaseUrl_();
  if (!base) throw new Error('لسه مفيش رابط Web app محفوظ (🌐 حفظ رابط الـ Web app).');
  const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  let req = null;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = stmtReqSheet_(ss), last = sh.getLastRow();
    let id = 1; if (last >= 2) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { if (Number(r[0]) >= id) id = Number(r[0]) + 1; });
    const token = issRand_(32), row = Math.max(2, last + 1);
    ensureGrid_(sh, row, 10);
    const rg = sh.getRange(row, 1, 1, 10); rg.setNumberFormat('@');
    rg.setValues([[id, kind, from, to, mgr.name, mgr.wa, mgr.email, token, Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm'), 'مفتوح']]);
    req = { id: id, kind: kind, from: from, to: to, name: mgr.name, wa: mgr.wa, email: mgr.email, token: token };
    issBump_();
  } finally { lock.releaseLock(); }
  const link = base + '?page=stmt&k=' + req.token;
  const d = issDeliver_(via, { wa: mgr.wa, email: mgr.email }, 'طلب ' + STMT.KINDS[kind].label + ' من ' + stmtKeyToDMY_(from) + ' إلى ' + stmtKeyToDMY_(to), stmtRequestText_(req, link, false));
  return { id: req.id, payload: issAdminPayload_(), mailed: d.mailed, mailMissing: d.mailMissing, wa: d.wa, waMissing: d.waMissing };
}
function stmtAdminCancel(key, id) {
  issAdminCheck_(key);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const q = stmtReqById_(id); if (!q) throw new Error('الطلب مش موجود.');
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STMT.REQ_SHEET).getRange(q.row, 10).setValue('ملغي');
    issBump_();
  } finally { lock.releaseLock(); }
  return issAdminPayload_();
}
function stmtAdminRemind(key, id) {
  issAdminCheck_(key);
  const q = stmtReqById_(id); if (!q) throw new Error('الطلب مش موجود.');
  if (q.status === 'ملغي') throw new Error('الطلب ده اتلغى.');
  const base = issBaseUrl_(); if (!base) throw new Error('لسه مفيش رابط Web app محفوظ.');
  const url = issWaUrl_({ wa: q.wa }, stmtRequestText_(q, base + '?page=stmt&k=' + q.token, true));
  if (!url) throw new Error('رقم الواتساب المحفوظ لـ ' + q.name + ' مش صحيح.');
  return { wa: url };
}

/* ───────────── صفحة المهندس: تقرير بيان الخلاطة (Web App ?page=stmt&k=TOKEN) ───────────── */
function stmtPageInfo_(req) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone(), vehicles = stmtVehicles_();
  const p = stmtReqProgress_(req, req.kind === 'garage' ? stmtReadGarageRows_(ss, tz) : stmtReadMixerRows_(ss, tz), vehicles), L = stmtLists_();
  return { req: { id: req.id, kind: req.kind, label: STMT.KINDS[req.kind].label, from: req.from, to: req.to, days: p.days, mgr: req.name, status: req.status },
    vehicles: vehicles, done: p.doneMap, drivers: L.drivers, tripTypes: L.tripTypes, places: L.places };
}
function stmtPageOut_(token) {
  const req = stmtReqByToken_(token);
  if (!req || !STMT.KINDS[req.kind]) return null;
  return HtmlService.createHtmlOutput(stmtPageHtml_(token, stmtPageInfo_(req))).setTitle(req.kind === 'garage' ? 'تقرير بيان الجراج' : 'تقرير بيان الخلاطة');
}
function stmtPageInfo(token) {
  const req = stmtReqByToken_(token); if (!req) throw new Error('الرابط غير صحيح.');
  return stmtPageInfo_(req);
}
function stmtPageSave(token, rec) {
  const req = stmtReqByToken_(token); if (!req) throw new Error('الرابط غير صحيح.');
  if (req.status === 'ملغي') throw new Error('الطلب ده اتلغى من الإدارة.');
  const r = req.kind === 'garage' ? stmtSaveGarageRec_(rec, { mode: 'page', req: req }) : stmtSaveMixerRec_(rec, { mode: 'page', req: req });
  return { msg: r.msg, key: r.key, info: stmtPageInfo_(req) };
}

/* ───────────── الإدخال اليدوي لبيان الجراج (زرار 🔧 بيان الجراج) ───────────── */
function stmtOpenGarage() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(stmtManualHtml_('garage')).setWidth(500).setHeight(700), 'بيان الجراج');
}
function stmtGarageManualInfo() { stmtEditorOnly_(); return stmtLists_(); }
function stmtGarageManualSave(rec) {
  stmtEditorOnly_();
  const r = stmtSaveGarageRec_(rec, { mode: 'manual' });
  return { msg: r.msg, info: stmtLists_() };
}

/* ═════════════ واجهات HTML ═════════════
   تنبيه: الكود اللي جوه template literal (علامة `) ممنوع فيه backslash أو ${ — استخدم String.fromCharCode(10) للسطر الجديد وCSS/JS من غير \ ، وإلا النص بيتغير. */

// نموذج بيان الخلاطة (مشترك بين صفحة المهندس CFG.mode='page' والنافذة اليدوية CFG.mode='manual')
// المتغيرات المتوقعة: CFG, INIT (قوايم + في صفحة المهندس: req/done)، ودوال h/$/msg/errText من issCommonJs_()
const STMT_FORM_JS_ = `var S={data:null,type:'trip'},E={},W={},busy=false,PAGE=(CFG.mode==='page'),NL=String.fromCharCode(10);
var WD=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function dp(k){var p=String(k).split('-');return {y:+p[0],m:+p[1],d:+p[2]};}
function dshort(k){var p=dp(k);return p.d+'/'+p.m;}
function dfull(k){var p=dp(k);return p.d+'/'+p.m+'/'+p.y;}
function dlabel(k){var p=dp(k);return WD[new Date(Date.UTC(p.y,p.m-1,p.d)).getUTCDay()]+' '+p.d+'/'+p.m+'/'+p.y;}
function mkSel(){return h('select',{cls:'fld'});}
function mkNew(ph){return h('input',{cls:'fld',placeholder:ph,style:'display:none;margin-top:8px'});}
function setOpts(el,first,items,newLbl){var cur=el.value;el.textContent='';el.appendChild(h('option',{value:''},first));items.forEach(function(x){el.appendChild(h('option',{value:x[0]},x[1]));});if(newLbl)el.appendChild(h('option',{value:'__new__'},newLbl));el.value=cur;if(el.value!==cur)el.value='';}
function hookNew(s,i){s.addEventListener('change',function(){i.style.display=s.value==='__new__'?'block':'none';if(s.value==='__new__')i.focus();});}
function getv(s,i){return s.value==='__new__'?i.value:s.value;}
function field(label,els){var d=h('div',null,[h('label',null,label)].concat(els));d.lbl=d.firstChild;return d;}
function show(el,on){el.style.display=on?'block':'none';}
function remDays(v){var dn=(S.data.done&&S.data.done[v])||[];return S.data.req.days.filter(function(k){return dn.indexOf(k)<0;});}
function build(){
 var root=$('app');root.textContent='';
 E.veh=mkSel();E.vehIn=mkNew('اكتب رقم السيارة');hookNew(E.veh,E.vehIn);
 E.day=PAGE?mkSel():h('input',{cls:'fld',type:'date'});
 E.driver=mkSel();E.driverIn=mkNew('اكتب اسم السائق');hookNew(E.driver,E.driverIn);
 E.count=h('input',{cls:'fld',type:'number',min:'1',step:'1',inputmode:'numeric',placeholder:'عدد النقلات'});
 E.ttype=mkSel();E.ttypeIn=mkNew('اكتب نوع النقلات الجديد (هيتحفظ في القايمة)');hookNew(E.ttype,E.ttypeIn);
 E.reason=h('textarea',{cls:'fld',style:'min-height:70px',placeholder:'اكتب سبب الصيانة…'});
 E.place=mkSel();E.placeIn=mkNew('اكتب مكان الصيانة (هيتحفظ في القايمة)');hookNew(E.place,E.placeIn);
 E.exit=h('input',{cls:'fld',type:'datetime-local'});E.ret=h('input',{cls:'fld',type:'datetime-local'});
 E.notes=h('textarea',{cls:'fld',style:'min-height:70px'});
 E.seg=h('div',{cls:'seg'});
 E.info=h('div',{cls:'msg',style:'display:none;background:#e8f0fe;color:#174ea6;line-height:1.9;white-space:pre-wrap'});
 E.thanks=h('div',{cls:'msg ok',style:'display:none;font-size:15px;line-height:1.9;white-space:pre-wrap'});
 E.out=h('div',{cls:'msg',style:'display:none'});
 E.go=h('button',{cls:'btn w',type:'button'},'إرسال البيان');
 W.veh=field('السيارة',[E.veh,E.vehIn]);W.day=field('اليوم',[E.day]);W.type=field('نوع البيان',[E.seg]);
 W.driver=field('اسم السائق',[E.driver,E.driverIn]);W.count=field('عدد النقلات',[E.count]);W.ttype=field('نوع النقلات',[E.ttype,E.ttypeIn]);
 W.reason=field('سبب الصيانة',[E.reason]);W.place=field('مكان الصيانة',[E.place,E.placeIn]);
 W.exit=field('تاريخ ووقت الخروج من الخلاطة',[E.exit]);W.ret=field('تاريخ ووقت العودة للخلاطة',[E.ret]);W.notes=field('ملاحظات (اختياري)',[E.notes]);
 var box=h('div',{cls:'card',style:'display:flex;flex-direction:column;gap:14px'},[W.veh,E.info,E.thanks,W.day,W.type,W.driver,W.count,W.ttype,W.reason,W.place,W.exit,W.ret,W.notes,E.go,E.out]);
 root.appendChild(box);
 E.veh.addEventListener('change',function(){if(PAGE){drawDays('');drawInfo();}});
 E.day.addEventListener('change',function(){limits();if(E.exit.value&&E.exit.value.slice(0,10)!==E.day.value)E.exit.value='';limits();});
 E.exit.addEventListener('change',limits);
 E.go.addEventListener('click',send);
 paintSeg();applyType();
}
function paintSeg(){E.seg.textContent='';[['trip','نقلة'],['maint','صيانة'],['none','بدون نقلات']].forEach(function(o){E.seg.appendChild(h('button',{type:'button',cls:'btn '+(S.type===o[0]?'':'o'),on:{click:function(){S.type=o[0];paintSeg();applyType();}}},o[1]));});}
function applyType(){var t=S.type;
 show(W.driver,t!=='none');show(W.count,t==='trip');show(W.ttype,t==='trip');show(W.reason,t==='maint');show(W.place,t==='maint');show(W.exit,t!=='none');show(W.ret,t!=='none');
 W.ret.lbl.textContent=t==='maint'?'تاريخ ووقت العودة للخلاطة (سيبه فاضي لو لسه في الصيانة)':'تاريخ ووقت العودة للخلاطة';
 W.notes.lbl.textContent=t==='none'?'سبب عدم وجود نقلات (مطلوب)':'ملاحظات (اختياري)';
 E.notes.placeholder=t==='none'?'اكتب السبب…':'اكتب أي ملاحظات…';}
function limits(){var d=E.day.value;if(!d){E.exit.removeAttribute('min');E.exit.removeAttribute('max');E.ret.removeAttribute('min');return;}
 E.exit.min=d+'T00:00';E.exit.max=d+'T23:59';E.ret.min=E.exit.value||(d+'T00:00');}
function refreshLists(){var d=S.data;
 setOpts(E.driver,'اختار السائق…',d.drivers.map(function(x){return [x,x];}),'سائق آخر…');
 setOpts(E.ttype,'اختار نوع النقلات…',d.tripTypes.map(function(x){return [x,x];}),'➕ إضافة نوع جديد…');
 setOpts(E.place,'اختار مكان الصيانة…',d.places.map(function(x){return [x,x];}),'➕ مكان آخر…');}
function drawVeh(){var items;
 if(PAGE)items=S.data.vehicles.map(function(v){var r=remDays(v).length;return [v,'سيارة '+v+(r===0?' — ✔ مكتمل':' — فاضل '+r+' يوم')];});
 else items=S.data.vehicles.map(function(v){return [v,'سيارة '+v];});
 setOpts(E.veh,'اختار السيارة…',items,PAGE?null:'سيارة أخرى…');}
function drawDays(pref){var dn=(S.data.done&&S.data.done[E.veh.value])||[];
 setOpts(E.day,'اختار اليوم…',S.data.req.days.map(function(k){return [k,dlabel(k)+(dn.indexOf(k)>=0?' ✔ (مسجل)':'')];}));
 var rem=E.veh.value?remDays(E.veh.value):[];
 E.day.value=(pref&&S.data.req.days.indexOf(pref)>=0)?pref:(rem[0]||'');
 limits();}
function drawInfo(){if(!PAGE)return;var v=E.veh.value;
 if(!v){E.info.style.display='none';E.thanks.style.display='none';return;}
 var rem=remDays(v),rq=S.data.req;
 if(!rem.length){E.info.style.display='none';
  var others=S.data.vehicles.filter(function(x){return remDays(x).length>0;});
  E.thanks.textContent='شكراً لحضرتك يا بشمهندس '+rq.mgr+'، تم إرسال بيان الخلاطة للفترة المطلوبة (سيارة '+v+')، جزاك الله خيرًا.'+(others.length?NL+'باقي سيارات: '+others.join('، '):NL+'تم تسجيل بيان كل السيارات ✔');
  E.thanks.style.display='block';return;}
 E.thanks.style.display='none';
 E.info.textContent='برجاء إدخال بيان السيارة '+v+' من تاريخ '+dfull(rq.from)+' لتاريخ '+dfull(rq.to)+NL+'فاضلك: '+rem.map(dshort).join('، ');
 E.info.style.display='block';}
function collect(){return {veh:getv(E.veh,E.vehIn),day:E.day.value,type:S.type,driver:getv(E.driver,E.driverIn),count:E.count.value,tripType:getv(E.ttype,E.ttypeIn),reason:E.reason.value,place:getv(E.place,E.placeIn),exit:E.exit.value,ret:E.ret.value,notes:E.notes.value};}
function resetFields(){S.type='trip';paintSeg();applyType();
 [E.driver,E.ttype,E.place].forEach(function(s){s.value='';});[E.driverIn,E.ttypeIn,E.placeIn].forEach(function(i){i.value='';i.style.display='none';});
 E.count.value='';E.reason.value='';E.exit.value='';E.ret.value='';E.notes.value='';}
function nextDay(saved){var rem=remDays(E.veh.value),after=rem.filter(function(k){return k>saved;});return after[0]||rem[0]||'';}
function send(){if(busy)return;busy=true;E.go.disabled=true;msg(E.out,'',true);
 var run=google.script.run.withSuccessHandler(function(r){busy=false;E.go.disabled=false;S.data=r.info;var v=E.veh.value;resetFields();refreshLists();drawVeh();E.veh.value=v;
   if(PAGE){drawDays(nextDay(r.key));drawInfo();}msg(E.out,r.msg,true);})
  .withFailureHandler(function(e){busy=false;E.go.disabled=false;msg(E.out,errText(e),false);});
 if(PAGE)run.stmtPageSave(CFG.token,collect());else run.stmtManualSave(collect());}
function init(){S.data=INIT;
 if(PAGE){var rq=S.data.req;$('sub').textContent='الفترة المطلوبة: من '+dfull(rq.from)+' إلى '+dfull(rq.to);
  $('welcome').textContent='السلام عليكم يا بشمهندس '+rq.mgr+'، أهلاً بحضرتك. اختار السيارة وسجّل بيانها يوم بيوم، وبعد كل إرسال هتلاقي اليوم اللي بعده جاهز.';
  if(rq.status==='ملغي'){msg($('top'),'الطلب ده اتلغى من الإدارة.',false);return;}}
 build();refreshLists();drawVeh();if(PAGE){drawDays('');drawInfo();}}
init();
`;

const STMT_GFORM_JS_ = `var S={data:null,type:'in'},E={},W={},busy=false,PAGE=(CFG.mode==='page'),NL=String.fromCharCode(10);
var WD=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function dp(k){var p=String(k).split('-');return {y:+p[0],m:+p[1],d:+p[2]};}
function dshort(k){var p=dp(k);return p.d+'/'+p.m;}
function dfull(k){var p=dp(k);return p.d+'/'+p.m+'/'+p.y;}
function dlabel(k){var p=dp(k);return WD[new Date(Date.UTC(p.y,p.m-1,p.d)).getUTCDay()]+' '+p.d+'/'+p.m+'/'+p.y;}
function mkSel(){return h('select',{cls:'fld'});}
function mkNew(ph){return h('input',{cls:'fld',placeholder:ph,style:'display:none;margin-top:8px'});}
function setOpts(el,first,items,newLbl){var cur=el.value;el.textContent='';el.appendChild(h('option',{value:''},first));items.forEach(function(x){el.appendChild(h('option',{value:x[0]},x[1]));});if(newLbl)el.appendChild(h('option',{value:'__new__'},newLbl));el.value=cur;if(el.value!==cur)el.value='';}
function hookNew(s,i){s.addEventListener('change',function(){i.style.display=s.value==='__new__'?'block':'none';if(s.value==='__new__')i.focus();});}
function getv(s,i){return s.value==='__new__'?i.value:s.value;}
function field(label,els){var d=h('div',null,[h('label',null,label)].concat(els));d.lbl=d.firstChild;return d;}
function show(el,on){el.style.display=on?'block':'none';}
function remDays(v){var dn=(S.data.done&&S.data.done[v])||[];return S.data.req.days.filter(function(k){return dn.indexOf(k)<0;});}
function build(){
 var root=$('app');root.textContent='';
 E.veh=mkSel();E.vehIn=mkNew('اكتب رقم السيارة');hookNew(E.veh,E.vehIn);
 E.day=PAGE?mkSel():h('input',{cls:'fld',type:'date'});
 E.driver=mkSel();E.driverIn=mkNew('اكتب اسم السائق');hookNew(E.driver,E.driverIn);
 E.entry=h('input',{cls:'fld',type:'datetime-local'});E.exit=h('input',{cls:'fld',type:'datetime-local'});
 E.maint=h('textarea',{cls:'fld',style:'min-height:80px',placeholder:'اكتب الصيانة اللي اتعملت…'});
 E.seg=h('div',{cls:'seg'});
 E.info=h('div',{cls:'msg',style:'display:none;background:#e8f0fe;color:#174ea6;line-height:1.9;white-space:pre-wrap'});
 E.thanks=h('div',{cls:'msg ok',style:'display:none;font-size:15px;line-height:1.9;white-space:pre-wrap'});
 E.out=h('div',{cls:'msg',style:'display:none'});
 E.go=h('button',{cls:'btn w',type:'button'},'إرسال البيان');
 W.veh=field('السيارة',[E.veh,E.vehIn]);W.day=field('اليوم',[E.day]);W.type=field('نوع البيان',[E.seg]);
 W.driver=field('اسم السائق',[E.driver,E.driverIn]);W.entry=field('تاريخ ووقت دخول الجراج',[E.entry]);
 W.exit=field('تاريخ ووقت الخروج من الجراج (سيبه فاضي لو لسه جوه الجراج)',[E.exit]);W.maint=field('الصيانة اللي اتعملت',[E.maint]);
 var box=h('div',{cls:'card',style:'display:flex;flex-direction:column;gap:14px'},[W.veh,E.info,E.thanks,W.day,W.type,W.driver,W.entry,W.exit,W.maint,E.go,E.out]);
 root.appendChild(box);
 E.veh.addEventListener('change',function(){if(PAGE){drawDays('');drawInfo();}});
 E.day.addEventListener('change',function(){limits();if(E.entry.value&&E.entry.value.slice(0,10)!==E.day.value)E.entry.value='';limits();});
 E.entry.addEventListener('change',limits);
 E.go.addEventListener('click',send);
 paintSeg();applyType();
}
function paintSeg(){E.seg.textContent='';[['in','دخلت الجراج'],['no','لم تدخل الجراج']].forEach(function(o){E.seg.appendChild(h('button',{type:'button',cls:'btn '+(S.type===o[0]?'':'o'),on:{click:function(){S.type=o[0];paintSeg();applyType();}}},o[1]));});}
function applyType(){var t=S.type;show(W.driver,t==='in');show(W.entry,t==='in');show(W.exit,t==='in');show(W.maint,t==='in');}
function limits(){var d=E.day.value;if(!d){E.entry.removeAttribute('min');E.entry.removeAttribute('max');E.exit.removeAttribute('min');return;}
 E.entry.min=d+'T00:00';E.entry.max=d+'T23:59';E.exit.min=E.entry.value||(d+'T00:00');}
function refreshLists(){var d=S.data;setOpts(E.driver,'اختار السائق…',d.drivers.map(function(x){return [x,x];}),'سائق آخر…');}
function drawVeh(){var items;
 if(PAGE)items=S.data.vehicles.map(function(v){var r=remDays(v).length;return [v,'سيارة '+v+(r===0?' — ✔ مكتمل':' — فاضل '+r+' يوم')];});
 else items=S.data.vehicles.map(function(v){return [v,'سيارة '+v];});
 setOpts(E.veh,'اختار السيارة…',items,PAGE?null:'سيارة أخرى…');}
function drawDays(pref){var dn=(S.data.done&&S.data.done[E.veh.value])||[];
 setOpts(E.day,'اختار اليوم…',S.data.req.days.map(function(k){return [k,dlabel(k)+(dn.indexOf(k)>=0?' ✔ (مسجل)':'')];}));
 var rem=E.veh.value?remDays(E.veh.value):[];
 E.day.value=(pref&&S.data.req.days.indexOf(pref)>=0)?pref:(rem[0]||'');
 limits();}
function drawInfo(){if(!PAGE)return;var v=E.veh.value;
 if(!v){E.info.style.display='none';E.thanks.style.display='none';return;}
 var rem=remDays(v),rq=S.data.req;
 if(!rem.length){E.info.style.display='none';
  var others=S.data.vehicles.filter(function(x){return remDays(x).length>0;});
  E.thanks.textContent='شكراً لحضرتك يا أستاذ '+rq.mgr+'، تم إرسال بيان الجراج للفترة المطلوبة (سيارة '+v+')، جزاك الله خيرًا.'+(others.length?NL+'باقي سيارات: '+others.join('، '):NL+'تم تسجيل بيان كل السيارات ✔');
  E.thanks.style.display='block';return;}
 E.thanks.style.display='none';
 E.info.textContent='برجاء إدخال بيان السيارة '+v+' من تاريخ '+dfull(rq.from)+' لتاريخ '+dfull(rq.to)+NL+'فاضلك: '+rem.map(dshort).join('، ');
 E.info.style.display='block';}
function collect(){return {veh:getv(E.veh,E.vehIn),day:E.day.value,type:S.type,driver:getv(E.driver,E.driverIn),entry:E.entry.value,exit:E.exit.value,maint:E.maint.value};}
function resetFields(){S.type='in';paintSeg();applyType();
 E.driver.value='';E.driverIn.value='';E.driverIn.style.display='none';
 E.entry.value='';E.exit.value='';E.maint.value='';}
function nextDay(saved){var rem=remDays(E.veh.value),after=rem.filter(function(k){return k>saved;});return after[0]||rem[0]||'';}
function send(){if(busy)return;busy=true;E.go.disabled=true;msg(E.out,'',true);
 var run=google.script.run.withSuccessHandler(function(r){busy=false;E.go.disabled=false;S.data=r.info;var v=E.veh.value;resetFields();refreshLists();drawVeh();E.veh.value=v;
   if(PAGE){drawDays(nextDay(r.key));drawInfo();}msg(E.out,r.msg,true);})
  .withFailureHandler(function(e){busy=false;E.go.disabled=false;msg(E.out,errText(e),false);});
 if(PAGE)run.stmtPageSave(CFG.token,collect());else run.stmtGarageManualSave(collect());}
function init(){S.data=INIT;
 if(PAGE){var rq=S.data.req;$('sub').textContent='الفترة المطلوبة: من '+dfull(rq.from)+' إلى '+dfull(rq.to);
  $('welcome').textContent='السلام عليكم يا أستاذ '+rq.mgr+'، أهلاً بحضرتك. اختار السيارة وسجّل بيانها يوم بيوم، وبعد كل إرسال هتلاقي اليوم اللي بعده جاهز.';
  if(rq.status==='ملغي'){msg($('top'),'الطلب ده اتلغى من الإدارة.',false);return;}}
 build();refreshLists();drawVeh();if(PAGE){drawDays('');drawInfo();}}
init();
`;

const STMT_MIXER_CSS_ = `.hd2{background:#1e3a5f;color:#fff;border-radius:14px;padding:16px 20px}.hd2 h1{margin:0;font-size:22px}.hd2 div{opacity:.9;font-size:14px;margin-top:4px}`;

function stmtPageHtml_(token, info) {
  const g = info && info.req && info.req.kind === 'garage';
  const body = '<div style="max-width:560px;margin:0 auto;padding:16px 14px 32px;display:flex;flex-direction:column;gap:14px">' +
    '<div class="hd2"><h1>' + (g ? 'تقرير بيان الجراج' : 'تقرير بيان الخلاطة') + '</h1><div id="sub"></div></div>' +
    '<div class="card" id="welcome" style="line-height:1.9;font-size:15px"></div>' +
    '<div id="top" class="msg" style="display:none"></div><div id="app" style="display:flex;flex-direction:column;gap:14px"></div></div>';
  const js = 'var CFG={mode:"page",token:' + issJsonForHtml_(token) + '};' + issInitJs_(info) + issCommonJs_() + (g ? STMT_GFORM_JS_ : STMT_FORM_JS_);
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base target="_top"><style>' + ISS_CSS_ + STMT_MIXER_CSS_ + '</style></head><body>' + body + '<script>' + js + '</script></body></html>';
}
function stmtManualHtml_(kind) {
  const body = '<div style="padding:14px"><div id="app"></div></div>';
  const js = 'var CFG={mode:"manual"};' + issInitJs_(stmtLists_()) + issCommonJs_() + (kind === 'garage' ? STMT_GFORM_JS_ : STMT_FORM_JS_);
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base target="_top"><style>' + ISS_CSS_ + 'body{background:#fff}.card{box-shadow:none;padding:0}</style></head><body>' + body + '<script>' + js + '</script></body></html>';
}

// نافذة مدير الخلاطة (وأمن الجراج بعدين)
const STMT_MGR_JS_ = `var D=null;
function view(d){D=d;var b=$('body');b.textContent='';
 if(d.mgr){b.appendChild(h('div',{style:'border:1px solid #dadce0;border-radius:12px;padding:14px'},[h('div',{cls:'mut'},d.title+' الحالي'),h('div',{style:'font-size:21px;font-weight:700;margin:6px 0'},d.mgr.name),h('div',null,'واتساب: '+d.mgr.wa),h('div',null,'الإيميل: '+(d.mgr.email||'—')),h('div',{cls:'mut',style:'margin-top:8px'},'اتعيّن: '+d.mgr.since)]));}
 else b.appendChild(h('div',{cls:'msg er'},d.none));
 var form=h('div',{style:'display:none;flex-direction:column;gap:12px;margin-top:14px'});
 var n=h('input',{cls:'fld',placeholder:'الاسم'}),w=h('input',{cls:'fld',placeholder:'01xxxxxxxxx (أو بكود الدولة)',style:'direction:ltr;text-align:right'}),m=h('input',{cls:'fld',placeholder:'الإيميل (Gmail) — اختياري',style:'direction:ltr;text-align:right'});
 var out=h('div',{cls:'msg',style:'display:none'}),go=h('button',{cls:'btn w',type:'button'},'حفظ'),cx=h('button',{cls:'btn o w',type:'button'},'إلغاء');
 [['الاسم',n],['رقم الواتساب',w],['الإيميل (لو هتبعتله بالإيميل)',m]].forEach(function(p){form.appendChild(h('div',null,[h('label',null,p[0]),p[1]]));});
 form.appendChild(go);form.appendChild(cx);form.appendChild(out);
 var open=h('button',{cls:'btn w',type:'button',style:'margin-top:14px'},d.mgr?d.change:d.add);
 open.addEventListener('click',function(){form.style.display='flex';open.style.display='none';n.focus();});
 cx.addEventListener('click',function(){form.style.display='none';open.style.display='block';msg(out,'',true);});
 go.addEventListener('click',function(){go.disabled=true;msg(out,'',true);
  google.script.run.withSuccessHandler(function(r){view(r);}).withFailureHandler(function(e){go.disabled=false;msg(out,errText(e),false);}).stmtMgrSave(KIND,{name:n.value,wa:w.value,email:m.value});});
 b.appendChild(open);b.appendChild(form);}
view(INIT);
`;
function stmtManagerHtml_(kind) {
  const body = '<div style="padding:14px"><div id="body"></div></div>';
  const js = 'var KIND=' + issJsonForHtml_(kind) + ';' + issInitJs_(stmtMgrInfo(kind)) + issCommonJs_() + STMT_MGR_JS_;
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base target="_top"><style>' + ISS_CSS_ + 'body{background:#fff}</style></head><body>' + body + '<script>' + js + '</script></body></html>';
}

// صفحة التحكم: طلب بيان جديد + قايمة الطلبات (بتتحط قبل ISS_CONTROL_JS_ في issControlHtml_)
const STMT_CONTROL_JS_ = `var SV={kind:'mixer',via:'wa'},SF=null,MGRL={mixer:'مدير الخلاطة',garage:'قسم الأمن والعمليات'},MGRN={mixer:'مفيش مدير خلاطة معين.',garage:'مفيش مسؤول معين لقسم الأمن والعمليات.'};
function stmtMgrNow(){var s=(DATA&&DATA.stmt)||{};return (s.managers||{})[SV.kind]||null;}
function drawStmt(){drawStmtForm();drawStmtList();}
function drawStmtForm(){
 if(!SF){SF={};var f=$('sform');
  SF.kind=seg([['mixer','بيان خلاطة','g'],['garage','بيان جراج','g']],function(){return SV.kind;},function(v){SV.kind=v;drawStmtForm();});
  SF.mgr=h('div',{cls:'msg'});
  SF.from=h('input',{cls:'fld',type:'date'});SF.to=h('input',{cls:'fld',type:'date'});
  SF.via=seg([['wa','واتساب','wa'],['email','إيميل (Gmail)'],['','بدون إرسال']],function(){return SV.via;},function(v){SV.via=v;drawStmtForm();});
  SF.go=h('button',{cls:'btn w'},'إنشاء الطلب وإرساله');SF.out=h('div',{cls:'msg',style:'display:none'});
  SF.go.addEventListener('click',function(){var w=null;if(SV.via==='wa'){try{w=window.open('about:blank','_blank');}catch(e){w=null;}}
   SF.go.disabled=true;msg(SF.out,'',true);
   google.script.run.withSuccessHandler(function(r){SF.go.disabled=false;SF.from.value='';SF.to.value='';$('scard').style.display='none';setData(r.payload);finishWa(w,r,'اتعمل طلب البيان رقم '+r.id+'.');})
    .withFailureHandler(function(e){SF.go.disabled=false;if(w)try{w.close();}catch(x){}msg(SF.out,errText(e),false);})
    .stmtAdminCreate(KEY,{kind:SV.kind,from:SF.from.value,to:SF.to.value,via:SV.via});});
  [['نوع البيان',SF.kind],['المسؤول عن البيان',SF.mgr],['من تاريخ',SF.from],['إلى تاريخ',SF.to],['طريقة الإرسال',SF.via]].forEach(function(p){f.appendChild(h('div',null,[h('label',null,p[0]),p[1]]));});
  f.appendChild(SF.go);f.appendChild(SF.out);}
 var m=stmtMgrNow();
 SF.mgr.className='msg '+(m?'ok':'er');
 SF.mgr.textContent=m?(MGRL[SV.kind]+': '+m.name+(SV.via==='wa'&&!m.wa?' — (مفيش رقم واتساب صحيح محفوظ)':'')+(SV.via==='email'&&!m.email?' — (مفيش إيميل محفوظ)':'')):MGRN[SV.kind]+' عيّنه من قائمة الشيت: خلاطة / جراج ← '+MGRL[SV.kind]+'.';}
function drawStmtList(){var L=$('sreqs');if(!L)return;L.textContent='';var rs=(DATA&&DATA.stmt&&DATA.stmt.requests)||[];
 if(!rs.length){L.style.display='none';return;}L.style.display='block';
 L.appendChild(h('h2',{style:'margin:0 0 12px;font-size:19px'},'طلبات البيانات'));
 rs.forEach(function(q){var cls=q.status==='مكتمل'?'c-grn':(q.status==='ملغي'?'c-gry':'c-amb'),pct=q.total?Math.round(q.done*100/q.total):0,acts=[];
  var bar=h('div',{style:'background:#e8eaed;border-radius:999px;height:10px;overflow:hidden;margin:8px 0 4px'},[h('div',{style:'height:100%;width:'+pct+'%;background:#1e8e3e'})]);
  if(q.status==='مفتوح'){
   var rb=h('button',{cls:'btn wa',style:'min-height:38px'},'تذكير واتساب');
   rb.addEventListener('click',function(){var w=null;try{w=window.open('about:blank','_blank');}catch(e){w=null;}
    google.script.run.withSuccessHandler(function(r){if(openWa(w,r.wa))note('اتفتح واتساب.',true);else note('',true,r.wa);}).withFailureHandler(function(e){if(w)try{w.close();}catch(x){}note(errText(e),false);}).stmtAdminRemind(KEY,q.id);});
   var cb=h('button',{cls:'btn o',style:'min-height:38px'},'إلغاء الطلب');
   cb.addEventListener('click',function(){if(!confirm('تلغي الطلب ده؟ الرابط هيقف يشتغل.'))return;cb.disabled=true;google.script.run.withSuccessHandler(setData).withFailureHandler(function(e){cb.disabled=false;note(errText(e),false);}).stmtAdminCancel(KEY,q.id);});
   acts.push(rb,cb);}
  L.appendChild(h('div',{style:'border:1px solid #e8eaed;border-radius:12px;padding:14px;margin-bottom:10px'},[
   h('div',{style:'display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center'},[h('div',null,[h('b',{style:'font-size:16px'},q.label+' — من '+q.from+' إلى '+q.to),' ',h('span',{cls:'chip '+cls},q.status)]),h('div',{style:'display:flex;gap:8px'},acts)]),
   h('div',{cls:'mut',style:'margin-top:4px'},'المسؤول: '+q.mgr+' · اتطلب '+q.at+' · رقم '+q.id),bar,h('div',{cls:'mut'},'اتسجل '+q.done+' من '+q.total+' (يوم × سيارة) — '+pct+'%')]));});}
$('sBtn').addEventListener('click',function(){var c=$('scard');c.style.display=c.style.display==='none'?'block':'none';if(c.style.display==='block')c.scrollIntoView({behavior:'smooth'});});
`;
