---
adr-id: ADR-006
decision-id: D-006
status: accepted
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-05
---

# ADR-006: Apps Script لجسر Google Sheets والنسخة الاحتياطية فقط

**الحالة:** مقبول (Accepted)

## السياق (Context)
نقل المعالجة الثقيلة وسحب البيانات إلى GitHub Actions يحرر حصص Google Apps Script تماماً.

## القرار (Decision)
قصر دور Google Apps Script على مهام محددة وخفيفة:
1. جسر الاتصال بـ Google Sheets لفتح التقارير للتعديل وقراءتها عند الإنهاء (Edit in Google Sheets).
2. تشغيل النسخ الاحتياطي الدوري الأسبوعي إلى Google Sheets.
يُمنع وضع منطق أعمال ثقيل أو دوال إرسال بريد إلكتروني داخل Apps Script.

## نتائج التحقق (Consequences)
- تم إثبات عمل وسرعة جسر Apps Script بدقة 100% في **Spike S-9 (T1.8)** بزمن تنفيذ 4.08 ثانية دون استهلاك حصص.
- تم اعتماد القرار ونقله رسمياً من "مقترح" إلى "مقبول".

## المراجع
- الرؤية §4
- Spike S-9 (T1.8)
- ADR-005, ADR-030, ADR-035, ADR-054