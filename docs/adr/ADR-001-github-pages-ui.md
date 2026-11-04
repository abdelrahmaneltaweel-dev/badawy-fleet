---
adr-id: ADR-001
decision-id: D-001
status: accepted
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-001: الواجهة على GitHub Pages

**الحالة:** مقبول (Accepted)

## السياق (Context)
المطلوب واجهة مجانية على GitHub Pages، وهو موقع ثابت وعام.

## القرار (Decision)
الواجهة تُنشر كموقع ثابت على GitHub Pages، والنشر من tag فقط.

## النتائج (Consequences)
لا توضع بيانات حية على Pages لأنه عام (البيانات في Firebase بصلاحيات). الرجوع لنسخة سابقة = إعادة نشر tag قديم.

## المراجع
الرؤية §2 و§4 و§6 · T0.5 · T2.1

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
