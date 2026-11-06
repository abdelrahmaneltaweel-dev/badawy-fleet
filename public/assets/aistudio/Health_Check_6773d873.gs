/* عدّاد خلايا الملف (كل الشيتات حتى المخفية) مقابل حد Google Sheets = 10 مليون خلية.
   التشغيل: من محرر Apps Script اختار cellCount ثم Run، والنتيجة في Execution log. */
function cellCount() {
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  const rows = sheets.map(function (sh) {
    let hidden = false; try { hidden = sh.isSheetHidden(); } catch (e) {}
    return { name: sh.getName(), hidden: hidden, cells: sh.getMaxRows() * sh.getMaxColumns() };
  }).sort(function (a, b) { return b.cells - a.cells; });
  const total = rows.reduce(function (s, r) { return s + r.cells; }, 0);
  const fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  Logger.log('الإجمالي: ' + fmt(total) + ' من 10,000,000 (' + (total / 1e5).toFixed(2) + '%) — متبقي ' + fmt(10000000 - total));
  rows.forEach(function (r) { Logger.log((r.hidden ? '[مخفي] ' : '') + r.name + ': ' + fmt(r.cells)); });
}