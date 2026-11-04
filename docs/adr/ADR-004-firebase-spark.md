---
adr-id: ADR-004
decision-id: D-004
status: proposed
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-004: Firebase على Spark بدون كارت (Auth + Firestore)

**الحالة:** مقترح (Proposed)

## السياق (Context)
المطلوب مجاني ومستدام بلا كارت وبلا احتمال فاتورة. حصص Spark (تقريبية): 1 جيجا، 50 ألف قراءة و20 ألف كتابة يوميًا، والزيادة توقف الخدمة ولا تُحاسب. Auth: 50 ألف مستخدم نشط شهريًا.

## القرار (Decision)
Firebase على خطة Spark فقط (Auth + Firestore + Rules) من غير بطاقة.

## النتائج (Consequences)
كل ميزة تحسب أثرها على القراءات والكتابات. Cloud Functions وStorage وExtensions ممنوعة (تحتاج Blaze). الحصص تُراجع بالبحث قبل الاعتماد. **القرار مشروط بنتيجة Spike S-2 (T1.2)**.

## المراجع
الرؤية §4 · D-010 · S-2 · T1.2 · T1.3 · T1.7

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
