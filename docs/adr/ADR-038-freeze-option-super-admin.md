---
adr-id: ADR-038
decision-id: D-038
status: accepted
introducedIn: 0.4.1
decisionDate: 2026-11-02
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-038: خيار التجميد إعداد للـ Super Admin فقط

**الحالة:** مقبول (Accepted)

## السياق (Context)
ليس كل إغلاق يحتاج تجميد القيم.

## القرار (Decision)
خيار التجميد (مفعّل/معطّل) يغيّره الـ Super Admin وحده، والافتراضي مفعّل.

## النتائج (Consequences)
لو عُطّل، الإغلاق يوسم الفترة فقط دون تجميد القيم.

## المراجع
الرؤية §2-ي · D-036 · T8.5

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
