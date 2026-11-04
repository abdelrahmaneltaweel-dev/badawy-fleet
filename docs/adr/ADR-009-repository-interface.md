---
adr-id: ADR-009
decision-id: D-009
status: proposed
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-009: واجهة Repository للبيانات

**الحالة:** مقترح (Proposed)

## السياق (Context)
القسم 4 يفصل طبقة البيانات عن المنطق والواجهة.

## القرار (Decision)
Repository interface واحدة (get/list/create/update/delete). التنفيذ الأساسي Firestore والاحتياطي Sheets.

## النتائج (Consequences)
تغيير المخزن = تغيير ملف واحد.

## المراجع
الرؤية §4 · T3.8

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
