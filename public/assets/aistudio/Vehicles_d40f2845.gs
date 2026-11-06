/* ═══════════════════════════════════════════════════════════════════════════
   Vehicles.gs — إدارة المركبات في شيت "Devices Naming Connection"
   القائمة: Badawy Group ▸ GPS Tracking System ▸ Vehicles ▸ Add Vehicle / Remove Vehicle
   أعمدة الشيت: A = رقم الـ GPS (الجهاز) | B = رقم المركبة | C = الاسم/الرقم الداخلي (اللي بتكتبه في نوافذ التقارير)
   ═══════════════════════════════════════════════════════════════════════════ */
const VEH = { SHEET: 'Devices Naming Connection', HEAD: ['رقم الـ GPS', 'رقم المركبة', 'الاسم / الرقم الداخلي'] };

function vehSheet_(ss, create) {
  let sh = ss.getSheetByName(VEH.SHEET);
  if (!sh && create) {
    sh = ss.insertSheet(VEH.SHEET);
    sh.getRange(1, 1, 1, 3).setValues([VEH.HEAD]).setBackground('#3d85c6').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
  }
  return sh;
}
function vehClean_(v) { return stmtTxt_(stmtDigits_(v)); }

// كل المركبات: [{row, a, b, c}] (صفوف فيها حاجة في A أو B أو C)
function vehList_(sh) {
  const out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r, i) {
    const a = vehClean_(r[0]), b = vehClean_(r[1]), c = vehClean_(r[2]);
    if (a || b || c) out.push({ row: i + 2, a: a, b: b, c: c });
  });
  return out;
}
function vehLabel_(x) { return (x.c || x.b || ('جهاز ' + x.a)) + (x.b && x.c ? ' — مركبة ' + x.b : '') + (x.a ? ' (GPS ' + x.a + ')' : ''); }

function vehOpenAdd() { SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(vehFormHtml_('add', [])).setWidth(420).setHeight(420), 'Add Vehicle'); }
function vehOpenRemove() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = vehSheet_(ss, false);
  const list = vehList_(sh).map(function (x) { return { k: x.a + '|' + x.c, t: vehLabel_(x) }; });
  if (!list.length) { SpreadsheetApp.getUi().alert('مفيش مركبات في شيت "' + VEH.SHEET + '".'); return; }
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(vehFormHtml_('remove', list)).setWidth(440).setHeight(300), 'Remove Vehicle');
}

function vehAdd(p) {
  const a = vehClean_(p && p.a), b = vehClean_(p && p.b), c = vehClean_(p && p.c);
  if (!a) throw new Error('اكتب رقم الـ GPS');
  if (!/^\d+$/.test(a)) throw new Error('رقم الـ GPS لازم يكون أرقام بس (هو الرقم اللي في أول اسم الجهاز في المنصة).');
  if (!b) throw new Error('اكتب رقم المركبة');
  if (!c) throw new Error('اكتب الاسم الداخلي');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = vehSheet_(ss, true), list = vehList_(sh);
    const dupC = list.filter(function (x) { return x.c === c; })[0];
    if (dupC) throw new Error('الاسم الداخلي "' + c + '" موجود قبل كده (GPS ' + dupC.a + ').');
    const dupA = list.filter(function (x) { return x.a === a; })[0];
    if (dupA) throw new Error('رقم الـ GPS ' + a + ' مربوط قبل كده بـ "' + (dupA.c || dupA.b) + '".');
    let last = 1;
    sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 3).getValues().forEach(function (r, i) { if (r.some(function (v) { return String(v).trim() !== ''; })) last = i + 1; });
    const row = last + 1;
    ensureGrid_(sh, row, 3);
    sh.getRange(row, 1, 1, 3).setValues([[Number(a), b, c]]).setHorizontalAlignment('center');
    return { ok: true, msg: 'تم الحفظ ✔ ' + c + ' (GPS ' + a + ', مركبة ' + b + ')' };
  } finally { lock.releaseLock(); }
}

// key = "<رقم GPS>|<الاسم الداخلي>"
function vehRemove(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = vehSheet_(ss, false);
    if (!sh) throw new Error('مش لاقي شيت "' + VEH.SHEET + '".');
    const i = String(key).indexOf('|'), a = String(key).slice(0, i), c = String(key).slice(i + 1);
    const hit = vehList_(sh).filter(function (x) { return x.a === a && x.c === c; })[0];
    if (!hit) throw new Error('المركبة دي مش موجودة في الشيت (يمكن اتحذفت).');
    sh.deleteRow(hit.row);
    const list = vehList_(sh).map(function (x) { return { k: x.a + '|' + x.c, t: vehLabel_(x) }; });
    return { ok: true, msg: 'تم حذف ' + (hit.c || hit.b || hit.a) + ' ✔', list: list };
  } finally { lock.releaseLock(); }
}

function vehFormHtml_(kind, list) {
  const css = 'body{font-family:Arial,sans-serif;margin:14px;color:#222}label{display:block;margin:10px 0 3px;font-size:13px;color:#444}' +
    'input,select{width:100%;box-sizing:border-box;padding:8px;font-size:15px;border:1px solid #bbb;border-radius:4px;font-family:inherit}' +
    'button{margin-top:14px;width:100%;padding:9px;font-size:15px;color:#fff;border:0;border-radius:4px;cursor:pointer}button:disabled{opacity:.6}' +
    '#go{background:#1a73e8}#go.del{background:#c5221f}#cl{background:#fff;color:#555;border:1px solid #bbb;margin-top:8px}' +
    '#msg{margin-top:12px;font-size:13px;color:#b00;white-space:pre-wrap}#msg.ok{color:#137333;font-weight:bold;font-size:14px}';
  const add = kind === 'add';
  const body = '<form id="f">' + (add ?
    '<label>رقم الـ GPS (الرقم اللي في أول اسم الجهاز في المنصة)</label><input id="a" autofocus autocomplete="off" inputmode="numeric">' +
    '<label>رقم المركبة</label><input id="b" autocomplete="off">' +
    '<label>الاسم / الرقم الداخلي (اللي بتكتبه في نوافذ التقارير)</label><input id="c" autocomplete="off">' +
    '<button id="go" type="submit">حفظ</button>' :
    '<label>اختار المركبة</label><select id="s"></select><button id="go" class="del" type="submit">حذف</button>') +
    '<button id="cl" type="button">إغلاق</button><div id="msg"></div></form>';
  const js = 'var KIND=' + JSON.stringify(kind) + ',LIST=' + JSON.stringify(list || []) + ';function $(i){return document.getElementById(i);}' +
    'function fill(l){var s=$("s");if(!s)return;s.innerHTML="";l.forEach(function(x){var o=document.createElement("option");o.value=x.k;o.textContent=x.t;s.appendChild(o);});$("go").disabled=!l.length;}' +
    'function er(err){$("go").disabled=false;$("msg").className="";$("msg").textContent=(err&&err.message)?err.message.replace(/^Exception: /,""):String(err);}' +
    'if(KIND==="remove")fill(LIST);' +
    '$("f").addEventListener("submit",function(e){e.preventDefault();$("msg").className="";' +
    'if(KIND==="add"){var p={a:$("a").value,b:$("b").value,c:$("c").value};$("go").disabled=true;$("msg").textContent="جاري الحفظ…";' +
    'google.script.run.withSuccessHandler(function(r){$("go").disabled=false;["a","b","c"].forEach(function(i){$(i).value="";});$("msg").className="ok";$("msg").textContent=r.msg;$("a").focus();}).withFailureHandler(er).vehAdd(p);}' +
    'else{var s=$("s");if(!s.value)return;var t=s.options[s.selectedIndex].textContent;if(!confirm("تحذف المركبة: "+t+" ؟"))return;$("go").disabled=true;$("msg").textContent="جاري الحذف…";' +
    'google.script.run.withSuccessHandler(function(r){fill(r.list);$("msg").className="ok";$("msg").textContent=r.msg;}).withFailureHandler(er).vehRemove(s.value);}});' +
    '$("cl").addEventListener("click",function(){google.script.host.close();});';
  return '<!DOCTYPE html><html dir="rtl"><head><base target="_top"><meta charset="utf-8"><style>' + css + '</style></head><body>' + body + '<script>' + js + '</script></body></html>';
}