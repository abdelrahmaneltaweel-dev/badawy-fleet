---
adr-id: ADR-018
decision-id: D-018
status: accepted
introducedIn: 0.3.0
decisionDate: 2026-11-01
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-018: الإدخال بالنيابة بسجل

**الحالة:** مقبول (Accepted)

## السياق (Context)
الـ Super Admin قد يحتاج إدخال بيان أو رد مكان مستخدم.

## القرار (Decision)
يستطيع الـ Super Admin إدخال أو تعديل أي بيان أو رد مكان أي مستخدم مؤقتًا، مع تسجيل enteredBy وonBehalfOf.

## النتائج (Consequences)
كل سجل يحمل الحقلين. سجل المراجعة (AuditLog) يحفظ المنفّذ والنيابة والقبل/بعد.

## المراجع
الرؤية §2-ب و§2-ج · T3.7 · T7.2

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
