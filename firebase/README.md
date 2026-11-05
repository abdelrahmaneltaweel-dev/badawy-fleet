# firebase

قواعد Firestore الأمنية، فهارس الاستعلامات، ودليل المخطط، واختبارات الـ Rules.

## الملفات
- `firestore.rules`: قواعد الأمان الإنتاجية الصارمة (رفض الكل افتراضياً، فحص الصلاحيات بـ Custom Claims بتكلفة 0 قراءات، تأمين الفترات المقفولة).
- `SCHEMA.md`: التوثيق المعماري الكامل لـ 12 مجموعة في Firestore.

> المرجع: `docs/PROJECT_FRAMEWORK.md` و`docs/adr/ADR-013-single-link-permissions-view.md`