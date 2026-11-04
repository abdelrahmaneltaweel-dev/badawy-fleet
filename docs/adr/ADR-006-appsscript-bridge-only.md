---
adr-id: ADR-006
decision-id: D-006
status: proposed
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-006: Apps Script لجسر Google Sheets والنسخة الاحتياطية فقط

**الحالة:** مقترح (Proposed)

## السياق (Context)
حصص Apps Script تمنع استخدامه للشغل التقيل (D-005).

## القرار (Decision)
Apps Script جسر لـ Google Sheets (تعديل التقارير) ولنسخة Sheets الاحتياطية فقط.

## النتائج (Consequences)
لا منطق عمل ولا إيميل فيه (انظر D-054). الأسرار في Script Properties.

## المراجع
الرؤية §4 · D-005 · D-054 · T8.3 · T10.4

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
