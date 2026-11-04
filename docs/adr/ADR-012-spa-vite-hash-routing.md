---
adr-id: ADR-012
decision-id: D-012
status: accepted
introducedIn: 0.2.1
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-012: الواجهة SPA بـ Vite وhash routing وcode-splitting

**الحالة:** مقبول (Accepted)

## السياق (Context)
النشر على Pages ثابت ويحتاج تحميل كل شاشة عند الدخول عليها فقط.

## القرار (Decision)
SPA بـ Vite وhash routing وcode-splitting، والنشر من Actions.

## النتائج (Consequences)
إطار الواجهة حُسم لاحقًا في D-053 (Preact).

## المراجع
الرؤية §4 · D-053 · T2.1

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
