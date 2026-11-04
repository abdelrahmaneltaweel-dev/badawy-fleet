---
adr-id: ADR-003
decision-id: D-003
status: accepted
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-003: Google Sheets نسخة احتياطية فقط

**الحالة:** مقبول (Accepted)

## السياق (Context)
المتطلب: يفضل Sheets نسخة احتياطية لو الموقع وقع. حد Sheets 10 مليون خلية للملف.

## القرار (Decision)
Sheets احتياطي فقط (وأداة تحرير بقرار D-030)، والمرجع الأساسي للبيانات Firestore.

## النتائج (Consequences)
النسخة الاحتياطية تُقسَّم شهريًا بسبب حد الخلايا. تنفيذ احتياطي لواجهة Repository (D-009). ما يُضاف لاحقًا يُختبر باستعادة فعلية.

## المراجع
الرؤية §2 و§4 · D-009 · T10.4

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
