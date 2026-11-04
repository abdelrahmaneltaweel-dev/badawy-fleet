---
adr-id: ADR-054
decision-id: D-054
status: accepted
introducedIn: 0.5.0
decisionDate: 2026-11-02
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-054: إلغاء Outbox الإيميل وS-5

**الحالة:** مقبول (Accepted)

## السياق (Context)
D-011 (النسخة 0.2.1) كان يتضمن إيميلًا عبر Outbox في Firestore يقرأه Apps Script.

## القرار (Decision)
إلغاء Outbox الإيميل واختباره S-5. دور Apps Script جسر Google Sheets والنسخة الاحتياطية فقط.

## النتائج (Consequences)
لا إيميل ولا منطق عمل في Apps Script. يُلغي الجزء الخاص بالإيميل من D-011 ويؤكد D-006.

## المراجع
الرؤية §1 و§7 · D-006 · D-011

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
