/* ═══════════════════════════════════════════════════════════════════════════
   Errand_Report.gs — تقرير "المشاوير" لباقي العربيات (ملاكي / جامبو / ربع نقل / أي عربية مش نقل)
   الزرار: GPS Tracking System ▸ Reports Generation ▸ 🚗 إنشاء تقرير سيارة من المنصة

   الفكرة: مفيش خلاطة/كسارة/نقلات. بنتتبع العربية ونطلّع: خرجت من فين ← راحت فين ← قعدت قد إيه ← خرجت امتى.
   • "زيارة" = وقوف 10 دقايق أو أكتر (ERR.MIN_STOP_MIN). أقل من كده = إشارة / ماتور مطفي = بيتجاهل (وبيتعدّ في ملخص اليوم).
   • اسم المكان بيتحدد بالترتيب:
       1) مواقع Coordinates المعروفة (الخلاطة، الكسارة، الجراج…) بنطاق ضيق
       2) شيت Places (المنطقة بالاسم اللي انت كاتبه — ولو كذا نقطة ليهم نفس الاسم يبقوا منطقة واحدة)
       3) مكان جديد: بيتسجل تلقائي في Places (اسم فاضي + لينك الخريطة) وانت بتسمّيه مرة واحدة وكل العربيات تاخد الاسم
   • زيارتين متتاليتين لنفس المنطقة بينهم أقل من 45 دقيقة = زيارة واحدة (محلين في نفس المنطقة).
   • اليوم بيبدأ 6 الصبح (نفس DAY_START_HOUR) واليوم = يوم الخروج.
   • شيت "مشاوير <رقم>" قابل للتعديل (اسم المكان، الأوقات، المسافة، مسح صف، وعمود "الغرض / تفاصيل الزيارة").
     بعد التعديل: ✏️ تطبيق تعديلاتي (وانت واقف على الشيت) — بيتحفظ في "Errand Edits Store" (مخفي) وبيتطبق لوحده على أي سحب جديد.
   • الأسماء الجديدة في Places بتتطبق على أي سحب جديد من غير ما تعدّل في التقرير.
   ═══════════════════════════════════════════════════════════════════════════ */
const ERR = {
  PREFIX: 'مشاوير ', SUMMARY_PREFIX: 'ملخص مشاوير ', ALERTS_PREFIX: 'تنبيهات مشاوير ', STORE_SHEET: 'Errand Edits Store',
  MIN_STOP_MIN: 10,          // وقوف أقل من كده مش زيارة
  SHORT_STOP_MIN: 4,         // وقفات من 4 لـ 10 دقايق بتتعدّ بس في ملخص اليوم (متجاهلة)
  STAY_RADIUS_M: 250,        // الوقفة = البقاء جوه دايرة نصف قطرها كده
  MAX_STAY_SPEED_KMH: 6,     // متوسط حركة جوه الوقفة (مسافة المسار ÷ المدة) فوق كده = لف/زحمة مش وقوف
  AREA_MERGE_GAP_MIN: 45,    // زيارتين لنفس المنطقة بينهم أقل من كده = زيارة واحدة
  KNOWN_MAX_R: 1000,         // أقصى نصف قطر لموقع من Coordinates في تقارير المشاوير (الخلاطة نطاقها 5.5 كم، هنا بنستخدم قلبها)
  UNKNOWN_CLUSTER_M: 1200,   // أماكن غير معروفة أقرب من كده لبعض = نفس المكان
  NEW_PLACE_RADIUS: 1200,    // نصف قطر المكان الجديد المتسجل في Places (تقدر تكبّره للمنطقة كلها)
  GAP_ALERT_MIN: 45, GAP_MIN_KM: 3,   // انقطاع إشارة أكتر من كده والعربية اتحركت أكتر من كده = تنبيه + المسافة تقديرية
  LONG_STAY_H: 10,           // وقوف أطول من كده بيتعلّم "غالباً مبيت"
  IDLE_H: 24,                // وقوف 24 ساعة أو أكتر = العربية متوقفة (تنبيه)
  MATCH_TOL_SEC: 1200,       // تسامح مطابقة التعديلات المحفوظة مع الزيارة (وقت الوصول)
  HINT_KM: 8,                // "قريب من <اسم>" للأماكن غير المسماة
  MAX_AVG_KMH: 120           // متوسط سرعة أعلى من كده للمسافة = رقم غلط
};

/* ───────────────────────────── المحرك (دوال نقية) ───────────────────────────── */
function errClean_(pts, cfg) {
  const out = []; let last = null, bad = 0, removed = 0;
  pts.forEach(function (p, idx) {
    if (cfg.FREEZE_FIX && last && p.sp > 0 && p.sp <= 15 && distM_(last.lat, last.lon, p.lat, p.lon) < 15) p.sp = 0;
    if (last) {
      const dt = Math.max(p.t - last.t, 1), d = distM_(last.lat, last.lon, p.lat, p.lon);
      if (d > 500 && (d / dt) * 3.6 > cfg.MAX_JUMP_KMH && bad < 20) {
        const nx = pts[idx + 1]; let spike = true;
        if (nx && distM_(p.lat, p.lon, nx.lat, nx.lon) < distM_(last.lat, last.lon, nx.lat, nx.lon)) spike = false;
        if (spike) { bad++; removed++; return; }
      }
    }
    bad = 0; out.push(p); last = p;
  });
  return { pts: out, removed: removed };
}

// وقفات: فترات متصلة جوه دايرة STAY_RADIUS_M بحركة بطيئة، مدتها minSec أو أكتر
function errStays_(pts, minSec) {
  const out = [], n = pts.length;
  let i = 0;
  while (i < n) {
    let j = i, path = 0;
    while (j + 1 < n && distM_(pts[i].lat, pts[i].lon, pts[j + 1].lat, pts[j + 1].lon) <= ERR.STAY_RADIUS_M) {
      path += distM_(pts[j].lat, pts[j].lon, pts[j + 1].lat, pts[j + 1].lon); j++;
    }
    const dur = pts[j].t - pts[i].t;
    if (j > i && dur >= minSec && (path / dur) * 3.6 <= ERR.MAX_STAY_SPEED_KMH) {
      let la = 0, lo = 0; for (let k = i; k <= j; k++) { la += pts[k].lat; lo += pts[k].lon; }
      out.push({ s: pts[i].t, e: pts[j].t, i0: i, i1: j, lat: la / (j - i + 1), lon: lo / (j - i + 1), stops: 1 });
      i = j + 1;
    } else i++;
  }
  return out;
}

// اسم المكان: Coordinates (نطاق ضيق) ← Places (بالاسم) ← غير معروف
function errPlaceOf_(lat, lon, sites, named) {
  let bk = null;
  (sites || []).forEach(function (s) {
    const r = s.coreRadius || Math.min(s.radius, ERR.KNOWN_MAX_R);
    for (let k = 0; k < s.pts.length; k++) {
      const dm = distM_(lat, lon, s.pts[k][0], s.pts[k][1]);
      if (dm <= r && (!bk || dm < bk.d)) bk = { d: dm, s: s };
    }
  });
  if (bk) return { pid: 'K:' + (bk.s.label || bk.s.name), name: bk.s.label || bk.s.name, kind: 'known' };
  let nb = null;
  (named || []).forEach(function (n) { const dm = distM_(lat, lon, n.lat, n.lon); if (dm <= n.r && (!nb || dm < nb.d)) nb = { d: dm, n: n }; });
  if (nb) return { pid: 'P:' + normAr_(nb.n.name), name: nb.n.name, kind: 'named' };
  return null;
}
function errHint_(lat, lon, sites, named) {
  let nb = null;
  (named || []).forEach(function (n) { const dm = distM_(lat, lon, n.lat, n.lon); if (dm <= ERR.HINT_KM * 1000 && (!nb || dm < nb.d)) nb = { d: dm, n: n }; });
  if (nb) return 'قريب من ' + nb.n.name + ' (' + (nb.d / 1000).toFixed(1) + ' كم)';
  try { const t = nearTxt_(lat, lon, sites); return t ? t.replace(/^على بعد /, 'على بعد ') : ''; } catch (e) { return ''; }
}

function errFmt_(t) {
  const d = new Date(t * 1000); let h = d.getUTCHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12;
  return d.getUTCDate() + '/' + (d.getUTCMonth() + 1) + ' ' + p2_(h) + ':' + p2_(d.getUTCMinutes()) + ' ' + ap;
}
function errHM_(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return 'أقل من دقيقة';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), p = [];
  if (d) p.push(d + ' يوم'); if (h) p.push(h + ' س'); if (m && !d) p.push(m + ' د');
  return p.join(' و');
}
function errDay_(t, cfg) { return ymd_(t - (cfg.DAY_START_HOUR || 0) * 3600); }
function errWeekday_(key) { const p = key.split('-'); return ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()]; }
function errTimeOnly_(s) { const m = /(\d{1,2}:\d{2} [AP]M)/.exec(String(s)); return m ? m[1] : String(s); }
function errSigOf_(x) { return editsHash_([x.from, x.dep, x.to, x.arr, x.trav, (Number(x.km) || 0).toFixed(1), x.stay, x.leave].join('|')); }

// route/trips: ردود المنصة الخام (من platformPull_). بيرجّع { days:[{dateKey, short, rows}], alerts, spots, removed, visits }
function errBuild_(route, trips, sites, named, cfg, fromDay, toDay) {
  const off = PLATFORM.UTC_OFFSET_H * 3600;
  let pts = [];
  route.forEach(function (p) {
    if (p.valid === false) return;
    const t = platformParseIso_(p.fixTime || p.deviceTime) / 1000 + off, la = Number(p.latitude), lo = Number(p.longitude);
    if (!isFinite(t) || !isFinite(la) || !isFinite(lo) || (!la && !lo)) return;
    pts.push({ t: t, lat: la, lon: lo, sp: (Number(p.speed) || 0) * 1.852 });
  });
  pts.sort(function (a, b) { return a.t - b.t; });
  const cl = errClean_(pts, cfg); pts = cl.pts;
  if (pts.length < 2) throw new Error('مفيش نقاط GPS كفاية للسيارة في الفترة دي.');
  const tr = (trips || []).map(function (t) { return { s: platformParseIso_(t.startTime) / 1000 + off, e: platformParseIso_(t.endTime) / 1000 + off, km: (t.distance || 0) / 1000 }; }).filter(function (t) { return isFinite(t.s) && isFinite(t.e); });
  const n = pts.length, alerts = [];

  // 1) الوقفات (زيارات ≥ 10 د / قصيرة 4–10 د)
  const stays = errStays_(pts, ERR.SHORT_STOP_MIN * 60), shortByDay = {}, vis = [];
  stays.forEach(function (st) {
    if (st.e - st.s >= ERR.MIN_STOP_MIN * 60) vis.push(st);
    else { const k = errDay_(st.s, cfg); shortByDay[k] = (shortByDay[k] || 0) + 1; }
  });

  // 2) اسم المكان لكل زيارة (+ تجميع الأماكن غير المعروفة)
  const clusters = [];
  vis.forEach(function (v) {
    const pl = errPlaceOf_(v.lat, v.lon, sites, named);
    if (pl) { v.pid = pl.pid; v.name = pl.name; v.kind = pl.kind; return; }
    let c = null;
    clusters.forEach(function (q) { const dm = distM_(v.lat, v.lon, q.lat, q.lon); if (dm <= ERR.UNKNOWN_CLUSTER_M && (!c || dm < c.d)) c = { d: dm, q: q }; });
    if (!c) { c = { q: { idx: clusters.length + 1, lat: v.lat, lon: v.lon } }; clusters.push(c.q); }
    v.pid = 'U:' + c.q.idx; v.name = 'منطقة غير مسماة #' + c.q.idx; v.kind = 'new'; v.cl = c.q;
  });

  // 3) دمج الزيارات المتتالية لنفس المنطقة
  const M = [];
  vis.forEach(function (v) {
    const p = M[M.length - 1];
    if (p && p.pid === v.pid && v.s - p.e <= ERR.AREA_MERGE_GAP_MIN * 60) { p.e = v.e; p.i1 = v.i1; p.stops += 1; }
    else M.push(v);
  });

  // 4) الصفوف: كل صف = رحلة من مكان لمكان + الوقوف في المكان الوصول
  const byDay = {}, spots = [], seenSpot = {};
  const km = function (A, B) {
    let poly = 0;
    for (let k = A.i1; k < B.i0; k++) poly += distM_(pts[k].lat, pts[k].lon, pts[k + 1].lat, pts[k + 1].lon);
    poly /= 1000;
    let sum = 0, cnt = 0;
    tr.forEach(function (t) { if (t.s >= A.e - 300 && t.e <= B.s + 300) { sum += t.km; cnt++; } });
    let v = poly, est = 0;
    if (cnt && sum >= poly * 0.9 && sum <= poly * 1.8 + 0.5) v = sum;
    const hrs = Math.max((B.s - A.e) / 3600, 0.01);
    if (v / hrs > ERR.MAX_AVG_KMH) { v = poly; est = 1; }
    return { km: v, est: est };
  };
  for (let k = 1; k < M.length; k++) {
    const A = M[k - 1], B = M[k], dk = errDay_(A.e, cfg);
    if (dk < fromDay || dk > toDay) continue;
    const kk = km(A, B), sys = [];
    let est = kk.est;
    for (let q = A.i1; q < B.i0; q++) {
      const gap = pts[q + 1].t - pts[q].t;
      if (gap > ERR.GAP_ALERT_MIN * 60 && distM_(pts[q].lat, pts[q].lon, pts[q + 1].lat, pts[q + 1].lon) > ERR.GAP_MIN_KM * 1000) {
        est = 1; sys.push('⚠ انقطاع إشارة ' + errHM_(gap) + ' أثناء الرحلة (المسافة تقديرية)');
        alerts.push({ type: 'انقطاع إشارة', time: errFmt_(pts[q].t), place: A.name + ' ← ' + B.name, detail: 'مفيش نقاط لمدة ' + errHM_(gap) + ' والعربية اتحركت ' + (distM_(pts[q].lat, pts[q].lon, pts[q + 1].lat, pts[q + 1].lon) / 1000).toFixed(1) + ' كم (خط مستقيم).' });
        break;
      }
    }
    const stSec = B.e - B.s, ongoing = B.i1 === n - 1;
    if (B.kind === 'new') {
      const h = errHint_(B.lat, B.lon, sites, named);
      sys.push('مكان غير مسمى — اتسجل في Places، سمّيه' + (h ? ' (' + h + ')' : ''));
      const sk = B.pid; if (!seenSpot[sk] && dk >= fromDay && dk <= toDay) { seenSpot[sk] = 1; spots.push({ lat: B.cl.lat, lon: B.cl.lon, r: ERR.NEW_PLACE_RADIUS }); }
      alerts.push({ type: 'مكان غير مسمى', time: errFmt_(B.s), place: B.name, detail: (h || '') + ' — افتح Places وسمّيه (كل العربيات هتاخد الاسم).', lat: B.lat, lon: B.lon });
    }
    if (A.pid === B.pid) sys.push('رجعت لنفس المنطقة بعد ' + errHM_(B.s - A.e));
    if (B.stops > 1) sys.push(B.stops + ' وقفات متقاربة في نفس المنطقة اتجمعوا');
    if (stSec >= ERR.LONG_STAY_H * 3600 && !ongoing) sys.push('وقوف طويل ' + errHM_(stSec) + ' (غالباً مبيت)');
    if (stSec >= ERR.IDLE_H * 3600) alerts.push({ type: 'وقوف طويل جداً', time: errFmt_(B.s), place: B.name, detail: 'العربية واقفة ' + errHM_(stSec) + ' في نفس المكان (مفيش سواق / عطل / إجازة؟).' });
    if (ongoing) sys.push('آخر إشارة ' + errTimeOnly_(errFmt_(B.e)) + ' — لسه واقفة هنا أو الإشارة انقطعت');
    const row = { from: A.name, dep: errFmt_(A.e), to: B.name, arr: errFmt_(B.s), trav: errHM_(B.s - A.e), km: Math.round(kk.km * 10) / 10,
      stay: errHM_(stSec) + (ongoing ? ' (لحد آخر إشارة)' : ''), leave: ongoing ? '—' : errFmt_(B.e), note: '', sys: sys.join(' | '),
      meta: { p: B.pid, t: B.s, d: dk, st: stSec, tr: B.s - A.e, e: est ? 1 : 0, nw: B.kind === 'new' ? 1 : 0, la: B.kind === 'new' ? Math.round(B.lat * 1e5) / 1e5 : 0, lo: B.kind === 'new' ? Math.round(B.lon * 1e5) / 1e5 : 0 } };
    row.meta.sg = errSigOf_(row);
    (byDay[dk] || (byDay[dk] = [])).push(row);
  }
  if (cl.removed) alerts.push({ type: 'إشارات غلط', time: '', place: '', detail: 'اتشال ' + cl.removed + ' نقطة GPS بتقفز مسافات مستحيلة.' });
  const days = Object.keys(byDay).sort().map(function (k) { byDay[k].forEach(function (x) { x.meta.sh = shortByDay[k] || 0; }); return { dateKey: k, short: shortByDay[k] || 0, rows: byDay[k] }; });
  return { days: days, alerts: alerts, spots: spots, removed: cl.removed, visits: M.length };
}

/* ───────────────────────────── التعديلات المحفوظة ───────────────────────────── */
function errStoreSheet_(ss, create) {
  let sh = ss.getSheetByName(ERR.STORE_SHEET);
  if (!sh && create) {
    let act = null; try { act = ss.getActiveSheet(); } catch (e) {}
    sh = ss.insertSheet(ERR.STORE_SHEET);
    sh.getRange('A:G').setNumberFormat('@');
    sh.getRange(1, 1, 1, 7).setValues([['السيارة', 'النوع', 'التاريخ', 'المكان', 'وقت الوصول', 'البيانات', 'آخر حفظ']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (act) { try { ss.setActiveSheet(act); } catch (e) {} }
    try { sh.hideSheet(); } catch (e) {}
  }
  return sh;
}
function errStoreRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues().filter(function (r) { return String(r[0]) !== ''; }).map(function (r) {
    return { v: String(r[0]), kind: String(r[1]), dateKey: String(r[2]), pid: String(r[3]), t: Number(r[4]) || 0, payload: String(r[5]), saved: String(r[6]) };
  });
}
function errStoreWrite_(sh, rows) {
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 7).clearContent();
  if (!rows.length) return;
  ensureGrid_(sh, rows.length + 2, 7);
  sh.getRange(2, 1, rows.length, 7).setValues(rows.map(function (x) { return [x.v, x.kind, x.dateKey, x.pid, x.t, x.payload, x.saved]; }));
}
// لقطة المفاتيح المتولّدة (G): عشان نعرف بعدين إيه الصفوف اللي مسحتها (T)
function errStoreSaveGen_(ss, vehicle, days, fromDay, toDay) {
  const v = safeVeh_(vehicle), now = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm');
  const sh = errStoreSheet_(ss, true), all = errStoreRows_(sh);
  const keep = all.filter(function (r) { return !(r.v === v && r.kind === 'G' && r.dateKey >= fromDay && r.dateKey <= toDay); });
  days.forEach(function (d) { keep.push({ v: v, kind: 'G', dateKey: d.dateKey, pid: '', t: 0, payload: JSON.stringify(d.rows.map(function (x) { return [x.meta.p, x.meta.t]; })), saved: now }); });
  errStoreWrite_(sh, keep);
}
// بتطبّق E/N/T المحفوظة على التقرير المتولّد (قبل الكتابة)
function errOverlay_(ss, rep, vehicle, fromDay, toDay) {
  const res = { applied: 0, lost: 0 };
  const sh = errStoreSheet_(ss, false); if (!sh) return res;
  const v = safeVeh_(vehicle), ents = [];
  errStoreRows_(sh).forEach(function (r) { if (r.v === v && (r.kind === 'E' || r.kind === 'N' || r.kind === 'T')) { let p = {}; try { p = JSON.parse(r.payload); } catch (e) {} ents.push({ kind: r.kind, dateKey: r.dateKey, pid: r.pid, t: r.t, p: p, used: false }); } });
  if (!ents.length) return res;
  rep.days.forEach(function (d) {
    d.rows = d.rows.filter(function (x) {
      let b = null;
      ents.forEach(function (e) { if (!e.used && e.pid === x.meta.p && Math.abs(e.t - x.meta.t) <= ERR.MATCH_TOL_SEC && (!b || Math.abs(e.t - x.meta.t) < Math.abs(b.t - x.meta.t))) b = e; });
      if (!b) return true;
      b.used = true; res.applied++;
      if (b.kind === 'T') return false;
      if (b.kind === 'E') { ['from', 'dep', 'to', 'arr', 'trav', 'stay', 'leave'].forEach(function (k) { if (b.p[k] !== undefined) x[k] = b.p[k]; }); if (b.p.km !== undefined) x.km = b.p.km; }
      if (b.p.note !== undefined) x.note = b.p.note;
      return true;
    });
  });
  ents.forEach(function (e) { if (!e.used && e.kind !== 'T' && e.dateKey >= fromDay && e.dateKey <= toDay) res.lost++; });
  rep.days = rep.days.filter(function (d) { return d.rows.length; });
  return res;
}
// بيحفظ تعديلات الشيت الحالي (rows من errReadMain_)
function errStoreSaveEdits_(ss, vehicle, rows) {
  const v = safeVeh_(vehicle), now = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm');
  const keys = rows.map(function (x) { return x.meta.d; }).sort(); if (!keys.length) return { edits: 0, tombs: 0 };
  const from = keys[0], to = keys[keys.length - 1];
  const fresh = [], present = {};
  rows.forEach(function (x) {
    present[x.meta.p + '|' + x.meta.t] = 1;
    if (errSigOf_(x) !== x.meta.sg) fresh.push({ v: v, kind: 'E', dateKey: x.meta.d, pid: x.meta.p, t: x.meta.t, payload: JSON.stringify({ from: x.from, dep: x.dep, to: x.to, arr: x.arr, trav: x.trav, km: x.km, stay: x.stay, leave: x.leave, note: x.note }), saved: now });
    else if (x.note) fresh.push({ v: v, kind: 'N', dateKey: x.meta.d, pid: x.meta.p, t: x.meta.t, payload: JSON.stringify({ note: x.note }), saved: now });
  });
  const sh = errStoreSheet_(ss, true), all = errStoreRows_(sh), tombs = [];
  const haveT = {}; all.forEach(function (r) { if (r.v === v && r.kind === 'T') haveT[r.pid + '|' + r.t] = 1; });
  all.forEach(function (r) {
    if (r.v !== v || r.kind !== 'G' || r.dateKey < from || r.dateKey > to) return;
    let list = []; try { list = JSON.parse(r.payload); } catch (e) {}
    list.forEach(function (k) { const id = k[0] + '|' + k[1]; if (!present[id] && !haveT[id]) { haveT[id] = 1; tombs.push({ v: v, kind: 'T', dateKey: r.dateKey, pid: k[0], t: k[1], payload: '{}', saved: now }); } });
  });
  const keep = all.filter(function (r) { return !(r.v === v && (r.kind === 'E' || r.kind === 'N') && r.dateKey >= from && r.dateKey <= to); }).concat(fresh, tombs);
  errStoreWrite_(sh, keep);
  return { edits: fresh.length, tombs: tombs.length };
}

/* ───────────────────────────── كتابة الشيتات ───────────────────────────── */
// تنسيق كل شيتات المشاوير: محاذاة أفقية في النص + رأسية في النص + التفاف النص
function errFormat_(sh) {
  try {
    const lr = sh.getLastRow(), lc = sh.getLastColumn();
    if (lr > 0 && lc > 0) sh.getRange(1, 1, lr, lc).setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  } catch (e) {}
}
function errTitle_(vehicle) { const v = String(vehicle || '').trim(); return /^سيارة/.test(v) ? v : 'سيارة ' + v; }
// سطر عنوان فوق الهيدر: اسم السيارة
function errTitleRow_(sh, text, cols) {
  sh.insertRowBefore(1);
  const g = sh.getRange(1, 1, 1, cols);
  g.breakApart(); g.clearContent(); g.setNumberFormat('@');
  g.merge().setValue(text).setBackground('#1f3a5f').setFontColor('#ffffff').setFontWeight('bold').setFontSize(14);
  sh.setRowHeight(1, 34);
}
function errDayHeader_(d) {
  const r = d.rows, kmSum = r.reduce(function (s, x) { return s + (Number(x.km) || 0); }, 0);
  const path = [r[0].from]; r.forEach(function (x) { if (path[path.length - 1] !== x.to) path.push(x.to); });
  return '📅 ' + errWeekday_(d.dateKey) + ' ' + dayLabelFull_(d.dateKey) + '   —   ' + r.length + (r.length === 1 ? ' زيارة' : ' زيارات') + '   —   ' + kmSum.toFixed(1) + ' كم   —   أول خروج ' + errTimeOnly_(r[0].dep) + '   —   آخر وصول ' + errTimeOnly_(r[r.length - 1].arr) +
    '\nالمسار: ' + path.join(' ← ') + (d.short ? '\n(وقفات قصيرة أقل من ' + ERR.MIN_STOP_MIN + ' دقايق متجاهلة: ' + d.short + ')' : '');
}

function errWriteMain_(ss, vehicle, days) {
  const sh = getOrCreateSheet_(ss, ERR.PREFIX + vehicle);
  const head = ['#', 'خرج من', 'وقت الخروج', 'وصل إلى', 'وقت الوصول', 'مدة الطريق', 'المسافة', 'مدة الوقوف', 'وقت المغادرة', 'الغرض / تفاصيل الزيارة', 'تنبيهات', 'meta'];
  const table = [head], hdr = [], blocks = [], newRows = [], estRows = [], links = [], noteRows = [];
  let r = 2, no = 0;
  days = days.filter(function (d) { return d.rows.length; });
  days.forEach(function (d, di) {
    if (di > 0) { table.push(['', '', '', '', '', '', '', '', '', '', '', '']); r++; }
    const h0 = r;
    d.rows.sort(function (a, b) { return a.meta.t - b.meta.t; });
    table.push([errDayHeader_(d), '', '', '', '', '', '', '', '', '', '', 'H|' + d.dateKey]); hdr.push({ r: r, lines: 1 + (d.short ? 2 : 1) }); r++;
    d.rows.forEach(function (x) {
      no++; x.no = no;
      table.push([no, x.from, x.dep, x.to, x.arr, x.trav, Number(x.km) || 0, x.stay, x.leave, x.note || '', x.sys || '', JSON.stringify(x.meta)]);
      if (x.meta.nw) { newRows.push(r); links.push({ r: r, url: gpsMapUrl_(x.meta.la, x.meta.lo), txt: x.to }); }
      if (x.meta.e) estRows.push('G' + r);
      noteRows.push('J' + r);
      r++;
    });
    blocks.push('A' + h0 + ':K' + (r - 1));
  });
  ensureGrid_(sh, table.length + 1, 12);
  [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].forEach(function (c) { sh.getRange(1, c, table.length, 1).setNumberFormat('@'); });
  sh.getRange(1, 1, table.length, 12).setValues(table);
  sh.getRange(2, 7, table.length - 1, 1).setNumberFormat('0.0 "km"');
  sh.getRange(1, 1, 1, 9).setBackground('#3d85c6').setFontColor('#ffffff');
  sh.getRange(1, 10, 1, 1).setBackground('#f1c232').setFontColor('#000000');
  sh.getRange(1, 11, 1, 1).setBackground('#e69138').setFontColor('#ffffff');
  sh.getRange(1, 1, 1, 11).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  if (table.length > 1) sh.getRange(2, 1, table.length - 1, 11).setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  if (table.length > 1) sh.getRange(2, 2, table.length - 1, 1).setWrap(true), sh.getRange(2, 4, table.length - 1, 1).setWrap(true), sh.getRange(2, 10, table.length - 1, 2).setWrap(true);
  [45, 150, 115, 170, 115, 95, 80, 105, 115, 300, 240].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  try { sh.hideColumns(12); } catch (e) {}
  if (blocks.length) sh.getRangeList(blocks).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  if (noteRows.length) sh.getRangeList(noteRows).setBackground('#fffde7');
  if (newRows.length) sh.getRangeList(newRows.map(function (x) { return 'D' + x; })).setBackground('#fce5cd');
  if (estRows.length) sh.getRangeList(estRows).setFontColor('#cc0000');
  hdr.forEach(function (h) {
    const g = sh.getRange(h.r, 1, 1, 11);
    g.merge().setBackground('#cfe2f3').setHorizontalAlignment('right').setWrap(true).setFontWeight('bold');
    sh.setRowHeight(h.r, 22 * h.lines + 6);
  });
  links.forEach(function (l) { try { sh.getRange(l.r, 4).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(l.txt).setLinkUrl(l.url).build()); } catch (e) {} });
  errTitleRow_(sh, errTitle_(vehicle), 11);
  sh.setFrozenRows(2);
  errFormat_(sh);
  return sh;
}

function errWriteSummary_(ss, vehicle, days) {
  const sh = getOrCreateSheet_(ss, ERR.SUMMARY_PREFIX + vehicle);
  const t = [], hs = [];
  t.push([errTitle_(vehicle) + ' — ملخص المشاوير', '', '', '', '', '', '']); hs.push({ r: 1, c: '#1f3a5f' });
  t.push(['', '', '', '', '', '', '']);
  t.push(['التاريخ', 'اليوم', 'عدد الزيارات', 'المسافة (كم)', 'أول خروج', 'آخر وصول', 'المسار']); hs.push({ r: 3, c: '#3d85c6' });
  const areas = {};
  days.forEach(function (d) {
    if (!d.rows.length) return;
    const rows = d.rows, kmSum = rows.reduce(function (s, x) { return s + (Number(x.km) || 0); }, 0);
    const path = [rows[0].from]; rows.forEach(function (x) { if (path[path.length - 1] !== x.to) path.push(x.to); });
    t.push([dayLabelFull_(d.dateKey), errWeekday_(d.dateKey), rows.length, Math.round(kmSum * 10) / 10, errTimeOnly_(rows[0].dep), errTimeOnly_(rows[rows.length - 1].arr), path.join(' ← ')]);
    rows.forEach(function (x) {
      const a = areas[x.to] || (areas[x.to] = { n: 0, sec: 0, first: x.meta.t, last: x.meta.t, days: {} });
      a.n++; a.sec += Number(x.meta.st) || 0; a.first = Math.min(a.first, x.meta.t); a.last = Math.max(a.last, x.meta.t); a.days[d.dateKey] = 1;
    });
  });
  let totKm = 0, totVis = 0;
  days.forEach(function (d) { d.rows.forEach(function (x) { totKm += Number(x.km) || 0; totVis++; }); });
  t.push(['إجمالي الفترة', '', totVis, Math.round(totKm * 10) / 10, '', '', 'إجمالي الكيلومترات: ' + totKm.toFixed(1) + ' كم']); const totRow = t.length;
  const dayEnd = t.length;
  t.push(['', '', '', '', '', '', '']);
  t.push(['المنطقة / المكان', 'عدد الزيارات', 'عدد الأيام', 'إجمالي وقت الوقوف', 'أول زيارة', 'آخر زيارة', '']); const aHead = t.length; hs.push({ r: aHead, c: '#e69138' });
  Object.keys(areas).sort(function (x, y) { return areas[y].n - areas[x].n || areas[y].sec - areas[x].sec; }).forEach(function (k) {
    const a = areas[k]; t.push([k, a.n, Object.keys(a.days).length, errHM_(a.sec), errFmt_(a.first), errFmt_(a.last), '']);
  });
  ensureGrid_(sh, t.length + 1, 7);
  sh.getRange(1, 1, t.length, 7).setNumberFormat('@').setValues(t);
  sh.getRange(1, 1, 1, 7).merge();
  sh.getRange(totRow, 1, 1, 7).setBackground('#d9ead3').setFontWeight('bold');
  hs.forEach(function (h) { sh.getRange(h.r, 1, 1, 7).setBackground(h.c).setFontColor('#ffffff').setFontWeight('bold'); });
  if (dayEnd > 3) sh.getRange(4, 1, dayEnd - 3, 7).setBorder(true, true, true, true, true, true, '#999999', SpreadsheetApp.BorderStyle.SOLID);
  if (t.length > aHead) sh.getRange(aHead + 1, 1, t.length - aHead, 7).setBorder(true, true, true, true, true, true, '#999999', SpreadsheetApp.BorderStyle.SOLID);
  [110, 95, 100, 130, 130, 130, 520].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(4, 7, Math.max(1, dayEnd - 3), 1).setWrap(true);
  errFormat_(sh);
  return sh;
}

function errWriteAlerts_(ss, vehicle, alerts) {
  const sh = getOrCreateSheet_(ss, ERR.ALERTS_PREFIX + vehicle);
  const t = [['النوع', 'الوقت', 'المكان', 'التفاصيل', 'الخريطة']];
  if (!alerts.length) t.push(['مفيش تنبيهات', '', '', '', '']);
  alerts.forEach(function (a) { t.push([a.type, a.time, a.place, a.detail, a.lat ? 'فتح' : '']); });
  ensureGrid_(sh, t.length + 1, 5);
  sh.getRange(1, 1, t.length, 5).setNumberFormat('@').setValues(t);
  sh.getRange(1, 1, 1, 5).setBackground('#e69138').setFontColor('#ffffff').setFontWeight('bold');
  sh.getRange(2, 4, t.length - 1, 1).setWrap(true);
  [140, 120, 200, 520, 70].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  alerts.forEach(function (a, i) { if (a.lat) { try { sh.getRange(i + 2, 5).setRichTextValue(SpreadsheetApp.newRichTextValue().setText('فتح').setLinkUrl(gpsMapUrl_(a.lat, a.lon)).build()); } catch (e) {} } });
  errTitleRow_(sh, errTitle_(vehicle) + ' — التنبيهات', 5);
  sh.setFrozenRows(2); errFormat_(sh);
  return sh;
}

/* ───────────────────────────── التنفيذ من المنصة ───────────────────────────── */
function errCfg_(vehicle) {
  const c = {}; const b = cfgFor_(vehicle);
  Object.keys(b).forEach(function (k) { c[k] = b[k]; });
  return c;
}

function errandReportRun(vehicle, fromTxt, toTxt, runId, fresh) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  vehicle = String(vehicle || '').trim();
  if (!vehicle) throw new Error('لازم تكتب رقم السيارة.');
  const today = platformDay_(new Date().getTime());
  const fromDay = platformDayInput_(fromTxt, today.slice(0, 8) + '01');
  const toDay = platformDayInput_(toTxt, today);
  if (toDay < fromDay) throw new Error('تاريخ النهاية قبل البداية.');
  const reqDays = Math.round((Date.parse(toDay + 'T00:00:00Z') - Date.parse(fromDay + 'T00:00:00Z')) / 86400000) + 1;
  if (reqDays > PLATFORM.MAX_DAYS) throw new Error('الفترة ' + reqDays + ' يوم. الحد الأقصى ' + PLATFORM.MAX_DAYS + ' يوم في المرة.');
  const pullFrom = shiftDay_(fromDay, -1);                                   // يوم قبل: عشان نعرف العربية خرجت منين أول يوم
  const pullTo = toDay >= today ? toDay : (shiftDay_(toDay, 1) > today ? today : shiftDay_(toDay, 1));
  progress_(runId, 0, '');
  const gpsNo = platformLookupGpsNo_(ss, vehicle);
  progress_(runId, 1, '');
  const cookie = traccarCookie_();
  const dev = platformFindDevice_(traccarGet_('/api/devices', cookie), gpsNo);
  progress_(runId, 0, 'الجهاز: ' + dev.name);
  progress_(runId, 2, 'جاري سحب الرحلات…');
  const data = platformPull_(cookie, dev.id, pullFrom, pullTo, function (frac, msg) { progress_(runId, 2, msg, frac); }, fresh);
  progress_(runId, 2, data.route.length + ' نقطة • ' + data.info.cachedDays + ' يوم من الكاش و ' + data.info.fetchedDays + ' من المنصة • ' + data.info.fetchSec + ' ث' + (data.info.cacheErr ? ' (الكاش غير متاح: ' + data.info.cacheErr + ')' : ''));
  progress_(runId, 3, '');
  let sites = []; try { sites = parseLocations_(platformLocValues_(ss), GPS_CONFIG).sites; } catch (e) { sites = []; }
  let named = []; try { named = namedLoad_(ss); } catch (e) {}
  progress_(runId, 3, data.route.length + ' نقطة جاهزة • ' + sites.length + ' موقع معروف • ' + named.length + ' مكان مسمى');
  progress_(runId, 4, '');
  const rep = errBuild_(data.route, data.trips, sites, named, errCfg_(vehicle), fromDay, toDay);
  if (!rep.days.length) throw new Error('مفيش زيارات (وقوف ' + ERR.MIN_STOP_MIN + ' دقايق أو أكتر) في الفترة من ' + fromDay + ' إلى ' + toDay + '.');
  progress_(runId, 4, rep.visits + ' زيارة • ' + rep.days.length + ' يوم');
  progress_(runId, 5, '');
  const v = safeVeh_(vehicle);
  try { errStoreSaveGen_(ss, v, rep.days, fromDay, toDay); } catch (e) {}
  let ov = { applied: 0, lost: 0 }; try { ov = errOverlay_(ss, rep, v, fromDay, toDay); } catch (e) {}
  try { if (rep.spots.length) namedRegister_(ss, rep.spots.map(function (x) { return { lat: x.lat, lon: x.lon, r: x.r, vehicle: v }; }), Date.now()); } catch (e) {}
  errWriteMain_(ss, v, rep.days);
  errWriteSummary_(ss, v, rep.days);
  errWriteAlerts_(ss, v, rep.alerts);
  try { ss.setActiveSheet(ss.getSheetByName(ERR.PREFIX + v)); } catch (e) {}
  progress_(runId, 5, (ov.applied ? 'اتطبق ' + ov.applied + ' تعديل محفوظ' : '') + (ov.lost ? ' • ' + ov.lost + ' تعديل محفوظ ما لقيتش زيارته (البيانات اتغيرت)' : ''));
  progress_(runId, 6, '');
  return 'ok';
}

/* ───────────────────────────── ✏️ تطبيق التعديلات (مشاوير) ───────────────────────────── */
function errandIsActive_() { try { return SpreadsheetApp.getActiveSheet().getName().indexOf(ERR.PREFIX) === 0 && SpreadsheetApp.getActiveSheet().getName().indexOf(ERR.SUMMARY_PREFIX) !== 0; } catch (e) { return false; } }

function errReadMain_(sh) {
  const out = [], warn = [];
  if (sh.getLastRow() < 3) return { rows: out, warn: warn };
  const vals = sh.getRange(3, 1, sh.getLastRow() - 2, 12).getValues();
  vals.forEach(function (v, i) {
    const meta = String(v[11] || '');
    if (meta.indexOf('H|') === 0) return;
    if (meta.charAt(0) !== '{') { if (v.slice(1, 10).some(function (c) { return String(c).trim() !== ''; })) warn.push('الصف ' + (i + 3) + ' (مضاف يدوي) مش بيتحفظ.'); return; }
    let m; try { m = JSON.parse(meta); } catch (e) { return; }
    const k = editsNum_(v[6]);
    out.push({ from: editsText_(v[1]), dep: editsText_(v[2]), to: editsText_(v[3]), arr: editsText_(v[4]), trav: editsText_(v[5]), km: isNaN(k) ? 0 : Math.round(k * 10) / 10, stay: editsText_(v[7]), leave: editsText_(v[8]), note: editsText_(v[9]), sys: editsText_(v[10]), meta: m });
  });
  return { rows: out, warn: warn };
}

function errandApplyEdits() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  let main = ss.getActiveSheet().getName();
  if (!errandIsActive_()) {
    const names = ss.getSheets().map(function (s) { return s.getName(); }).filter(function (n) { return n.indexOf(ERR.PREFIX) === 0; });
    if (!names.length) { ui.alert('مفيش شيت مشاوير (اسمه بيبدأ بـ "' + ERR.PREFIX + '"). اعمل تقرير الأول.'); return; }
    if (names.length === 1) main = names[0];
    else { const r = ui.prompt('تطبيق التعديلات', 'اكتب رقم السيارة (' + names.map(function (n) { return n.slice(ERR.PREFIX.length); }).join(' / ') + '):', ui.ButtonSet.OK_CANCEL); if (r.getSelectedButton() !== ui.Button.OK) return; main = ERR.PREFIX + safeVeh_(r.getResponseText()); if (names.indexOf(main) < 0) { ui.alert('مفيش شيت "' + main + '".'); return; } }
  }
  const vehicle = main.slice(ERR.PREFIX.length);
  if (ui.alert('تطبيق تعديلاتي — مشاوير ' + vehicle, 'هيقرا شيت "' + main + '" بتعديلاتك (الأسماء، الأوقات، المسافة، الصفوف المحذوفة، والغرض/التفاصيل)، يحفظها، ويعيد ترتيب الشيت والملخص. هتتحفظ نسخة قبل كده.\nمتابعة؟', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) { ui.alert('فيه تشغيل تاني شغال دلوقتي. جرّب بعد شوية.'); return; }
  try {
    const sh = ss.getSheetByName(main);
    const bn = 'نسخة مشاوير قبل التعديل ' + vehicle, old = ss.getSheetByName(bn); if (old) ss.deleteSheet(old);
    const bk = sh.copyTo(ss).setName(bn); try { bk.hideSheet(); } catch (e) {}
    const rd = errReadMain_(sh);
    if (!rd.rows.length) throw new Error('مفيش صفوف زيارات في الشيت.');
    const st = errStoreSaveEdits_(ss, vehicle, rd.rows);
    const map = {}, days = [];
    rd.rows.forEach(function (x) { (map[x.meta.d] || (map[x.meta.d] = [])).push(x); });
    Object.keys(map).sort().forEach(function (k) { days.push({ dateKey: k, short: Number(map[k][0].meta.sh) || 0, rows: map[k] }); });
    errWriteMain_(ss, vehicle, days);
    errWriteSummary_(ss, vehicle, days);
    ss.setActiveSheet(ss.getSheetByName(main));
    lock.releaseLock();
    ui.alert('تم تطبيق التعديلات ✔', 'السيارة ' + vehicle + '\nزيارات: ' + rd.rows.length + '\nتعديلات اتحفظت: ' + st.edits + ' • صفوف ممسوحة اتحفظت: ' + st.tombs + '\n(نسخة قبل التعديل مخفية في تبويب "' + bn + '")' + (rd.warn.length ? '\n\nتنبيهات:\n- ' + rd.warn.slice(0, 8).join('\n- ') : ''), ui.ButtonSet.OK);
  } catch (e) { try { lock.releaseLock(); } catch (x) {} ui.alert('ما اتطبقتش التعديلات', String(e && e.message ? e.message : e), ui.ButtonSet.OK); }
}

function errandClearSavedEdits() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  const sh = errStoreSheet_(ss, false);
  const rows = errStoreRows_(sh).filter(function (r) { return r.kind !== 'G'; });
  if (!sh || !rows.length) { ui.alert('مفيش تعديلات مشاوير محفوظة.'); return; }
  const vs = {}; rows.forEach(function (r) { vs[r.v] = (vs[r.v] || 0) + 1; });
  const r = ui.prompt('مسح تعديلات المشاوير المحفوظة', 'محفوظ: ' + Object.keys(vs).map(function (k) { return k + ' (' + vs[k] + ')'; }).join(' / ') + '\nاكتب رقم السيارة، أو * لكل العربيات.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const t = String(r.getResponseText() || '').trim(); if (!t) return;
  const all = t === '*', v = safeVeh_(t), before = errStoreRows_(sh);
  const keep = before.filter(function (x) { return !((all || x.v === v) && x.kind !== 'G'); });
  errStoreWrite_(sh, keep);
  ss.toast('اتمسح ' + (before.length - keep.length) + ' تعديل.', 'التعديلات', 6);
}