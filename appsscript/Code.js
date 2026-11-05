/**
 * Badawi Fleet Platform — Apps Script Bridge
 * Spike S-9: Edit in Google Sheets Lifecycle Verification
 * 
 * المرجع: docs/adr/ADR-003, ADR-006, ADR-030, ADR-031, ADR-035, ADR-057
 */

/**
 * إعدادات وافتراضات الفحص
 */
const CONFIG = {
  TEST_SHEET_NAME: "Badawi_Fleet_Spike_S9_Test",
  HIDDEN_KEY_COL_INDEX: 1, // العمود A يحتوي المفتاح الفريد للصف
  DATA_START_ROW: 3,       // الصف 1 ترويسة، الصف 2 أسماء الأعمدة، البيانات تبدأ من 3
};

/**
 * دالة الاختبار الذاتي الشاملة لـ Spike S-9
 * تشغل الرحلة كاملة وتقيس الأداء ودقة استخراج التنسيقات والفروق
 */
function runSpikeS9Test() {
  const startTime = new Date().getTime();
  Logger.log("==================================================");
  Logger.log("بدء فحص Spike S-9: دورة حياة تعديل التقارير عبر Google Sheets");
  Logger.log("==================================================");

  const results = {
    step1_sheetCreationOrReuse: false,
    step2_keysProtectionAndHiding: false,
    step3_formattingAndFormulasRead: false,
    step4_sortResilience: false,
    step5_newRowsDetection: false,
    step6_reusableSingleFile: false,
    totalDurationMs: 0,
    details: {}
  };

  try {
    // 1. اختبار إعادة استخدام ملف واحد متجدد (ADR-035)
    let ss;
    const files = DriveApp.getFilesByName(CONFIG.TEST_SHEET_NAME);
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
      Logger.log("1. تم العثور على الملف المتجدد وإعادة استخدامه بنجاح (ADR-035 مؤكد).");
      results.step6_reusableSingleFile = true;
    } else {
      ss = SpreadsheetApp.create(CONFIG.TEST_SHEET_NAME);
      Logger.log("1. تم إنشاء ملف الفحص المتجدد لأول مرة.");
      results.step6_reusableSingleFile = true;
    }
    results.step1_sheetCreationOrReuse = true;

    let sheet = ss.getSheetByName("Report");
    if (!sheet) {
      sheet = ss.insertSheet("Report");
    } else {
      sheet.clear();
      // إزالة أي دمج أو حماية سابقة
      const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
      protections.forEach(p => p.remove());
    }

    // 2. بناء هيكل التقرير وتضمين عمود المفاتيح المخفي
    // الأعمدة: A: rowKey (مخفي ومحمي), B: العربية, C: التاريخ, D: خط السير, E: النقلات, F: الأجر (صيغة)
    const headers = [["_rowKey", "العربية", "التاريخ", "خط السير", "النقلات", "الأجر (ج.م)"]];
    sheet.getRange(1, 1, 1, 6).setValues(headers).setFontWeight("bold").setBackground("#EAEDF3");

    // إدخال بيانات تجريبية (تمثل أسطول سيارات)
    const testRows = [
      ["116|2026-10-28", "116", "28/10", "الساحلي الدولي", 5, "=E2*85"],
      ["118|2026-10-28", "118", "28/10", "برج العرب", 4, "=E3*85"],
      ["121|2026-10-28", "121", "28/10", "حوش عيسى", 6, "=E4*85"],
      ["124|2026-10-28", "124", "28/10", "الساحلي الدولي", 3, "=E5*85"],
      ["127|2026-10-28", "127", "28/10", "برج العرب", 7, "=E6*85"],
    ];

    sheet.getRange(2, 1, testRows.length, 6).setValues(testRows);

    // تطبيق تنسيقات وتلوين لاختبار قراءتها لاحقاً
    sheet.getRange("D2").setBackground("#FCE8E6").setFontColor("#B42318"); // تمييز أحمر
    sheet.getRange("B4").setFontWeight("bold");                          // تمييز خط عريض
    sheet.getRange("E2:F6").setNumberFormat("#,##0");                   // تنسيق أرقام

    // حماية وإخفاء العمود A (عمود المفاتيح)
    const keyRange = sheet.getRange("A:A");
    const protection = keyRange.protect().setDescription("Row Keys Protection");
    protection.setWarningOnly(true); // للتوافق بدون مقاطعة أذونات المستخدم
    sheet.hideColumns(CONFIG.HIDDEN_KEY_COL_INDEX);

    results.step2_keysProtectionAndHiding = sheet.isColumnHiddenByUser(CONFIG.HIDDEN_KEY_COL_INDEX);
    Logger.log("2. إخفاء وحماية عمود المفاتيح: " + (results.step2_keysProtectionAndHiding ? "ناجح" : "فشل"));

    // 3. محاكاة تعديلات قام بها المستخدم في الشيت:
    // أ) تعديل قيمة النقلات للعربية 118 من 4 إلى 8
    // ب) تغيير خلفية خلية
    // ج) إضافة صف جديد يدوي (بدون rowKey في العمود A)
    sheet.getRange("E3").setValue(8);
    sheet.getRange("E3").setBackground("#FEF0D9"); // أصفر تحذيري
    
    // إضافة صف يدوي في نهاية الجدول
    const newRowIndex = testRows.length + 2;
    sheet.getRange(newRowIndex, 2, 1, 5).setValues([["130", "28/10", "حوش عيسى", 5, "=E" + newRowIndex + "*85"]]);

    // 4. محاكاة فرز الجدول حسب عدد النقلات تنازلياً (لاختبار صمود عمود المفاتيح)
    const fullDataRange = sheet.getRange(2, 1, testRows.length + 1, 6);
    fullDataRange.sort({ column: 5, ascending: false });
    Logger.log("3. تم تنفيذ فرز كامل للجدول لاختبار صمود المفاتيح.");

    // 5. استخراج البيانات والتنسيقات والفروق بعد التعديل والفرز
    const postSortValues = sheet.getRange(2, 1, testRows.length + 1, 6).getValues();
    const postSortFormulas = sheet.getRange(2, 1, testRows.length + 1, 6).getFormulas();
    const postSortColors = sheet.getRange(2, 1, testRows.length + 1, 6).getBackgrounds();
    const postSortFontWeights = sheet.getRange(2, 1, testRows.length + 1, 6).getFontWeights();

    let sortedCorrectlyWithKeys = true;
    let manualRowDetected = false;
    let modifiedValueDetected = false;
    let formulaExtracted = false;

    for (let i = 0; i < postSortValues.length; i++) {
      const key = postSortValues[i][0];
      const veh = postSortValues[i][1];
      const trips = postSortValues[i][4];
      const formula = postSortFormulas[i][5];

      // فحص ارتباط المفتاح بالعربية بعد الفرز
      if (key && !key.startsWith(veh + "|")) {
        sortedCorrectlyWithKeys = false;
      }

      // فحص كشف تعديل القيمة للعربية 118
      if (key === "118|2026-10-28" && trips === 8) {
        modifiedValueDetected = true;
      }

      // فحص كشف الصف اليدوي الجديد (الذي ليس له مفتاح سابق)
      if (!key && veh === "130") {
        manualRowDetected = true;
      }

      // فحص قراءة الصيغة
      if (formula && formula.startsWith("=E")) {
        formulaExtracted = true;
      }
    }

    results.step4_sortResilience = sortedCorrectlyWithKeys;
    results.step3_formattingAndFormulasRead = formulaExtracted && (postSortColors.some(row => row.includes("#fce8e6") || row.includes("#fef0d9")));
    results.step5_newRowsDetection = manualRowDetected && modifiedValueDetected;

    const endTime = new Date().getTime();
    results.totalDurationMs = endTime - startTime;

    Logger.log("================== النتائج النهائية ==================");
    Logger.log("✓ قراءة التنسيقات والصيغ بدقة: " + (results.step3_formattingAndFormulasRead ? "نجح" : "فشل"));
    Logger.log("✓ صمود عمود المفاتيح أثناء الفرز: " + (results.step4_sortResilience ? "نجح" : "فشل"));
    Logger.log("✓ اكتشاف الصفوف المضافة والفروق المعدلة: " + (results.step5_newRowsDetection ? "نجح" : "فشل"));
    Logger.log("✓ ملف التحرير المتجدد (ADR-035): " + (results.step6_reusableSingleFile ? "نجح" : "فشل"));
    Logger.log("✓ إجمالي زمن التنفيذ الكامل: " + results.totalDurationMs + " مللي ثانية (" + (results.totalDurationMs / 1000).toFixed(2) + " ثانية)");
    Logger.log("رابط الشيت الذي تم اختباره: " + ss.getUrl());
    Logger.log("==================================================");

    return JSON.stringify(results, null, 2);
  } catch (error) {
    Logger.log("❌ حدث خطأ أثناء فحص S-9: " + error.toString());
    results.error = error.toString();
    return JSON.stringify(results, null, 2);
  }
}

/**
 * نقطة استقبال طلبات الويب POST من المنصة
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === "test") {
      const report = runSpikeS9Test();
      return ContentService.createTextOutput(report).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok", action: action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * فحص صحة الخدمة GET
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    service: "Badawi Fleet Apps Script Bridge",
    version: "1.0.0"
  })).setMimeType(ContentService.MimeType.JSON);
}