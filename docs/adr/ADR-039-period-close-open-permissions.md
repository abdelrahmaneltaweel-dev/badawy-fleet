---
adr-id: ADR-039
decision-id: D-039
status: accepted
introducedIn: 0.4.1
decisionDate: 2026-11-02
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-039: صلاحيتا period.close وperiod.open منفصلتان

**الحالة:** مقبول (Accepted)

## السياق (Context)
الإغلاق والفتح لهما أثر مختلف على المرتبات.

## القرار (Decision)
period.close وperiod.open صلاحيتان منفصلتان قابلتان للمنح والسحب من المنصة.

## النتائج (Consequences)
الـ Super Admin وحده يملكهما افتراضيًا (الإطار §1).

## المراجع
الإطار §1 · D-036 · T8.5

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
