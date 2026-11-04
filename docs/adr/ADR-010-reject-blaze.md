---
adr-id: ADR-010
decision-id: D-010
status: proposed
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-010: رفض Blaze نهائيًا

**الحالة:** مقترح (Proposed)

## السياق (Context)
خطة Blaze ليس فيها حد صرف صارم، والمطلب عدم وجود أي احتمال فاتورة.

## القرار (Decision)
لا يُستخدم Blaze.

## النتائج (Consequences)
تُستبعد Cloud Functions وStorage وExtensions، ما يترتب عليه D-020 (لا صور) وعدم تخزين ملفات Petro وعدم رفع خطوط مخصصة.

## المراجع
الرؤية §4 · الإطار §1 · D-004 · D-020

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
