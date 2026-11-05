---
doc-id: ADR-INDEX
version: 1.1.0
lastUpdated: 2026-11-05
sourceVision: 1.0.0
---

# سجل القرارات المعمارية (ADR)

كل قرار D-001…D-060 في الرؤية المجمّدة `1.0.0` له هنا ملف ADR (`ADR-0NN` = `D-0NN`).

## القواعد
- الملف لا يُعدَّل بعد قبوله. التغيير بقرار أحدث: ملف ADR جديد (الرقم التالي: `ADR-061`) يُحدَّث فيه الجدول أدناه، وتُوسَم الحالة في القرار القديم بـ `superseded` مع رابط.
- أي قرار جديد = ADR + سطر في سجل القرارات + إصدار جديد للرؤية (`1.x`)، ويُحدَّث `CHANGELOG.md`.
- القالب: `0000-template.md`.
- الحالات: `accepted` متفق عليه · `proposed` مقترح لم يُحسم · `superseded` أُلغي بقرار أحدث · `deprecated` متروك.

## حالة القرارات بعد إتمام المرحلة M1
تم حسم كافة القرارات المقترحة والمشروطة بالـ Spikes بنجاح تام، وأصبحت **جميع القرارات من 001 إلى 060 مقبولة ومعتمدة بنسبة 100%**:
- **ADR-004 (Firebase Spark):** معتمد بعد نجاح S-2 (T1.2) وS-6 (T1.3).
- **ADR-005 (GitHub Actions Worker):** معتمد بعد نجاح S-1 (T1.1) وS-4 (T1.4).
- **ADR-006 (Apps Script Bridge Only):** معتمد بعد نجاح S-9 (T1.8).
- **ADR-009 (Repository Interface):** معتمد لفصل طبقة البيانات عن التخزين.
- **ADR-010 (Reject Blaze):** معتمد لضمان استدامة الخطة المجانية بدون أي كارت.
- **ADR-020 (No Images in v1):** معتمد لحماية حصة التخزين المجانية.
- **ADR-023 (Traccar Readonly & 12M Window):** معتمد بعد نجاح S-3 (T1.5).
- **ADR-026 (Open License Arabic Font):** معتمد ومحدد بـ IBM Plex Sans Arabic.
- **ADR-035 (Single Reusable Edit File):** معتمد بعد نجاح S-9 (T1.8).
- **ADR-045 (Curated Fonts List):** معتمد ومحدد بـ 4 خطوط منتقاة (D-058).

## ملاحظات ربط
- **ADR-011** يلغيه جزئيًا **ADR-054** (جزء Outbox الإيميل فقط)؛ جزء wa.me ساري.
- **ADR-026 ← ADR-045 ← ADR-058**: الخط الافتراضي ثم القائمة المنتقاة ثم تحديدها بـ 4 خطوط.
- **ADR-036 ← ADR-038 وADR-039**: الإغلاق ثم خيار التجميد ثم صلاحيتا الإغلاق/الفتح.
- **ADR-012 ← ADR-053**: Vite SPA ثم اختيار Preact.
- ترتيب D-037 في جدول الرؤية بعد D-060 (ترتيب عرض فقط)؛ تاريخ إدخاله في 0.4.0.

## الفهرس
| ADR | القرار | العنوان | الحالة | أُدخل في |
|---|---|---|---|---|
| [ADR-001](ADR-001-github-pages-ui.md) | D-001 | الواجهة على GitHub Pages | accepted | 0.2.0 |
| [ADR-002](ADR-002-drop-looker-studio.md) | D-002 | التخلي عن Looker Studio | accepted | 0.2.0 |
| [ADR-003](ADR-003-sheets-backup-only.md) | D-003 | Google Sheets نسخة احتياطية فقط | accepted | 0.2.0 |
| [ADR-004](ADR-004-firebase-spark.md) | D-004 | Firebase على Spark بدون كارت (Auth + Firestore) | accepted | 0.2.0 |
| [ADR-005](ADR-005-actions-worker.md) | D-005 | GitHub Actions كـ Worker بدل Apps Script للشغل التقيل | accepted | 0.2.0 |
| [ADR-006](ADR-006-appsscript-bridge-only.md) | D-006 | Apps Script لجسر Google Sheets والنسخة الاحتياطية فقط | accepted | 0.2.0 |
| [ADR-007](ADR-007-public-repo-secrets.md) | D-007 | ريبو عام جديد وقواعد الأسرار | accepted | 0.2.0 |
| [ADR-008](ADR-008-version-control-everything.md) | D-008 | Version control على كل المكونات | accepted | 0.2.0 |
| [ADR-009](ADR-009-repository-interface.md) | D-009 | واجهة Repository للبيانات | accepted | 0.2.0 |
| [ADR-010](ADR-010-reject-blaze.md) | D-010 | رفض Blaze نهائيًا | accepted | 0.2.0 |
| [ADR-011](ADR-011-whatsapp-wa-me.md) | D-011 | واتساب بروابط wa.me فقط (يدوي) | accepted | 0.2.1 |
| [ADR-012](ADR-012-spa-vite-hash-routing.md) | D-012 | الواجهة SPA بـ Vite وhash routing وcode-splitting | accepted | 0.2.1 |
| [ADR-013](ADR-013-single-link-permissions-view.md) | D-013 | لينك واحد وصفحة واحدة والعرض حسب الصلاحيات | accepted | 0.3.0 |
| [ADR-014](ADR-014-pwa-responsive.md) | D-014 | PWA قابلة للتثبيت وتصميم متجاوب بالكامل | accepted | 0.3.0 |
| [ADR-015](ADR-015-config-as-data.md) | D-015 | Config as Data | accepted | 0.3.0 |
| [ADR-016](ADR-016-vehicle-id-assignments.md) | D-016 | Vehicle بمعرّف ثابت وAssignment بتواريخ | accepted | 0.3.0 |
| [ADR-017](ADR-017-unified-inquiry.md) | D-017 | Inquiry موحد بخيارات رد قابلة للتعديل | accepted | 0.3.0 |
| [ADR-018](ADR-018-on-behalf-entry.md) | D-018 | الإدخال بالنيابة بسجل | accepted | 0.3.0 |
| [ADR-019](ADR-019-gps-issues-only.md) | D-019 | المشاكل = مشاكل GPS فقط | accepted | 0.3.0 |
| [ADR-020](ADR-020-no-images-v1.md) | D-020 | لا صور في النسخة الأولى | accepted | 0.3.0 |
| [ADR-021](ADR-021-petro-requests-no-api.md) | D-021 | طلب العهدة (Petro) داخل المنصة بدون API | accepted | 0.3.1 |
| [ADR-022](ADR-022-data-lifecycle-policy.md) | D-022 | سياسة دورة حياة البيانات وإدارة الموارد | accepted | 0.3.1 |
| [ADR-023](ADR-023-traccar-readonly-12m-window.md) | D-023 | مستخدم Traccar قراءة فقط وإعادة الحساب بنافذة 12 شهرًا على دفعات | accepted | 0.3.1 |
| [ADR-024](ADR-024-visual-identity.md) | D-024 | الهوية البصرية: Badawi Group ولوحة الألوان | accepted | 0.3.2 |
| [ADR-025](ADR-025-english-numerals.md) | D-025 | الأرقام في الواجهة إنجليزي | accepted | 0.3.2 |
| [ADR-026](ADR-026-open-license-arabic-font.md) | D-026 | خط عربي مفتوح الترخيص (IBM Plex Sans Arabic) مستضاف في الريبو | accepted | 0.3.2 |
| [ADR-027](ADR-027-custom-select-component.md) | D-027 | قوائم الاختيار مكوّن مخصّص (نافذة سفلية على الموبايل) | accepted | 0.4.0 |
| [ADR-028](ADR-028-motion-rules.md) | D-028 | قواعد الحركة | accepted | 0.4.0 |
| [ADR-029](ADR-029-calm-design-direction.md) | D-029 | اتجاه التصميم الهادئ | accepted | 0.4.0 |
| [ADR-030](ADR-030-report-editing-via-sheets.md) | D-030 | إلغاء محرر التقارير الداخلي والتعديل عبر Google Sheets مع End Editing | accepted | 0.4.0 |
| [ADR-031](ADR-031-end-editing-review-window.md) | D-031 | نافذة مراجعة التغييرات عند الإنهاء | accepted | 0.4.0 |
| [ADR-032](ADR-032-report-edit-permission.md) | D-032 | صلاحية report.edit | accepted | 0.4.0 |
| [ADR-033](ADR-033-reports-settings-control.md) | D-033 | التحكم الكامل من الإعدادات للتقارير | accepted | 0.4.0 |
| [ADR-034](ADR-034-report-viewer-layers.md) | D-034 | عارض التقارير يطبّق التخطيط المحفوظ بطبقات | accepted | 0.4.0 |
| [ADR-035](ADR-035-single-reusable-edit-file.md) | D-035 | ملف تحرير واحد يتجدد بدل ملف جديد لكل جلسة | accepted | 0.4.0 |
| [ADR-036](ADR-036-period-close-freeze.md) | D-036 | إغلاق الفترات المعتمدة وتجميد قيمها | accepted | 0.4.0 |
| [ADR-037](ADR-037-table-numbering-sticky-column.md) | D-037 | عمود الترقيم والمجموع وتثبيت العمود الأول في الجداول الكبيرة على الموبايل | accepted | 0.4.0 |
| [ADR-038](ADR-038-freeze-option-super-admin.md) | D-038 | خيار التجميد إعداد للـ Super Admin فقط | accepted | 0.4.1 |
| [ADR-039](ADR-039-period-close-open-permissions.md) | D-039 | صلاحيتا period.close وperiod.open منفصلتان | accepted | 0.4.1 |
| [ADR-040](ADR-040-settings-first.md) | D-040 | الإعدادات أولًا (Settings-first) | accepted | 0.4.2 |
| [ADR-041](ADR-041-calendar-period-cycle.md) | D-041 | دورة الفترة تقويمية افتراضيًا وقابلة للتعديل | accepted | 0.4.2 |
| [ADR-042](ADR-042-adjustments-auto-carry.md) | D-042 | التسويات للفترات المقفولة تُضاف تلقائيًا لأول فترة مفتوحة | accepted | 0.4.2 |
| [ADR-043](ADR-043-compare-with-current.md) | D-043 | زر «قارن مع الحالي» وإنشاء تسوية من كل فرق | accepted | 0.4.2 |
| [ADR-044](ADR-044-settings-protection-limits.md) | D-044 | حدود حماية الإعدادات | accepted | 0.4.2 |
| [ADR-045](ADR-045-curated-fonts-list.md) | D-045 | الخطوط: قائمة منتقاة مفتوحة الترخيص مستضافة في الريبو | accepted | 0.4.2 |
| [ADR-046](ADR-046-adjustment-permissions.md) | D-046 | صلاحيتا adjustment.create وadjustment.approve | accepted | 0.4.2 |
| [ADR-047](ADR-047-bulk-vehicle-import.md) | D-047 | استيراد جماعي للعربيات بلصق جدول Excel مع مراجعة قبل الحفظ | accepted | 0.5.0 |
| [ADR-048](ADR-048-data-source-traccar-or-excel.md) | D-048 | مصدر البيانات: سحب Traccar وبديله رفع Excel الخام | accepted | 0.5.0 |
| [ADR-049](ADR-049-refresh-rate-write-guard.md) | D-049 | معدل التحديث من الإعدادات مع حماية حد الكتابة | accepted | 0.5.0 |
| [ADR-050](ADR-050-driver-screens.md) | D-050 | شاشات السائق | accepted | 0.5.0 |
| [ADR-051](ADR-051-estimated-vs-final-prices.md) | D-051 | أسعار الفترة المفتوحة «تقديري» والمقفولة نهائية | accepted | 0.5.0 |
| [ADR-052](ADR-052-launch-with-no-vehicles.md) | D-052 | الإطلاق يبدأ بلا عربيات والمسؤول يُضيفها | accepted | 0.5.0 |
| [ADR-053](ADR-053-preact-with-vite.md) | D-053 | إطار الواجهة: Preact مع Vite | accepted | 0.5.0 |
| [ADR-054](ADR-054-cancel-email-outbox.md) | D-054 | إلغاء Outbox الإيميل وS-5 | accepted | 0.5.0 |
| [ADR-055](ADR-055-dst-conversion-dates.md) | D-055 | التوقيت الصيفي والشتوي بتواريخ تحويل قابلة للتعديل | accepted | 0.5.0 |
| [ADR-056](ADR-056-retention-numbers.md) | D-056 | أرقام الاحتفاظ | accepted | 0.5.0 |
| [ADR-057](ADR-057-calculated-columns.md) | D-057 | الأعمدة المحسوبة وترجمة صيغ Sheets البسيطة | accepted | 0.5.0 |
| [ADR-058](ADR-058-four-fonts-pdf-on-close.md) | D-058 | 4 خطوط عربية منتقاة وPDF عند الإغلاق بزر طباعة | accepted | 0.5.0 |
| [ADR-059](ADR-059-six-dashboard-cards.md) | D-059 | بطاقات الداشبورد الست | accepted | 0.5.0 |
| [ADR-060](ADR-060-driver-entry-supporting-statement.md) | D-060 | إدخال السائق لنقلاته بيان مساند والاحتساب الأساسي من الـ GPS | accepted | 1.0.0 |