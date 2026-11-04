---
adr-id: ADR-005
decision-id: D-005
status: proposed
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-005: GitHub Actions كـ Worker بدل Apps Script للشغل التقيل

**الحالة:** مقترح (Proposed)

## السياق (Context)
مع 65 عربية تصبح حصص Apps Script العادي هي العنق (90 دقيقة triggers/يوم، 20 ألف UrlFetch، 30 تنفيذ متزامن). Pages عام فلا تُحفظ عليه بيانات حية. Traccar على HTTP فلا يستطيع المتصفح مخاطبته.

## القرار (Decision)
Worker على GitHub Actions (cron + Node): يسحب من Traccar ويحسب ويكتب التغييرات فقط في Firestore.

## النتائج (Consequences)
الاعتماد على وصول الـ runners لـ Traccar ودقة cron وزمن تحليل 65 عربية. **مشروط بـ S-1 وS-4 (T1.1، T1.4)**؛ البديل المذكور في الإطار: Worker على خدمة مجانية أخرى أو جهاز المالك.

## المراجع
الرؤية §4 · S-1 · S-4 · T1.1 · T1.4 · T5.2

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
