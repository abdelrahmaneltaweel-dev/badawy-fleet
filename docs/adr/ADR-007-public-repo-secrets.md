---
adr-id: ADR-007
decision-id: D-007
status: accepted
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-007: ريبو عام جديد وقواعد الأسرار

**الحالة:** مقبول (Accepted)

## السياق (Context)
الريبو عام فيجب أن يستحيل تسرب الأسرار والبيانات. الكود القديم فيه عنوان Traccar ظاهر في main.gs.

## القرار (Decision)
ريبو جديد من الصفر والقديم يُؤرشف خاصًا. الأسرار في GitHub Secrets وScript Properties فقط. يُمنع في الريبو: إحداثيات المواقع، أرقام الأجهزة، أرقام واتساب/إيميلات، التوكنات، أي تصدير بيانات. تُفعَّل Secret Scanning وPush Protection وpre-commit و.gitignore.

## النتائج (Consequences)
لو كانت أسرار قد وُضعت قبل ذلك يُغيَّر توكن Traccar. الكود القديم ووثيقة التشغيل يُستخدمان داخل المحادثة فقط ولا يُرفعان. يغطي القرار SECURITY.md وفحص T11.1.

## المراجع
الرؤية §5 · SECURITY.md · T0.1 · T0.2 · T0.5 · T11.1

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
