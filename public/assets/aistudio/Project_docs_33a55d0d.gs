/* ═══════════════════════════════════════════════════════════════════════════
   Project Docs.gs — بيفتح صفحة "حالة المشروع" (ملف Project Status.html الموجود في نفس المشروع)
   الزرار: Badawy Group ▸ 📘 حالة المشروع
   ملحوظة: الصفحة بتتفتح كنافذة جوه الشيت. تحديث الصفحة = استبدال ملف Project Status.html بس (من غير أي تعديل هنا).
   ═══════════════════════════════════════════════════════════════════════════ */
const PROJECT_DOC = { FILE: 'Project Status', TITLE: '📘 حالة المشروع', W: 1100, H: 720 };

function showProjectStatus() {
  const ui = SpreadsheetApp.getUi();
  let out;
  try { out = HtmlService.createHtmlOutputFromFile(PROJECT_DOC.FILE); }
  catch (e) { ui.alert('مش لاقي ملف "' + PROJECT_DOC.FILE + '.html" في المشروع.\nارفعه (File ▸ HTML) باسم "' + PROJECT_DOC.FILE + '" وجرّب تاني.'); return; }
  ui.showModalDialog(out.setWidth(PROJECT_DOC.W).setHeight(PROJECT_DOC.H), PROJECT_DOC.TITLE);
}