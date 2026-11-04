---
adr-id: ADR-008
decision-id: D-008
status: accepted
introducedIn: 0.2.0
decisionDate: 2026-10-31
sourceVision: 1.0.0
lastUpdated: 2026-11-04
---

# ADR-008: Version control على كل المكونات

**الحالة:** مقبول (Accepted)

## السياق (Context)
القسم 6 من الرؤية يحدد سياسة الإصدارات.

## القرار (Decision)
كل شيء له إصدار: الكود SemVer مع tags وChangelog، الوثائق بـ doc-id وversion، القرارات ADR، الـ API بـ apiVersion، المخطط بـ schemaVersion مع migrations، القواعد بـ rulesVersion، نظام التصميم SemVer للـ tokens، قواعد Firestore تُنشر من CI فقط، والإطار بـ frameworkVersion.

## النتائج (Consequences)
النشر على Pages من tag فقط. القرار لا يُعدَّل بل يُلغى بقرار أحدث. كل تقرير يسجل rulesVersion الذي ولّده.

## المراجع
الرؤية §6 · الإطار §6 · T0.5 · T3.1

> مستخلص من سجل القرارات في `docs/vision/Project-Vision-v1.0.0.html` (القسم 7). الملف لا يُعدَّل بعد قبوله؛ التغيير بقرار أحدث يلغيه.
