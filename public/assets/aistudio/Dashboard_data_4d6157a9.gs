/* ════════════════════════════════════════════════════════════════════════
   📊 Dashboard_Data.gs — طبقة بيانات الداشبورد (Looker Studio) — النسخة 2
   بتكتب جداول مسطّحة في ملف Google Sheets منفصل اسمه "GPS Dashboard Data" (مش في ملف الشغل، عشان حد الـ 10 مليون خلية
   وعشان أي تعديل يدوي ما يكسرش اللوحة). Looker بيقرا الجداول دي بس، وما بيحسبش نقلات أبدًا.

   الاستخدام (يدوي في البداية):
     1) Badawy Group ▸ Dashboard Data ▸ ⚙️ إعداد ملف بيانات الداشبورد  (مرة واحدة: بيعمل الملف ويحفظ رقمه)
     2) 📊 تحديث بيانات الداشبورد  — بيحدّث: حالة كل الأجهزة + المشاكل + تحليل عربيات النقل العشر (الشهر الحالي + اللي قبله)
        لو العربيات ما خلصتش في تشغيلة واحدة (حد 6 دقايق لـ Apps Script) شغّله تاني وهيكمل من حيث وقف.
     3) 🔗 فتح ملف البيانات ← وصّل جداوله بـ Looker.

   الجداول: Days / Cycles / Status_Now / Outages / Vehicles / Vehicle_Summary / Issues / Run_Log
   تعديلاتك اليدوية المحفوظة (✏️ تطبيق تعديلاتي) بتتطبّق على الداشبورد كمان (النقلات والكيلومترات) — نفس أرقام التقارير.
   ════════════════════════════════════════════════════════════════════════ */
const DASH = {
  FILE_NAME: 'GPS Dashboard Data',
  PROP_ID: 'DASH_SS_ID',
  STORE: 'dash_store.gz64',
  NAKLA_VEHICLES: ['104', '114', '115', '116', '117', '118', '120', '122', '123', '124'],   // عربيات النقل (بالترتيب اللي بيظهر في صفحة الحالة)
  MONTHS_BACK: 1,          // الشهر الحالي + كام شهر قبله (1 = الحالي والسابق). الأقدم بيتشال تلقائي
  STOP_DAYS: 2,            // عربية من غير نقلات بقالها كام يوم = "محتاجة متابعة"
  RUN_BUDGET_SEC: 150,     // بعد المدة دي من بداية التشغيل ما نبدأش عربية جديدة (الباقي في التشغيلة الجاية)
  ROUND_STALE_H: 6,        // جولة تحديث ناقصة أقدم من كده بتتعتبر قديمة وبنبدأ جولة جديدة
  LOG_KEEP: 100,
  HEAD: {
    Days: ['Date', 'Vehicle', 'Nakla', 'Km', 'MaintTrips', 'GpsLegs', 'Internal', 'IsWorkDay', 'Summary', 'CycleIds', 'Notes', 'UpdatedAt'],
    Cycles: ['Date', 'Vehicle', 'CycleId', 'CycleNo', 'Start', 'End', 'Path', 'Nakla', 'Kind', 'IsOpen', 'Km', 'DurationMin', 'IsLast', 'UpdatedAt'],
    Status_Now: ['Vehicle', 'Device', 'IsTruck', 'TruckOrder', 'Status', 'Group', 'GroupAr', 'SortKey', 'LastSignal', 'SinceMin', 'SinceText', 'Place', 'Location', 'Drops7', 'UpdatedAt'],
    Outages: ['Vehicle', 'Device', 'From', 'To', 'Minutes', 'IsOpen'],
    Vehicles: ['Vehicle', 'Device', 'DeviceNo', 'IsTruck', 'TruckOrder'],
    Vehicle_Summary: ['Vehicle', 'LastNaklaDate', 'DaysSinceNakla', 'NeedsFollowup', 'Place', 'Location', 'LastCycleId', 'LastCycleStart', 'LastCycleKm', 'UpdatedAt'],
    Issues: ['IssueId', 'Vehicle', 'Type', 'Description', 'Owner', 'OwnerType', 'Status', 'StatusKey', 'AddedAt', 'LastReply', 'LastReplyAt', 'DoneAt', 'Visible'],
    Run_Log: ['Time', 'Job', 'Vehicles', 'Seconds', 'Result', 'Error']
  },
  // تنسيق الأعمدة: d = تاريخ، dt = تاريخ ووقت، n1 = رقم بخانة عشرية، n0 = رقم صحيح
  FMT: {
    Days: { 0: 'd', 3: 'n1', 11: 'dt' },
    Cycles: { 0: 'd', 4: 'dt', 5: 'dt', 10: 'n1', 11: 'n0', 13: 'dt' },
    Status_Now: { 8: 'dt', 9: 'n0', 14: 'dt' },
    Outages: { 2: 'dt', 3: 'dt', 4: 'n0' },
    Vehicle_Summary: { 1: 'd', 7: 'dt', 8: 'n1', 9: 'dt' },
    Issues: { 8: 'dt', 10: 'dt', 11: 'dt' },
    Run_Log: { 0: 'dt' }
  }
};

/* ───────────── القايمة ───────────── */
function runDashRefresh() { openJob_('dash'); }

function dashSetup() {
  const ui = SpreadsheetApp.getUi(), p = PropertiesService.getScriptProperties(), cur = p.getProperty(DASH.PROP_ID);
  if (cur) {
    let url = ''; try { url = SpreadsheetApp.openById(cur).getUrl(); } catch (e) {}
    if (url) {
      const r = ui.alert('ملف الداشبورد موجود', 'الملف متوصّل بالفعل:\n' + url + '\n\nتعمل ملف جديد بدل ده؟ (القديم مش هيتمسح، بس الكود هيكتب في الجديد)', ui.ButtonSet.YES_NO);
      if (r !== ui.Button.YES) return;
    }
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const t = ui.prompt('ملف بيانات الداشبورد', 'الصق رابط أو رقم ملف Google Sheets موجود عندك (فاضي، أو اضغط OK من غير كتابة = إنشاء ملف جديد بالاسم "' + DASH.FILE_NAME + '"):', ui.ButtonSet.OK_CANCEL);
  if (t.getSelectedButton() !== ui.Button.OK) return;
  let file, txt = String(t.getResponseText() || '').trim();
  if (txt) {
    const m = /\/d\/([a-zA-Z0-9_-]{20,})/.exec(txt) || /^([a-zA-Z0-9_-]{20,})$/.exec(txt);
    if (!m) { ui.alert('مش فاهم الرابط ده. الصق رابط Google Sheets كامل أو رقم الملف.'); return; }
    try { file = SpreadsheetApp.openById(m[1]); } catch (e) { ui.alert('مش قادر أفتح الملف ده (صلاحيات أو رقم غلط).'); return; }
  } else {
    file = SpreadsheetApp.create(DASH.FILE_NAME);
    try { file.setSpreadsheetTimeZone(ss.getSpreadsheetTimeZone()); } catch (e) {}
  }
  dashEnsureTabs_(file);
  p.setProperty(DASH.PROP_ID, file.getId());
  ui.alert('تم ✔', 'الملف جاهز: ' + file.getUrl() + '\n\nالخطوة الجاية: 📊 تحديث بيانات الداشبورد.\nشارك الملف مع نفسك بس — Looker هيقراه بحسابك.', ui.ButtonSet.OK);
}
function dashShowLink() {
  const ui = SpreadsheetApp.getUi(), id = PropertiesService.getScriptProperties().getProperty(DASH.PROP_ID);
  if (!id) { ui.alert('لسه مفيش ملف بيانات. شغّل الأول: ⚙️ إعداد ملف بيانات الداشبورد.'); return; }
  let url = ''; try { url = SpreadsheetApp.openById(id).getUrl(); } catch (e) {}
  ui.alert('ملف بيانات الداشبورد', url ? url : 'الملف مش متاح (اتمسح أو الصلاحيات اتغيرت). اعمل ملف جديد من ⚙️ إعداد ملف بيانات الداشبورد.', ui.ButtonSet.OK);
}
function dashResetAll() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('إعادة بناء الداشبورد', 'هيتمسح مخزن التحليل المحفوظ، والتحديث الجاي هيحلل كل العربيات من الأول (ممكن ياخد كذا تشغيلة). متأكد؟', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  try { dashStoreSave_({ v: 1, off: PLATFORM.UTC_OFFSET_H, shared: {}, vehicles: {}, cursor: null, log: [] }); } catch (e) { ui.alert('تعذّر: ' + e.message); return; }
  ui.alert('تم. شغّل 📊 تحديث بيانات الداشبورد.');
}

function dashFile_() {
  const id = PropertiesService.getScriptProperties().getProperty(DASH.PROP_ID);
  if (!id) throw new Error('لسه مفيش ملف بيانات للداشبورد. شغّل الأول: Badawy Group ▸ Dashboard Data ▸ ⚙️ إعداد ملف بيانات الداشبورد.');
  try { return SpreadsheetApp.openById(id); } catch (e) { throw new Error('مش قادر أفتح ملف بيانات الداشبورد (اتمسح أو الصلاحيات اتغيرت). اعمل ملف جديد من ⚙️ إعداد ملف بيانات الداشبورد.'); }
}
function dashEnsureTabs_(file) {
  const keep = {};
  Object.keys(DASH.HEAD).forEach(function (n) {
    let sh = file.getSheetByName(n);
    if (!sh) sh = file.insertSheet(n);
    const h = DASH.HEAD[n];
    if (sh.getLastRow() < 1) {
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
    keep[n] = 1;
  });
  file.getSheets().forEach(function (s) { if (!keep[s.getName()] && /^(Sheet1|ورقة1)$/.test(s.getName()) && s.getLastRow() < 1 && file.getSheets().length > 1) { try { file.deleteSheet(s); } catch (e) {} } });
}

/* ───────────── مخزن التحليل (Drive) ───────────── */
function dashStoreLoad_() {
  const empty = { v: 1, off: PLATFORM.UTC_OFFSET_H, shared: {}, vehicles: {}, cursor: null, log: [] };
  const o = cacheReadFile_(cacheFolder_(), DASH.STORE, empty);
  o.shared = o.shared || {}; o.vehicles = o.vehicles || {}; o.log = o.log || [];
  return o;
}
function dashStoreSave_(st) { st.v = 1; st.off = PLATFORM.UTC_OFFSET_H; cacheWriteFile_(cacheFolder_(), DASH.STORE, st); }

/* ───────────── أدوات تحويل القيم (Looker يحتاج تواريخ حقيقية) ───────────── */
function dashSerial_(wallSec) { return wallSec / 86400 + 25569; }            // ثواني (توقيت المنصة كأنه UTC) ← رقم تاريخ/وقت في Sheets
function dashDateSerial_(key) { const p = String(key).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000 + 25569; }
function dashKeyFromLabel_(s) { const p = editsDigits_(String(s)).split('/'); return p.length === 3 ? p[2] + '-' + p2_(+p[1]) + '-' + p2_(+p[0]) : null; }   // d/m/yyyy ← yyyy-MM-dd
function dashRound1_(x) { return Math.round((Number(x) || 0) * 10) / 10; }
function dashDateToSerial_(v, tz) {   // Date من الشيت ← رقم (بتوقيت الملف)
  if (!(v instanceof Date)) return '';
  const k = Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss').split(/[- :]/).map(Number);
  return Date.UTC(k[0], k[1] - 1, k[2], k[3], k[4], k[5]) / 86400000 + 25569;
}
function dashDaysBetween_(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }

/* ───────────── جدول Days: صف لكل (عربية، يوم) ───────────── */
function dashDaysRows_(rep, vehicle, nowWall) {
  const by = {};
  const get = function (k) { return by[k] || (by[k] = { nakla: 0, km: 0, legs: 0, internal: 0, maint: 0, texts: [], ids: [], notes: [] }); };
  (rep.days || []).forEach(function (d) {
    const o = get(d.dateKey);
    o.nakla += Number(d.nakla) || 0; o.km += Number(d.km) || 0; o.legs += (d.rows || []).length; o.internal += Number(d.internalCount) || 0;
    if (d.text && o.texts.indexOf(d.text) < 0) o.texts.push(d.text);
    if (d.cycleIds) o.ids.push(d.cycleIds);
    (d.notes || []).concat(d.userNote ? [d.userNote] : []).forEach(function (n) { n = String(n || '').trim(); if (n && !/^صيانة \(/.test(n) && o.notes.indexOf(n) < 0) o.notes.push(n); });
  });
  // رحلات الصيانة: أي دورة دخلت الجراج/المركز ووقفت فيه (التعريف الموجود في الخوارزمية)، وتتسجل يوم حصولها
  (rep.cycles || []).forEach(function (c) {
    if (!c.hasW && c.kind !== 'WORKSHOP') return;
    const k = c.splitW ? ymd_(c.wArrive) : c.dateKey;
    if (by[k]) by[k].maint++;
  });
  return Object.keys(by).sort().map(function (k) {
    const o = by[k];
    return [dashDateSerial_(k), vehicle, o.nakla, dashRound1_(o.km), o.maint, o.legs, o.internal, o.nakla > 0 ? 'Y' : 'N', o.texts.join(' + '), o.ids.join(' / '), o.notes.join(' | '), dashSerial_(nowWall)];
  });
}

/* ───────────── جدول Cycles: صف لكل دورة (+ الوقوفات الطويلة) ───────────── */
function dashCyclesRows_(rep, vehicle, nowWall) {
  const src = rep.rawCycleRows ? rep.rawCycleRows.map(function (it) { return it.row; }) : generatedCycleItems_(rep).map(function (it) { return it.row; });   // لو فيه تعديلات يدوية بتتحسب بيها
  const kmBy = {};
  (rep.days || []).forEach(function (d) { (d.rows || []).forEach(function (x) { const k = String(x.cid); if (k !== '') kmBy[k] = (kmBy[k] || 0) + (Number(x.km) || 0); }); });
  const out = [];
  src.forEach(function (r) {
    const id = String(r[0]), dk = dashKeyFromLabel_(r[1]), st = editsTime_(r[2], 'UTC');
    if (!dk || isNaN(st)) return;
    const typ = String(r[6] || ''), open = /جارية/.test(typ) || /لسه/.test(String(r[3] || ''));
    const en = /لسه/.test(String(r[3] || '')) ? NaN : editsTime_(r[3], 'UTC');
    const kind = /^وقوف/.test(typ) ? 'وقوف بدون نقلات' : /^نقلة/.test(typ) ? 'نقلة' : /صيانة/.test(typ) ? 'رحلة صيانة' : /خارجية/.test(typ) ? 'رحلة خارجية' : 'بدون نقلة مكتملة';
    const ends = isNaN(en) ? nowWall : en;
    out.push({ dk: dk, st: st, row: [dashDateSerial_(dk), vehicle, vehicle + '-' + dk.replace(/-/g, '') + '-' + id, id, dashSerial_(st), isNaN(en) ? '' : dashSerial_(en), String(r[4] || ''),
      Number(r[5]) || 0, kind, open ? 'Y' : 'N', dashRound1_(kmBy[id] || 0), Math.max(0, Math.round((ends - st) / 60)), 'N', dashSerial_(nowWall)] });
  });
  out.sort(function (a, b) { return a.st - b.st; });
  let last = -1;
  out.forEach(function (o, i) { if (o.row[8] !== 'وقوف بدون نقلات') last = i; });
  if (last >= 0) out[last].row[12] = 'Y';
  return out.map(function (o) { return o.row; });
}

/* ───────────── حالة الأجهزة (نفس حساب "متابعة حالة ال GPS" من غير ما يكتب في ملف الشغل) ───────────── */
function dashStatusCollect_(ss, cookie, runId) {
  const devices = traccarGet_('/api/devices', cookie).filter(function (d) { return !d.disabled; });
  const positions = {};
  traccarGet_('/api/positions', cookie).forEach(function (p) { positions[p.id] = p; });
  progress_(runId, 1, devices.length + ' جهاز', 0);
  const now = Date.now();
  const events = gpsStatusEvents_(cookie, devices, now, function (done, total) { progress_(runId, 1, done + ' من ' + total + ' جهاز', total ? done / total : 1); });
  const infos = devices.map(function (d, i) { return gpsStatusCompute_(d, events[i].list, positions[d.positionId], now); });
  gpsStatusOffPositions_(cookie, devices, infos, function () {});
  let sites = [], named = [];
  try { sites = parseLocations_(platformLocValues_(ss), GPS_CONFIG).sites; } catch (e) {}
  try { named = namedLoad_(ss); } catch (e) {}
  const names = platformGpsNames_(ss);
  const rows = devices.map(function (d, i) {
    const inf = infos[i], m = /^\s*(\d+)/.exec(d.name);
    const loc = inf.loc ? gpsPlaceName_(inf.loc.lat, inf.loc.lon, sites, named) : null;
    const cur = (inf.cur && (inf.cur.lat || inf.cur.lon)) ? gpsPlaceName_(inf.cur.lat, inf.cur.lon, sites, named) : null;
    return { vehicle: m && names[Number(m[1])] ? names[Number(m[1])] : '', devNo: m ? Number(m[1]) : '', device: d.name, inf: inf, place: loc, curPlace: cur };
  });
  return { rows: rows, now: now };
}
function dashStatusRows_(coll) {
  const SK = { off: 1, unk: 2, silent: 3, ok: 4, out: 5 }, AR = { off: 'مقطوعة', unk: 'غير معروفة', silent: 'صامتة', ok: 'سليمة', out: 'خارج الخدمة' };
  const wall = function (ms) { return ms === null || ms === undefined || isNaN(ms) ? '' : dashSerial_(ms / 1000 + PLATFORM.UTC_OFFSET_H * 3600); };
  const upd = wall(coll.now), st = [], out = [];
  coll.rows.forEach(function (x) {
    const inf = x.inf, on = inf.status === 'online', g = gpsGroupOf_(inf, coll.now);
    const loc = on ? inf.cur : inf.loc, place = on ? x.curPlace : x.place;
    const veh = x.vehicle || '', vname = veh || gpsCleanName_(x.device);
    const ti = DASH.NAKLA_VEHICLES.indexOf(veh);
    const since = (on && inf.since === null) ? 'أكتر من ' + GPS_STATUS.LOOKBACK_DAYS + ' يوم' : (inf.since === null ? '' : gpsDurTxt_(inf.durMs));
    st.push([vname, gpsCleanName_(x.device), ti >= 0 ? 'Y' : 'N', ti >= 0 ? ti + 1 : 99, on ? 'Online' : inf.status === 'offline' ? 'Offline' : 'Unknown', g, AR[g], SK[g],
      wall(inf.lastData), inf.durMs === null ? '' : Math.round(inf.durMs / 60000), since, loc && (loc.lat || loc.lon) ? gpsPlaceTxt_(loc, place) : '',
      loc && (loc.lat || loc.lon) ? loc.lat + ',' + loc.lon : '', inf.drops7 || 0, upd]);
    (inf.periods || []).forEach(function (p) {
      if (p.s < coll.now - GPS_STATUS.LOOKBACK_DAYS * 86400000) return;
      out.push([vname, gpsCleanName_(x.device), wall(p.s), wall(p.e), Math.max(0, Math.round((p.e - p.s) / 60000)), 'N']);
    });
    if (!on && inf.openSince !== null && inf.openSince !== undefined) out.push([vname, gpsCleanName_(x.device), wall(inf.openSince), '', Math.max(0, Math.round((coll.now - inf.openSince) / 60000)), 'Y']);
  });
  st.sort(function (a, b) { return (a[3] - b[3]) || (a[7] - b[7]) || (String(a[0]) < String(b[0]) ? -1 : 1); });
  return { status: st, outages: out };
}

/* ───────────── جدول Vehicles (من شيت Devices Naming Connection) ───────────── */
function dashVehiclesRows_(ss, statusRows) {
  const sh = ss.getSheetByName(PLATFORM.MAP_SHEET), out = [], devBy = {};
  statusRows.forEach(function (r) { devBy[String(r[0])] = r[1]; });
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) {
    const no = Number(r[0]), v = String(r[2] === undefined || r[2] === null ? '' : r[2]).trim();
    if (!v) return;
    const ti = DASH.NAKLA_VEHICLES.indexOf(v);
    out.push([v, devBy[v] || '', no || '', ti >= 0 ? 'Y' : 'N', ti >= 0 ? ti + 1 : 99]);
  });
  out.sort(function (a, b) { return (a[4] - b[4]) || (String(a[0]) < String(b[0]) ? -1 : 1); });
  return out;
}

/* ───────────── جدول Issues (من تبويب Issues في ملف الشغل) ───────────── */
function dashIssuesRows_(ss, nowMs) {
  const sh = ss.getSheetByName(ISS.ISSUES), tz = ss.getSpreadsheetTimeZone(), out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  const keyOf = function (s) { return s === ISS.ST_DONE ? 'done' : s === ISS.ST_REPLY ? 'replied' : 'waiting'; };
  sh.getRange(2, 1, sh.getLastRow() - 1, 13).getValues().forEach(function (r) {
    if (r[0] === '' || r[0] === null) return;
    const status = String(r[7] || ISS.ST_WAIT), done = r[10] instanceof Date ? r[10].getTime() : 0;
    const visible = status !== ISS.ST_DONE || (done && nowMs - done <= ISS.SHOW_DONE_DAYS * 86400000);
    out.push([Number(r[0]) || String(r[0]), String(r[1]), String(r[2]), String(r[3]), String(r[5]), String(r[12] || 'مهندس'), status, keyOf(status),
      dashDateToSerial_(r[6], tz), String(r[8] || ''), dashDateToSerial_(r[9], tz), dashDateToSerial_(r[10], tz), visible ? 'Y' : 'N']);
  });
  out.sort(function (a, b) { return (Number(b[0]) || 0) - (Number(a[0]) || 0); });
  return out;
}

/* ───────────── Vehicle_Summary: صف لكل عربية نقل ───────────── */
function dashSummaryRows_(vehEntries, statusRows, today, nowWall) {
  const stBy = {};
  statusRows.forEach(function (r) { if (r[2] === 'Y') stBy[String(r[0])] = r; });
  return DASH.NAKLA_VEHICLES.map(function (v) {
    const e = vehEntries[v] || { days: [], cycles: [] };
    let lastD = null;
    e.days.forEach(function (r) { if ((Number(r[2]) || 0) > 0 && (lastD === null || r[0] > lastD)) lastD = r[0]; });
    let lastKey = null; if (lastD !== null) { const d = new Date((lastD - 25569) * 86400000); lastKey = ymd_(d.getTime() / 1000); }
    const since = lastKey ? Math.max(0, dashDaysBetween_(lastKey, today)) : '';
    const lc = e.cycles.filter(function (r) { return r[12] === 'Y'; })[0];
    const st = stBy[v];
    return [v, lastD === null ? '' : lastD, since, (since === '' || since >= DASH.STOP_DAYS) ? 'Y' : 'N', st ? st[11] : '', st ? st[12] : '', lc ? lc[2] : '', lc ? lc[4] : '', lc ? lc[10] : '', dashSerial_(nowWall)];
  });
}

/* ───────────── كتابة جدول في ملف الداشبورد ───────────── */
function dashWriteTable_(file, name, rows) {
  const head = DASH.HEAD[name], fm = DASH.FMT[name] || {};
  let sh = file.getSheetByName(name); if (!sh) sh = file.insertSheet(name);
  const n = rows.length, nc = head.length;
  if (sh.getMaxColumns() < nc) sh.insertColumnsAfter(sh.getMaxColumns(), nc - sh.getMaxColumns());
  if (sh.getMaxRows() < n + 2) sh.insertRowsAfter(sh.getMaxRows(), n + 2 - sh.getMaxRows());
  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 2), nc).clearContent();
  sh.getRange(1, 1, 1, nc).setValues([head]).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  if (n) {
    Object.keys(fm).forEach(function (c) {
      const f = fm[c] === 'd' ? 'yyyy-mm-dd' : fm[c] === 'dt' ? 'yyyy-mm-dd hh:mm:ss' : fm[c] === 'n1' ? '0.0' : '0';
      sh.getRange(2, Number(c) + 1, n, 1).setNumberFormat(f);
    });
    sh.getRange(2, 1, n, nc).setValues(rows);
  }
  // تقليل الخلايا: نشيل الصفوف الفاضية الزيادة (نسيب هامش 20)
  const keepRows = n + 21;
  if (sh.getMaxRows() > keepRows + 50) sh.deleteRows(keepRows + 1, sh.getMaxRows() - keepRows);
  if (sh.getMaxColumns() > nc + 1) { try { sh.deleteColumns(nc + 1, sh.getMaxColumns() - nc); } catch (e) {} }
}
function dashPublish_(file, st, now) {
  const vehs = st.vehicles, daysAll = [], cycAll = [];
  DASH.NAKLA_VEHICLES.forEach(function (v) { const e = vehs[v]; if (e) { e.days.forEach(function (r) { daysAll.push(r); }); e.cycles.forEach(function (r) { cycAll.push(r); }); } });
  daysAll.sort(function (a, b) { return (a[0] - b[0]) || (String(a[1]) < String(b[1]) ? -1 : 1); });
  cycAll.sort(function (a, b) { return (a[4] - b[4]) || (String(a[1]) < String(b[1]) ? -1 : 1); });
  const sh = st.shared, statusRows = (sh.status && sh.status.rows) || [];
  const nowWall = now / 1000 + PLATFORM.UTC_OFFSET_H * 3600, today = ymd_(nowWall);
  const summary = dashSummaryRows_(vehs, statusRows, today, nowWall);
  dashWriteTable_(file, 'Days', daysAll);
  dashWriteTable_(file, 'Cycles', cycAll);
  dashWriteTable_(file, 'Status_Now', statusRows);
  dashWriteTable_(file, 'Outages', (sh.outages && sh.outages.rows) || []);
  dashWriteTable_(file, 'Vehicles', (sh.vehicles && sh.vehicles.rows) || []);
  dashWriteTable_(file, 'Vehicle_Summary', summary);
  dashWriteTable_(file, 'Issues', (sh.issues && sh.issues.rows) || []);
  const log = st.log.slice(-DASH.LOG_KEEP).map(function (l) { return [dashSerial_(l[0]), l[1], l[2], l[3], l[4], l[5]]; });
  dashWriteTable_(file, 'Run_Log', log);
  return { days: daysAll.length, cycles: cycAll.length, status: statusRows.length };
}

/* ───────────── تحليل عربية واحدة (نفس منطق "تقرير النقلات من المنصة" بدون ما يكتب شيتات) ───────────── */
function dashAnalyzeVehicle_(ss, cookie, devices, vehicle, fromDay, toDay, onProg) {
  const tz = ss.getSpreadsheetTimeZone(), today = platformDay_(Date.now());
  const gpsNo = platformLookupGpsNo_(ss, vehicle);
  const dev = platformFindDevice_(devices, gpsNo);
  const pullFrom = shiftDay_(fromDay, -1), pullTo = toDay >= today ? toDay : (shiftDay_(toDay, 1) > today ? today : shiftDay_(toDay, 1));
  const data = platformPull_(cookie, dev.id, pullFrom, pullTo, onProg, false);
  const vals = traccarToValues_(data.route, data.trips, dev.name, PLATFORM.UTC_OFFSET_H);
  let named = []; try { named = namedLoad_(ss); } catch (e) {}
  let rep = buildFleetReport_(vals.routeValues, vals.tripValues, platformLocValues_(ss), tz, cfgFor_(vehicle), named);
  rep.vehicle = vehicle;
  rep = trimReport_(rep, fromDay, toDay);
  try { editsOverlayStored_(ss, rep, vehicle, fromDay, toDay, tz); } catch (e) {}   // تعديلاتك اليدوية المحفوظة
  const nowMs = Date.now(), nowWall = nowMs / 1000 + PLATFORM.UTC_OFFSET_H * 3600;
  return { days: dashDaysRows_(rep, vehicle, nowWall), cycles: dashCyclesRows_(rep, vehicle, nowWall), from: fromDay, to: toDay, at: nowMs, cached: data.info.cachedDays, fetched: data.info.fetchedDays };
}

/* ───────────── التشغيل الرئيسي (بيتنادى من JOBS.dash) ───────────── */
function dashRefreshRun(runId) {
  const t0 = Date.now(), ss = SpreadsheetApp.getActiveSpreadsheet();
  const elapsed = function () { return (Date.now() - t0) / 1000; };
  progress_(runId, 0, '');
  const file = dashFile_();
  dashEnsureTabs_(file);
  const st = dashStoreLoad_();
  progress_(runId, 0, 'الملف: ' + file.getName());
  const cookie = traccarCookie_();
  const errors = [], notes = [];
  const today = platformDay_(t0);
  // الفترة: أول يوم من (الشهر الحالي - MONTHS_BACK) → النهارده (بحد أقصى MAX_DAYS)
  const p = today.split('-').map(Number);
  let fy = p[0], fm = p[1] - DASH.MONTHS_BACK;
  while (fm < 1) { fm += 12; fy--; }
  let fromDay = fy + '-' + p2_(fm) + '-01';
  const minFrom = shiftDay_(today, -(PLATFORM.MAX_DAYS - 3));
  if (fromDay < minFrom) fromDay = minFrom;

  // 1) حالة الأجهزة (كل العربيات)
  progress_(runId, 1, '', 0);
  try {
    const coll = dashStatusCollect_(ss, cookie, runId);
    const sr = dashStatusRows_(coll);
    st.shared.status = { at: t0, rows: sr.status };
    st.shared.outages = { at: t0, rows: sr.outages };
    st.shared.vehicles = { at: t0, rows: dashVehiclesRows_(ss, sr.status) };
    progress_(runId, 1, sr.status.length + ' جهاز • ' + sr.outages.length + ' فترة انقطاع');
  } catch (e) { errors.push('حالة الأجهزة: ' + String(e && e.message ? e.message : e).slice(0, 120)); progress_(runId, 1, 'فشل — اتسابت آخر نسخة محفوظة'); }

  // 2) المشاكل
  progress_(runId, 2, '');
  try { st.shared.issues = { at: t0, rows: dashIssuesRows_(ss, t0) }; progress_(runId, 2, st.shared.issues.rows.length + ' مشكلة'); }
  catch (e) { errors.push('المشاكل: ' + String(e && e.message ? e.message : e).slice(0, 120)); progress_(runId, 2, 'فشل — اتسابت آخر نسخة محفوظة'); }

  // 3) عربيات النقل
  progress_(runId, 3, '', 0);
  let cur = st.cursor;
  const stale = cur && (t0 - cur.at > DASH.ROUND_STALE_H * 3600000 || cur.from !== fromDay);
  if (!cur || stale || DASH.NAKLA_VEHICLES.every(function (v) { return cur.done.indexOf(v) >= 0; })) cur = st.cursor = { at: t0, from: fromDay, done: [] };
  const todo = DASH.NAKLA_VEHICLES.filter(function (v) { return cur.done.indexOf(v) < 0; });
  let devices = null, did = 0;
  try { devices = traccarGet_('/api/devices', cookie); } catch (e) { errors.push('قائمة الأجهزة: ' + String(e && e.message ? e.message : e).slice(0, 120)); }
  for (let i = 0; i < todo.length && devices; i++) {
    const v = todo[i];
    if (did > 0 && elapsed() > DASH.RUN_BUDGET_SEC) break;
    progress_(runId, 3, 'سيارة ' + v + ' (' + (cur.done.length + 1) + ' من ' + DASH.NAKLA_VEHICLES.length + ')', cur.done.length / DASH.NAKLA_VEHICLES.length);
    try {
      const res = dashAnalyzeVehicle_(ss, cookie, devices, v, fromDay, today, function (frac) { progress_(runId, 3, 'سيارة ' + v + ' — سحب البيانات', (cur.done.length + (frac || 0) * 0.8) / DASH.NAKLA_VEHICLES.length); });
      st.vehicles[v] = res;
      cur.done.push(v);
      notes.push(v + ': ' + res.days.length + ' يوم');
    } catch (e) {
      const m = String(e && e.message ? e.message : e);
      if (/ما رجّعتش أي نقطة|مفيش أي نقلات أو رحلات/.test(m)) {   // عربية من غير بيانات في الفترة (GPS مقطوع / اتشال): صف فاضي مش خطأ
        st.vehicles[v] = { days: [], cycles: [], from: fromDay, to: today, at: Date.now() };
        cur.done.push(v); notes.push(v + ': مفيش بيانات في الفترة');
      } else { errors.push('سيارة ' + v + ': ' + m.slice(0, 140)); cur.done.push(v); }
    }
    did++;
    try { dashStoreSave_(st); } catch (e) {}   // نحفظ بعد كل عربية: لو التشغيل وقف نكمل من هنا
  }
  const remaining = DASH.NAKLA_VEHICLES.filter(function (v) { return cur.done.indexOf(v) < 0; });
  progress_(runId, 3, did + ' عربية اتحلّلت' + (remaining.length ? ' • فاضل ' + remaining.length + ' (شغّل التحديث تاني)' : ' • خلصت كلها'));

  // 4) الكتابة في ملف الداشبورد
  progress_(runId, 4, '');
  st.log.push([t0 / 1000 + PLATFORM.UTC_OFFSET_H * 3600, 'dashboard', did, Math.round(elapsed()), (remaining.length ? 'ناقص ' + remaining.length + ' عربية: ' + remaining.join(', ') : 'كامل') + (notes.length ? ' | ' + notes.join(', ') : ''), errors.join(' | ')]);
  const w = dashPublish_(file, st, Date.now());
  try { dashStoreSave_(st); } catch (e) { errors.push('حفظ المخزن: ' + String(e && e.message ? e.message : e).slice(0, 80)); }
  progress_(runId, 4, w.days + ' يوم • ' + w.cycles + ' دورة • ' + w.status + ' جهاز' + (remaining.length ? ' — لسه فاضل ' + remaining.length + ' عربية: شغّل التحديث تاني' : '') + (errors.length ? ' • ' + errors.length + ' تنبيه (شوف Run_Log)' : ''));
  return 'ok';
}