/* ════════════════════════════════════════════════════════════════════════
   ✏️ تطبيق تعديلاتي على تقرير السيارة
   إنت بتعدّل في شيت "تقرير 120" (نقلات، أوقات، مسافات، مسح صفوف، تواريخ، ملاحظات…) وبعدين تدوس الزرار:
     1) بيقرا الشيت زي ما هو دلوقتي (بتعديلاتك)
     2) بيعيد حساب "ملخص يومي" و"الدورات" (وبيشيل من "سجل الزيارات" زيارات الدورات اللي اتمسحت)
     3) بيعيد تنسيق شيت التقرير نفسه لنفس الشكل الأصلي (حدود، دمج، خطوط، صيغة الوقت والتاريخ والمدة)
     4) بيحفظ تعديلاتك في شيت مخفي "Manual Edits Store" — وأي سحب جديد لنفس السيارة بيطبّقها تلقائي (مش لازم تعيدها)
   قبل أي حاجة بيحفظ نسخة من الشيت بتعديلاتك في تبويب "نسخة قبل التعديل <رقم>".
   مفيش أي كتابة أو تلوين بيظهر إن اليوم ده اتعدّل — التقرير بيفضل بشكل واحد.
   عمود "ملاحظات" في التقرير بيتنقل لعمود "ملاحظات" في "ملخص يومي". أما عمودين "بيان الخلاطة" و"بيان الجراج" في الملخص فبيتملوا من شيتات البيان المخفية (Statements.gs) بس، ومش بيتقروا ولا بيتحفظوا هنا.
   ملحوظة: "سجل الزيارات" و"تنبيهات" جاية من تحليل نقاط GPS الأصلية فمش بتتغير بتعديل يدوي (غير حذف زيارات دورة اتمسحت).
   ════════════════════════════════════════════════════════════════════════ */

const EDITS = { BACKUP_PREFIX: 'نسخة قبل التعديل ', INTERNAL_BG: '#fff2cc', FIXED_FONT: '#cc0000', STORE_SHEET: 'Manual Edits Store' };

/* ───────────── نقطة الدخول من القائمة ───────────── */
function applyManualEdits() {
  if (typeof errandIsActive_ === 'function' && errandIsActive_()) { errandApplyEdits(); return; }   // لو واقف على شيت "مشاوير ..." (Errand_Report.gs)
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi(), cfg = GPS_CONFIG;
  const names = ss.getSheets().map(function (s) { return s.getName(); }).filter(function (n) { return n.indexOf(cfg.REPORT_PREFIX) === 0; });
  let main = ss.getActiveSheet().getName();
  if (main.indexOf(cfg.REPORT_PREFIX) !== 0) {
    if (names.length === 1) main = names[0];
    else if (!names.length) { ui.alert('مفيش شيت تقرير سيارة (اسمه بيبدأ بـ "' + cfg.REPORT_PREFIX + '"). اعمل تقرير الأول.'); return; }
    else {
      const r = ui.prompt('تطبيق التعديلات', 'اكتب رقم السيارة اللي عدّلت تقريرها (' + names.map(function (n) { return n.slice(cfg.REPORT_PREFIX.length); }).join(' / ') + '):', ui.ButtonSet.OK_CANCEL);
      if (r.getSelectedButton() !== ui.Button.OK) return;
      main = cfg.REPORT_PREFIX + safeVeh_(r.getResponseText());
      if (names.indexOf(main) < 0) { ui.alert('مفيش شيت "' + main + '".'); return; }
    }
  }
  const vehicle = main.slice(cfg.REPORT_PREFIX.length);
  const ok = ui.alert('تطبيق تعديلاتي — ' + vehicle,
    'هيقرا شيت "' + main + '" بتعديلاتك ويعيد حساب "ملخص يومي" و"الدورات"، وبعدين يعيد تنسيق الشيت لشكله الأصلي.\n' +
    'هتتحفظ نسخة من شيتك الحالي في تبويب "' + EDITS.BACKUP_PREFIX + vehicle + '".\n' +
    'وتعديلاتك هتتحفظ وتتطبق تلقائي على أي سحب جديد لنفس السيارة.\n\nمتابعة؟', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) { ui.alert('فيه تشغيل تاني شغال دلوقتي. جرّب بعد شوية.'); return; }
  let res;
  try { res = editsApply_(ss, vehicle, cfg); }
  catch (e) { lock.releaseLock(); ui.alert('ما اتطبقتش التعديلات', String(e && e.message ? e.message : e) + '\n\nلو شيت التقرير اتغيّر، نسختك قبل التطبيق محفوظة في تبويب "' + EDITS.BACKUP_PREFIX + vehicle + '".', ui.ButtonSet.OK); return; }
  lock.releaseLock();
  ui.alert('تم تطبيق التعديلات ✔',
    'السيارة ' + vehicle + '\nالنقلات: ' + res.before.nakla + ' ← ' + res.after.nakla + '\nالمسافة: ' + res.before.km + ' ← ' + res.after.km + ' km\nأيام/بلوكات: ' + res.days + ' • صفوف: ' + res.rows + '\n' +
    (res.warnings.length ? '\nتنبيهات (' + res.warnings.length + '):\n- ' + res.warnings.slice(0, 12).join('\n- ') + (res.warnings.length > 12 ? '\n…' : '') : '\nمفيش تنبيهات.'), ui.ButtonSet.OK);
}

// زرار القائمة: مسح التعديلات المحفوظة (بيمنع تطبيقها تلقائي على السحب الجاي). شيتات التقارير الحالية مش بتتغير
function clearSavedEdits() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  const sh = editsStoreSheet_(ss, false);
  if (!sh || sh.getLastRow() < 2) { ui.alert('مفيش تعديلات محفوظة.'); return; }
  const rows = editsStoreRows_(sh);
  const vs = {}; rows.forEach(function (r) { vs[r.v] = (vs[r.v] || 0) + 1; });
  const list = Object.keys(vs).map(function (k) { return k + ' (' + vs[k] + ')'; }).join(' / ');
  const r = ui.prompt('مسح تعديلاتي المحفوظة', 'محفوظ: ' + list + '\nاكتب رقم السيارة اللي تمسح تعديلاتها المحفوظة، أو اكتب * لكل العربيات.\nشيتات التقارير الحالية مش هتتغير — بس التقرير الجاي هيتولّد من غير تعديلاتك.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const t = String(r.getResponseText() || '').trim();
  if (!t) return;
  const all = t === '*', v = safeVeh_(t);
  const keep = rows.filter(function (x) { return !(all || x.v === v); });
  const n = rows.length - keep.length;
  if (!n) { ui.alert('مفيش تعديلات محفوظة للسيارة "' + t + '".'); return; }
  editsStoreWrite_(sh, keep);
  ss.toast('اتمسح ' + n + ' تعديل محفوظ.', 'التعديلات', 6);
}

/* ───────────── التنفيذ ───────────── */
function editsApply_(ss, vehicle, cfg) {
  const tz = ss.getSpreadsheetTimeZone();
  const sh = ss.getSheetByName(cfg.REPORT_PREFIX + vehicle);
  const nR = sh.getLastRow();
  if (nR < 2) throw new Error('الشيت فاضي.');
  const nc = Math.min(10, sh.getMaxColumns());
  const vals = sh.getRange(1, 1, nR, nc).getValues().map(function (r) { while (r.length < 10) r.push(''); return r; });
  const bgA = sh.getRange(1, 1, nR, 1).getBackgrounds().map(function (r) { return String(r[0]).toLowerCase(); });
  const fcE = sh.getRange(1, 5, nR, 1).getFontColors().map(function (r) { return String(r[0]).toLowerCase(); });
  const sumSh = ss.getSheetByName(cfg.SUMMARY_SHEET + ' ' + vehicle), cycSh = ss.getSheetByName(cfg.CYCLES_SHEET + ' ' + vehicle), visSh = ss.getSheetByName(cfg.VISITS_SHEET + ' ' + vehicle);
  const oldSum = editsReadSummary_(sumSh);
  const oldCyc = cycSh && cycSh.getLastRow() >= 2 ? cycSh.getRange(2, 1, cycSh.getLastRow() - 1, 9).getValues() : [];
  const parsed = editsParseMain_(vals, bgA, fcE, tz);
  const built = editsBuildDays_(parsed.blocks, oldSum, tz);
  const warnings = parsed.warnings.concat(built.warnings);
  if (!built.days.length) throw new Error('ماقدرتش ألاقي أي صف بيانات صالح (لازم Start و End مفهومين).');
  const cyc = editsBuildCycles_(built.days, oldCyc, tz);
  warnings.push.apply(warnings, cyc.warnings);
  const rep = { vehicle: vehicle, days: built.days, rawCycleRows: cyc.rows, cycles: [], idles: [], visits: [], alerts: [] };
  rep.totalNakla = built.days.reduce(function (s, d) { return s + d.nakla; }, 0);
  rep.totalKm = built.days.reduce(function (s, d) { return s + d.km; }, 0);
  if (cyc.naklaSum !== rep.totalNakla) warnings.push('مجموع النقلات في الدورات (' + cyc.naklaSum + ') غير مجموع النقلات في الأيام (' + rep.totalNakla + '). اعتمدت أرقام الأيام (اللي كتبتها إنت) ومراجعة "الدورات" مطلوبة.');
  // نسخة احتياطية من شيت التقرير بتعديلاتك
  const bn = EDITS.BACKUP_PREFIX + vehicle;
  const old = ss.getSheetByName(bn); if (old) ss.deleteSheet(old);
  const bk = sh.copyTo(ss); bk.setName(bn);
  const before = { nakla: 0, km: 0 };
  oldSum.forEach(function (o) { if (o.total) { before.nakla = Number(o.nakla) || 0; before.km = Number(o.km) || 0; } });
  // إعادة الكتابة بنفس دوال التقرير الأصلية (نفس التنسيق)
  writeMainSheet_(ss, rep, cfg);
  writeSummary_(ss, rep, cfg);
  writeCycles_(ss, rep, cfg);
  if (visSh && visSh.getLastRow() >= 2) editsFilterVisits_(visSh, cyc.aliveIds);
  // حفظ التعديلات عشان تتطبق تلقائي على أي سحب جديد
  try { const sv = editsStoreSave_(ss, vehicle, built.days, parsed.origSigs); warnings.push.apply(warnings, sv.warnings); }
  catch (e) { warnings.push('تعذّر حفظ تعديلاتك للتطبيق التلقائي على السحب الجديد: ' + String(e && e.message ? e.message : e)); }
  ss.setActiveSheet(ss.getSheetByName(cfg.REPORT_PREFIX + vehicle));
  return { before: before, after: { nakla: rep.totalNakla, km: Math.round(rep.totalKm * 10) / 10 }, days: built.days.length, rows: built.days.reduce(function (s, d) { return s + d.rows.length; }, 0), warnings: warnings };
}

/* ───────────── قراءة ملخص يومي (الشكل الجديد 11 عمود أو القديم 8 أعمدة) ───────────── */
function editsReadSummary_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const nc = Math.min(12, sh.getMaxColumns());
  const head = sh.getRange(1, 1, 1, nc).getValues()[0];
  const isNew = /بيان الخلاطة/.test(String(head[4] || ''));
  const hasSt = isNew && /الحالة/.test(String(head[9] || ''));   // الشكل الجديد (12 عمود): عمود 10 = الحالة، 11 = ملاحظات، 12 = ملاحظات المنظومة
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues();
  return v.map(function (r) {
    while (r.length < 12) r.push('');
    const o = isNew
      ? (hasSt
        ? { cid: r[0], date: r[1], nakla: r[2], text: r[3], mixer: r[4], garage: r[5], rows: r[6], internal: r[7], km: r[8], notes: r[10], sys: nc >= 12 ? r[11] : r[10] }
        : { cid: r[0], date: r[1], nakla: r[2], text: r[3], mixer: r[4], garage: r[5], rows: r[6], internal: r[7], km: r[8], notes: r[9], sys: nc >= 11 ? r[10] : r[9] })
      : { cid: r[0], date: r[1], nakla: r[2], text: r[3], mixer: '', garage: '', rows: r[4], internal: r[5], km: r[6], notes: r[7], sys: r[7] };
    o.mixer = ''; o.garage = '';   // بيان الخلاطة/الجراج من شيتات البيان بس، مش من التعديلات اليدوية
    o.total = String(r[1]) === 'الإجمالي';
    return o;
  });
}
// ملاحظات المنظومة (متقسمة بـ " | ") — بنشيل منها نصوص "اتعدّل يدويًا" القديمة
// ملاحظات الصيانة اللي بتتولّد من شيتات البيان (Statements.gs): بتتضاف من الشيت كل مرة، فمايتحفظوش ولا يتقروا تاني من الملخص القديم
function editsIsStmtNote_(x) { return /^(صيانة|بدون نقلات) \((خلاطة|جراج)\):/.test(String(x || '').trim()); }
function editsSplitNotes_(t) {
  return String(t === null || t === undefined ? '' : t).split(' | ').map(editsText_).map(function (x) { return x.replace(/\s*\(مفيش سواق متعيّن أو عطل كبير؟\)\s*$/, ''); }).filter(function (x) { return x && !/(اتعدّل|اتعدل) يدويً?ا|بلوك مضاف\/متغيّر يدويً?ا|رحلة طولها اتصحح أو محتاج مراجعة/.test(x) && !editsIsStmtNote_(x); });
}

/* ───────────── قراءة شيت التقرير بعد تعديلاتك ───────────── */
function editsDigits_(s) { return String(s).replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 1632); }).replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 1776); }); }
function editsTime_(v, tz) {
  if (v === '' || v === null || v === undefined) return NaN;
  if (typeof v !== 'string') return wallSeconds_(v, tz);
  const s = editsDigits_(v).replace(/[‎‏]/g, '').trim();
  let t = parseWallString_(s);
  if (!isNaN(t)) return t;
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|ص|م)?/i.exec(s);
  if (m) {
    let h = +m[4];
    const ap = m[7] ? (/^(PM|م)$/i.test(m[7]) ? 'PM' : 'AM') : '';
    if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
    return Date.UTC(+m[3], +m[2] - 1, +m[1], h, +m[5], m[6] ? +m[6] : 0) / 1000;
  }
  const m2 = /(\d{4})-(\d{1,2})-(\d{1,2})[ T]+(\d{1,2}):(\d{2})/.exec(s);
  if (m2) return Date.UTC(+m2[1], +m2[2] - 1, +m2[3], +m2[4], +m2[5], 0) / 1000;
  return NaN;
}
function editsNum_(v) { if (typeof v === 'number') return v; const n = parseFloat(editsDigits_(v).replace(',', '.').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? NaN : n; }
function editsText_(v) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim(); }
function editsIsBlankRow_(r) { return r.every(function (x) { return x === '' || x === null || x === undefined || String(x).trim() === ''; }); }

// عدد النقلات من نص عمود gps ("نقلتين" / "3 نقلات" / "نقلة + رحلة صيانة" / رقم). غير كده 0
function editsNakla_(v) {
  if (typeof v === 'number') return Math.max(0, Math.round(v));
  const s = normAr_(editsDigits_(editsText_(v)));
  if (!s) return 0;
  let m = /(\d+)\s*نقل/.exec(s); if (m) return +m[1];
  if (/نقلتين|نقلتان/.test(s)) return 2;
  if (/(^|[^ء-ي])نقله([^ء-ي]|$)/.test(s)) return 1;
  if (/^\d+$/.test(s)) return +s;
  return 0;
}
function editsDayText_(raw, n) {   // النص البسيط ("2"/"نقلتان"/"٢ نقلة") بيتوحّد زي الأصل، والنص المركب بيفضل زي ما كتبته
  const s = editsText_(raw);
  if (n > 0 && (/^\d+$/.test(editsDigits_(s)) || /^(نقلة|نقلتين|نقلتان|\d+\s*نقلات?|\d+\s*نقله)$/.test(s))) return countText_(n);
  return s;
}

/* ───────────── التوقيع الداخلي: بصمة الشكل الأصلي المتولّد لكل بلوك (عمود J المخفي) ─────────────
   بنقارن بيه البلوك الحالي: لو اختلف = اتعدّل (بيتحفظ)، لو متطابق = متولّد زي ما هو (مش بيتحفظ، فأي تحسين في الكود بيتطبق عليه). */
function editsHash_(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function editsContent_(rows, text, dateKey) {
  const rs = rows.slice().sort(function (a, b) { return (a.s - b.s) || (a.e - b.e) || (String(a.cid) < String(b.cid) ? -1 : String(a.cid) > String(b.cid) ? 1 : 0) || (editsText_(a.label) < editsText_(b.label) ? -1 : 1); });
  return dateKey + '§' + editsText_(text) + '§' + rs.map(function (r) { return [String(r.cid), r.s, r.e, Math.round(r.km * 10), editsText_(r.label)].join('~'); }).join('¦');
}
function editsSigFrom_(rows, text, dateKey) {
  if (!rows || !rows.length) return '';
  let s = Infinity, e = -Infinity;
  rows.forEach(function (r) { if (r.s < s) s = r.s; if (r.e > e) e = r.e; });
  return editsHash_(editsContent_(rows, text, dateKey)) + '|' + s + '|' + e;
}
function editsSigOfDay_(d) { return editsSigFrom_(d.rows, d.text, d.dateKey); }
function editsParseSig_(v) {
  const m = /^([0-9a-z]+)\|(-?\d+)\|(-?\d+)$/.exec(editsText_(v));
  return m ? { h: m[1], s: +m[2], e: +m[3], str: m[0] } : null;
}

function editsParseMain_(vals, bgA, fcE, tz) {
  const warnings = [], blocks = [], origSigs = [];
  // الشكل القديم: H = بيان الخلاطة و I = التاريخ. الشكل الجديد: H = التاريخ و I = ملاحظات و J = توقيع
  const legacy = /بيان/.test(String(vals[0][7] || ''));
  const dI = legacy ? 8 : 7, nI = legacy ? -1 : 8, sI = legacy ? -1 : 9;
  let cur = null, sepSeen = true, prevLabel = '', prevCid = '';
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i], rowNo = i + 1;
    if (editsIsBlankRow_(r)) { sepSeen = true; continue; }
    if (sI >= 0) { const sg0 = editsParseSig_(r[sI]); if (sg0 && origSigs.indexOf(sg0.str) < 0) origSigs.push(sg0.str); }
    const s = editsTime_(r[1], tz), e = editsTime_(r[2], tz);
    if (isNaN(s) || isNaN(e)) {
      warnings.push('صف ' + rowNo + ': Start/End مش مفهومين، الصف اتجاهل.');
      continue;
    }
    const gRaw = r[6], iRaw = r[dI];
    const cidNow = editsText_(r[0]);
    // بلوك جديد: لو فيه تاريخ/عدد نقلات، أو بعد صف فاضي ورقم الدورة اتغيّر (مسحت صف في نص يوم = نفس البلوك)
    const startsNew = !cur || editsText_(gRaw) !== '' || editsText_(iRaw) !== '' || (iRaw instanceof Date) || (sepSeen && cidNow !== '' && cidNow !== String(prevCid));
    if (startsNew) { cur = { rows: [], gRaw: gRaw, dateRaw: iRaw, firstRow: rowNo, notes: [], sig: '' }; blocks.push(cur); prevLabel = ''; prevCid = ''; }
    sepSeen = false;
    if (nI >= 0) { const nt = editsText_(r[nI]); if (nt && cur.notes.indexOf(nt) < 0) cur.notes.push(nt); }
    if (sI >= 0 && !cur.sig) { const sg = editsParseSig_(r[sI]); if (sg) cur.sig = sg.str; }
    if (e < s) warnings.push('صف ' + rowNo + ': النهاية قبل البداية.');
    const label = editsText_(r[5]) || prevLabel, cid = editsText_(r[0]) || prevCid;
    prevLabel = label; prevCid = cid;
    let km = editsNum_(r[4]);
    if (isNaN(km)) { km = 0; warnings.push('صف ' + rowNo + ': المسافة مش رقم، اتحسبت 0.'); }
    cur.rows.push({ cid: cid === '' ? '' : (isNaN(Number(cid)) ? cid : Number(cid)), s: s, e: e, km: km, label: label,
      internal: bgA[i] === EDITS.INTERNAL_BG, kmFixed: fcE[i] === EDITS.FIXED_FONT, rowNo: rowNo });
  }
  return { blocks: blocks, warnings: warnings, origSigs: origSigs };
}

// تاريخ اليوم (من عمود التاريخ) — شكل الأصل شهر/يوم (10/5). لو اتكتب بشكل تاني بنختار الأقرب لأول صف في البلوك
function editsDayKey_(raw, firstS, tz) {
  const ref = Math.floor(firstS / 86400), refY = new Date(firstS * 1000).getUTCFullYear();
  let cands = [];
  if (Object.prototype.toString.call(raw) === '[object Date]') {
    const k = Utilities.formatDate(raw, tz, 'yyyy-MM-dd').split('-').map(Number);
    cands.push([k[0], k[1], k[2]], [k[0], k[2], k[1]]);
  } else {
    const s = editsDigits_(editsText_(raw));
    let m = /^(\d{1,2})\/(\d{1,2})$/.exec(s);
    if (m) { cands.push([refY, +m[1], +m[2]], [refY, +m[2], +m[1]]); }
    else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) { cands.push([+m[3], +m[2], +m[1]], [+m[3], +m[1], +m[2]]); }
    else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) { cands.push([+m[1], +m[2], +m[3]]); }
  }
  let best = null, bd = 1e9;
  cands.forEach(function (c) {
    if (c[1] < 1 || c[1] > 12 || c[2] < 1 || c[2] > 31) return;
    [0, -1, 1].forEach(function (dy) {
      const t = Date.UTC(c[0] + dy, c[1] - 1, c[2]) / 86400000, d = Math.abs(t - ref);
      if (d < bd) { bd = d; best = Date.UTC(c[0] + dy, c[1] - 1, c[2]) / 1000; }
    });
  });
  if (best === null || bd > 40) return null;
  return ymd_(best);
}

function editsBuildDays_(blocks, oldSum, tz) {
  const warnings = [], days = [];
  const oldBy = {};
  oldSum.forEach(function (o) { if (!o.total) oldBy[String(o.cid)] = o; });
  blocks.forEach(function (b) {
    if (!b.rows.length) return;
    b.rows.sort(function (x, y) { return x.s - y.s; });
    const ids = []; b.rows.forEach(function (x) { const k = String(x.cid); if (k !== '' && ids.indexOf(k) < 0) ids.push(k); });
    const cycleIds = ids.join(' / ');
    const old = oldBy[cycleIds];
    let dayKey = editsDayKey_(b.dateRaw, b.rows[0].s, tz), text, nakla;
    if (!dayKey) {
      if (old) { const p = String(old.date).split('/'); if (p.length === 3) dayKey = p[2] + '-' + p2_(+p[1]) + '-' + p2_(+p[0]); }
      if (!dayKey) dayKey = ymd_(b.rows[0].s);
      warnings.push('بلوك صف ' + b.firstRow + ': التاريخ مش مكتوب أو مش مفهوم، اتحدد ' + dayLabelFull_(dayKey) + '.');
    }
    if (editsText_(b.gRaw) === '' && typeof b.gRaw !== 'number') {
      if (old) { text = editsText_(old.text); nakla = Number(old.nakla) || 0; warnings.push('بلوك صف ' + b.firstRow + ': خانة gps (عدد النقلات) فاضية، اخدت القيمة القديمة (' + (text || nakla) + ').'); }
      else { text = ''; nakla = 0; warnings.push('بلوك صف ' + b.firstRow + ': خانة gps (عدد النقلات) فاضية فاتحسب 0 نقلة.'); }
    } else { nakla = editsNakla_(b.gRaw); text = editsDayText_(b.gRaw, nakla); }
    const km = b.rows.reduce(function (s, x) { return s + x.km; }, 0);
    const internal = b.rows.filter(function (x) { return x.internal; }).length;
    // ملاحظات المنظومة بس (من غير ملاحظاتك) — ملاحظاتك بتتضاف عليها في كتابة الملخص
    const notes = old ? editsSplitNotes_(old.sys) : [];
    const str = function (v) { return v === null || v === undefined ? '' : String(v).trim(); };
    days.push({ key: dayKey + '#' + days.length, dateKey: dayKey, rows: b.rows, text: text, nakla: nakla, cycleIds: cycleIds, km: km, internalCount: internal, notes: notes,
      kmFixedCount: b.rows.filter(function (x) { return x.kmFixed; }).length,
      userNote: b.notes.join(' / '), sig: b.sig || '' });
  });
  days.sort(function (a, b) { return a.rows[0].s - b.rows[0].s; });
  return { days: days, warnings: warnings };
}

/* ───────────── إعادة حساب شيت الدورات ───────────── */
function editsBuildCycles_(days, oldCyc, tz) {
  const warnings = [], aliveIds = {};
  const byId = {};   // id ← {rows, dateKeys[]}
  days.forEach(function (d) { d.rows.forEach(function (x) {
    const k = String(x.cid); if (k === '') return;
    const o = byId[k] || (byId[k] = { rows: [], dates: [] });
    o.rows.push(x); if (o.dates.indexOf(d.dateKey) < 0) o.dates.push(d.dateKey);
  }); });
  const parseOldDate = function (v) {
    if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    const p = editsDigits_(String(v)).split('/'); return p.length === 3 ? p[2] + '-' + p2_(+p[1]) + '-' + p2_(+p[0]) : null;
  };
  const items = [];   // دورات عادية قابلة لإعادة التوزيع
  const out = [];
  oldCyc.forEach(function (r) {
    const id = String(r[0]); if (id === '') return;
    const g = byId[id];
    if (!g) { warnings.push('الدورة ' + id + ' اتشالت من "الدورات" لأن مفيش ليها صفوف في التقرير.'); return; }
    aliveIds[id] = 1;
    const typeTxt = String(r[6]), idle = /^وقوف/.test(typeTxt);
    const startOld = editsTime_(r[2], tz), endOld = editsTime_(r[3], tz);
    const open = /لسه/.test(String(r[3]));
    if (idle) { out.push({ t: isNaN(startOld) ? g.rows[0].s : startOld, row: r.slice(0, 7), id: id }); return; }   // الوقوف الطويل: بيفضل زي ما هو
    const first = Math.min.apply(null, g.rows.map(function (x) { return x.s; })), last = Math.max.apply(null, g.rows.map(function (x) { return x.e; }));
    let dk = parseOldDate(r[1]);
    if (!dk || g.dates.indexOf(dk) < 0) dk = g.dates[g.dates.length - 1];
    // أوقات الدورة (خروج/رجوع الخلاطة) بتتحرك بنفس فرق أول/آخر صف اتعدّل في التقرير. لو الشيت قديم ومفيهوش الأعمدة المخفية بنسيب الأوقات زي ما هي
    const af = Number(r[7]), al = Number(r[8]), hasA = r[7] !== '' && r[8] !== '' && !isNaN(af) && !isNaN(al);
    let sT = isNaN(startOld) ? first : startOld, eT = open ? null : (isNaN(endOld) ? last : endOld);
    if (hasA) { sT += first - af; if (eT !== null) eT += last - al; }
    const it = { id: id, dk: dk, startT: sT, endT: eT, path: String(r[4]), count: Number(r[5]) || 0, typeTxt: typeTxt, open: open, oldCount: Number(r[5]) || 0, anchors: [first, last] };
    items.push(it); out.push({ t: sT, it: it, id: id });
  });
  // توزيع عدد النقلات (اللي كتبته في خانة gps لكل يوم) على دورات اليوم
  const dayN = {}, dayHas = {};
  days.forEach(function (d) { dayN[d.dateKey] = (dayN[d.dateKey] || 0) + d.nakla; dayHas[d.dateKey] = 1; });
  const groups = {};
  items.forEach(function (it) { (groups[it.dk] = groups[it.dk] || []).push(it); });
  Object.keys(groups).forEach(function (dk) {
    if (!dayHas[dk]) return;
    const g = groups[dk].sort(function (a, b) { return Number(a.id) - Number(b.id); });
    const sum = g.reduce(function (s, x) { return s + x.count; }, 0);
    let diff = dayN[dk] - sum;
    if (diff > 0) {
      let t = null; for (let i = g.length - 1; i >= 0; i--) if (g[i].count > 0) { t = g[i]; break; }
      if (!t) t = g[g.length - 1];
      t.count += diff;
    } else if (diff < 0) {
      for (let i = g.length - 1; i >= 0 && diff < 0; i--) { const take = Math.min(g[i].count, -diff); g[i].count -= take; diff += take; }
    }
  });
  const kindTxt = { NAKLA: 'نقلة', NONE: 'بدون نقلة مكتملة' };
  let naklaSum = 0;
  const rows = out.map(function (o) {
    if (o.row) return { t: o.t, row: o.row };
    const it = o.it;
    let type = it.typeTxt;
    if (it.count > 0 && it.oldCount === 0) type = kindTxt.NAKLA + (it.open ? ' - جارية' : '');
    else if (it.count === 0 && it.oldCount > 0) type = kindTxt.NONE + (it.open ? ' - جارية' : '');
    naklaSum += it.count;
    return { t: o.t, anchors: it.anchors, row: [Number(it.id), dayLabelFull_(it.dk), fmtDT_(it.startT), it.endT === null ? 'لسه (دورة جارية)' : fmtDT_(it.endT), it.path, it.count, type] };
  });
  return { rows: rows, aliveIds: aliveIds, warnings: warnings, naklaSum: naklaSum };
}

/* ───────────── سجل الزيارات: شيل زيارات الدورات اللي اتمسحت ───────────── */
function editsFilterVisits_(sh, alive) {
  const n = sh.getLastRow(), nc = Math.max(7, sh.getLastColumn());
  const v = sh.getRange(2, 1, n - 1, nc).getValues();
  const keep = v.filter(function (r) {
    const ids = String(r[0]).split(' / ').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
    return !ids.length || ids.some(function (x) { return alive[x]; });
  });
  if (keep.length === v.length) return;
  sh.getRange(2, 1, n - 1, nc).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, nc).setValues(keep);
}

/* ═════════════ مخزن التعديلات (شيت مخفي "Manual Edits Store") ═════════════
   كل صف: السيارة | النوع | التاريخ | التوقيع الأصلي | البيانات (JSON) | آخر حفظ
   B = بلوك اتعدّل (بيحل محل البلوك المتولّد اللي توقيعه الأصلي بيتقاطع معاه في الوقت)
   N = بلوك متولّد زي ما هو لكن عليه ملاحظات / بيان خلاطة / بيان جراج (بتتلصق عليه)
   T = بلوك متولّد انت مسحته بالكامل (بيتشال لو طلع بنفس التوقيع بالظبط) */
function editsStoreSheet_(ss, create) {
  let sh = ss.getSheetByName(EDITS.STORE_SHEET);
  if (!sh && create) {
    let act = null; try { act = ss.getActiveSheet(); } catch (e) {}
    sh = ss.insertSheet(EDITS.STORE_SHEET);
    sh.getRange('A:F').setNumberFormat('@');
    sh.getRange(1, 1, 1, 6).setValues([['السيارة', 'النوع', 'التاريخ', 'التوقيع الأصلي', 'البيانات', 'آخر حفظ']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (act) { try { ss.setActiveSheet(act); } catch (e) {} }
    try { sh.hideSheet(); } catch (e) {}
  }
  return sh;
}
function editsStoreRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().filter(function (r) { return String(r[0]) !== ''; }).map(function (r) {
    return { v: String(r[0]), kind: String(r[1]), dateKey: String(r[2]), sig: String(r[3]), payload: String(r[4]), saved: String(r[5]) };
  });
}
function editsStoreWrite_(sh, rows) {
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 6).clearContent();
  if (!rows.length) return;
  ensureGrid_(sh, rows.length + 2, 6);
  sh.getRange(2, 1, rows.length, 6).setValues(rows.map(function (x) { return [x.v, x.kind, x.dateKey, x.sig, x.payload, x.saved]; }));
}
function editsStoreLoad_(ss, vehicle) {
  const sh = editsStoreSheet_(ss, false), v = safeVeh_(vehicle), out = [];
  editsStoreRows_(sh).forEach(function (r) {
    if (r.v !== v) return;
    let p = null; try { p = JSON.parse(r.payload); } catch (e) { return; }
    out.push({ kind: r.kind, dateKey: r.dateKey, sig: editsParseSig_(r.sig), p: p || {} });
  });
  return out;
}

// بيحفظ تعديلات السيارة الحالية (من الأيام اللي في الشيت) ويرجّع { warnings }
function editsStoreSave_(ss, vehicle, days, origSigs) {
  const v = safeVeh_(vehicle), warnings = [];
  const keys = days.map(function (d) { return d.dateKey; }).sort();
  const from = keys[0], to = keys[keys.length - 1];
  const present = {}, fresh = [];
  const now = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm');
  days.forEach(function (d) {
    const sg = editsParseSig_(d.sig);
    if (sg) present[sg.str] = 1;
    const edited = !sg || sg.h !== editsSigOfDay_(d).split('|')[0];
    const hasNotes = !!d.userNote;
    if (edited) {
      const p = { rows: d.rows.map(function (x) { return [x.cid, x.s, x.e, x.km, x.label, x.internal ? 1 : 0, x.kmFixed ? 1 : 0]; }), text: d.text, nakla: d.nakla, sys: d.notes || [],
        note: d.userNote || '' };
      fresh.push({ v: v, kind: 'B', dateKey: d.dateKey, sig: sg ? sg.str : '', payload: JSON.stringify(p), saved: now });
    } else if (hasNotes) {
      fresh.push({ v: v, kind: 'N', dateKey: d.dateKey, sig: sg.str, payload: JSON.stringify({ note: d.userNote || '' }), saved: now });
    }
  });
  fresh.forEach(function (x) { if (x.payload.length > 45000) { warnings.push('بلوك ' + x.dateKey + ' كبير أوي ومش هيتحفظ.'); x.skip = true; } });
  const tombs = (origSigs || []).filter(function (x) { return !present[x]; });
  const sh = editsStoreSheet_(ss, fresh.length > 0 || tombs.length > 0);
  if (!sh) return { warnings: warnings };
  const all = editsStoreRows_(sh);
  const haveT = {}; all.forEach(function (r) { if (r.v === v && r.kind === 'T') haveT[r.sig] = 1; });
  const keep = all.filter(function (r) { return !(r.v === v && (r.kind === 'B' || r.kind === 'N') && r.dateKey >= from && r.dateKey <= to); });
  fresh.forEach(function (x) { if (!x.skip) keep.push(x); });
  tombs.forEach(function (sg) { if (!haveT[sg]) { haveT[sg] = 1; keep.push({ v: v, kind: 'T', dateKey: ymd_(Number(sg.split('|')[1])), sig: sg, payload: '{}', saved: now }); } });
  editsStoreWrite_(sh, keep);
  return { warnings: warnings };
}

// بيعيّن أرقام الدورات في البلوكات المحفوظة على أرقام الدورات في التقرير الجديد (بالتصويت بتقاطع الوقت)
function editsRemapCids_(rows, cands) {
  const votes = {};
  const isIdle = function (x) { return /^ت/.test(String(x)); };
  rows.forEach(function (r) {
    const k = String(r.cid); if (k === '') return;
    let best = null, bo = 0;
    cands.forEach(function (c) {
      if (isIdle(k) !== isIdle(c.id)) return;
      const o = Math.min(r.e, c.e) - Math.max(r.s, c.s);
      if (o > bo) { bo = o; best = c.id; }
    });
    if (best !== null) { const m = votes[k] || (votes[k] = {}); m[best] = (m[best] || 0) + bo; }
  });
  const map = {};
  Object.keys(votes).forEach(function (k) { let b = null, bv = -1; Object.keys(votes[k]).forEach(function (n) { if (votes[k][n] > bv) { bv = votes[k][n]; b = n; } }); map[k] = b; });
  rows.forEach(function (r) { const k = String(r.cid); if (map[k] !== undefined) r.cid = isNaN(Number(map[k])) ? map[k] : Number(map[k]); });
}

// بتتنادى بعد توليد تقرير جديد (من المنصة أو من الملفات): بتطبّق تعديلاتك المحفوظة على rep. ما بترميش خطأ.
function editsOverlayStored_(ss, rep, vehicle, fromKey, toKey, tz) {
  const res = { applied: 0, warnings: [] };
  try {
    const entries = editsStoreLoad_(ss, vehicle);
    if (!entries.length) return res;
    const inRange = function (k) { return (!fromKey || k >= fromKey) && (!toKey || k <= toKey); };
    // لقطة من الدورات المتولّدة (قبل أي تغيير) لإعادة حساب شيت الدورات
    const anc = cycleAnchors_(rep);
    const oldCyc = generatedCycleItems_(rep).map(function (it) { const a = anc[String(it.row[0])]; return it.row.slice(0, 7).concat(a ? [a.f, a.l] : ['', '']); });
    const cands = rep.cycles.map(function (c) { return { id: c.id, s: c.startT, e: c.endT === null ? Infinity : c.endT }; })
      .concat((rep.idles || []).map(function (x) { return { id: x.id, s: x.s, e: x.e }; }));
    const G = rep.days.map(function (d) {
      let s = Infinity, e = -Infinity; d.rows.forEach(function (x) { if (x.s < s) s = x.s; if (x.e > e) e = x.e; });
      return { d: d, sig: editsSigOfDay_(d), s: s, e: e, gone: false };
    });
    let applied = 0;
    // 1) بلوكات مسحتها
    const tomb = {}; entries.forEach(function (x) { if (x.kind === 'T' && x.sig) tomb[x.sig.str] = 1; });
    G.forEach(function (g) { if (g.sig && tomb[g.sig]) { g.gone = true; applied++; } });
    // 2) بلوكات عدّلتها
    const added = [];
    entries.forEach(function (x) {
      if (x.kind !== 'B') return;
      const hit = x.sig ? G.filter(function (g) { return !g.gone && g.s < x.sig.e && g.e > x.sig.s; }) : [];
      if (!hit.length && !inRange(x.dateKey)) return;
      hit.forEach(function (g) {
        g.gone = true;
        if (x.sig && g.sig.split('|')[0] !== x.sig.h) res.warnings.push('يوم ' + dayLabelFull_(x.dateKey) + ': بيانات GPS الأصلية للبلوك ده اتغيّرت من آخر مرة عدّلت فيها، واتطبّق تعديلك المحفوظ — راجعه.');
      });
      added.push(x); applied++;
    });
    // 3) ملاحظات / بيان خلاطة / بيان جراج على بلوكات متولّدة زي ما هي
    entries.forEach(function (x) {
      if (x.kind !== 'N' || !x.sig) return;
      G.forEach(function (g) {
        if (g.gone || !(g.s < x.sig.e && g.e > x.sig.s)) return;
        if (x.p.note) g.d.userNote = x.p.note;
        applied++;
      });
    });
    if (!applied) return res;
    const newDays = added.map(function (x, i) {
      const p = x.p, rows = (p.rows || []).map(function (r) { return { cid: r[0], s: r[1], e: r[2], km: Number(r[3]) || 0, label: r[4], internal: !!r[5], kmFixed: !!r[6] }; });
      return { key: x.dateKey + '#s' + i, dateKey: x.dateKey, rows: rows, text: p.text || '', nakla: Number(p.nakla) || 0, notes: (p.sys || []).filter(function (x) { return !editsIsStmtNote_(x); }), userNote: p.note || '', sig: x.sig ? x.sig.str : '' };
    }).filter(function (d) { return d.rows.length; });
    const allRows = []; newDays.forEach(function (d) { d.rows.forEach(function (r) { allRows.push(r); }); });
    editsRemapCids_(allRows, cands);
    newDays.forEach(function (d) {
      const ids = []; d.rows.forEach(function (x) { const k = String(x.cid); if (k !== '' && ids.indexOf(k) < 0) ids.push(k); });
      d.cycleIds = ids.join(' / ');
      d.km = d.rows.reduce(function (s, x) { return s + x.km; }, 0);
      d.internalCount = d.rows.filter(function (x) { return x.internal; }).length;
      d.kmFixedCount = d.rows.filter(function (x) { return x.kmFixed; }).length;
    });
    const days = G.filter(function (g) { return !g.gone; }).map(function (g) { return g.d; }).concat(newDays);
    const first = function (d) { return d.rows.length ? d.rows[0].s : (d.cycles && d.cycles[0] ? d.cycles[0].startT : 0); };
    days.sort(function (a, b) { return first(a) - first(b); });
    const cyc = editsBuildCycles_(days, oldCyc, tz);
    // كل حاجة اتحسبت بنجاح: نطبّق على التقرير
    rep.days = days;
    rep.rawCycleRows = cyc.rows;
    rep.totalNakla = days.reduce(function (s, d) { return s + d.nakla; }, 0);
    rep.totalKm = days.reduce(function (s, d) { return s + d.km; }, 0);
    rep.visits = (rep.visits || []).filter(function (v) {
      const ids = String(v.cycleIds === undefined || v.cycleIds === null ? '' : v.cycleIds).split(' / ').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
      return !ids.length || ids.some(function (x) { return cyc.aliveIds[x]; });
    });
    res.applied = applied;
    cyc.warnings.forEach(function (w) { res.warnings.push(w); });
  } catch (e) {
    res.applied = 0; res.warnings.push('تعذّر تطبيق تعديلاتك المحفوظة على التقرير الجديد: ' + String(e && e.message ? e.message : e));
  }
  (res.warnings || []).forEach(function (w) { (rep.alerts = rep.alerts || []).push({ type: 'تنبيه', note: w, cycle: '' }); });
  return res;
}