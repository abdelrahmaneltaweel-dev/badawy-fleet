# دليل مخطط قاعدة بيانات Firestore (Firestore Schema Architecture)

> **الإصدار:** 1.0.0  
> **المرجع القراري:** ADR-004, ADR-008, ADR-015, ADR-016, ADR-017, ADR-019, ADR-021, ADR-022, ADR-036, ADR-040, ADR-060  
> **قاعدة الحصص:** خطة Firebase Spark المجانية (حوالي 1GB تخزين، 50 ألف قراءة و20 ألف كتابة/حذف يومياً).

---

## 1. استراتيجية التصميم (Design Strategy)
1. **معمارية مسطحة (Flat Collections):** جميع المجموعات على المستوى الجذري (Root Collections) دون تضمين مجموعات فرعية عميقة (Subcollections)، لضمان سرعة الاستعلام وتقليل تكلفة القراءات.
2. **`schemaVersion: 1` إلزامي:** كل مستند يحمل رقماً صحيحاً يمثل إصداره لتمكين الميجريشن التلقائي السلس مستقبلاً.
3. **لا تخزين لمسارات GPS الخام (ADR-023):** حفظ الملخصات المحسوبة فقط (`daily_summaries`) لضمان عدم تجاوز سقف الـ 1 جيجا.
4. **حماية التغييرات والتسجيل (Audit & On-Behalf - ADR-018):** كل إدخال يحمل `enteredBy` و`onBehalfOf`.

---

## 2. المجموعات المركزية (Collections)

### `vehicles`
- **المعرف:** `vehicleId` (مثال: `"116"`)
- **الحقول:**
  - `vehicleId`: `string`
  - `name`: `string`
  - `plateNumber`: `string`
  - `type`: `'tractor' | 'truck' | 'private'`
  - `gpsDeviceId`: `string | null`
  - `siteId`: `string | null`
  - `status`: `'online' | 'offline' | 'idle'`
  - `active`: `boolean`
  - `schemaVersion`: `number` (1)
  - `createdAt`, `updatedAt`: `string` (ISO)

### `drivers`
- **المعرف:** `driverId` (معرف السائق أو الـ Auth UID)
- **الحقول:** `driverId`, `name`, `phone`, `whatsapp`, `email`, `active`, `schemaVersion`, `createdAt`, `updatedAt`.

### `assignments`
- **المعرف:** `assignmentId`
- **الحقول:** `vehicleId`, `driverId`, `startDate` (YYYY-MM-DD), `endDate` (`string | null`), `schemaVersion`, `createdAt`, `updatedAt`.

### `sites`
- **المعرف:** `siteId` (مثال: `"crusher-2"`)
- **الحقول:** `name`, `type`, `latitude`, `longitude`, `radiusMeters`, `active`, `schemaVersion`, `createdAt`, `updatedAt`.

### `inquiries` (ADR-017)
- **المعرف:** `inquiryId`
- **الحقول:** `vehicleId`, `targetRole`, `targetUserId`, `timestamp`, `locationUrl`, `question`, `responseCode`, `responseNote`, `status`, `enteredBy`, `onBehalfOf`, `schemaVersion`, `createdAt`, `updatedAt`.

### `issues` (ADR-019)
- **المعرف:** `issueId`
- **الحقول:** `vehicleId`, `type`, `detectedAt`, `status`, `resolvedAt`, `notes`, `schemaVersion`, `createdAt`, `updatedAt`.

### `statements` (ADR-060)
- **المعرف:** `statementId`
- **الحقول:** `source` (`mixer` | `garage` | `driver`), `date`, `vehicleId`, `tripsCount`, `details`, `enteredBy`, `onBehalfOf`, `approved`, `schemaVersion`, `createdAt`, `updatedAt`.

### `daily_summaries` (ADR-005, ADR-023)
- **المعرف:** `summaryId` (مثال: `"2026-10-28_116"`)
- **الحقول:** `date`, `vehicleId`, `driverId`, `vehicleType`, `tripsCount`, `trips`, `stopsCount`, `stops`, `firstMovement`, `lastMovement`, `matchingStatus`, `rulesVersion`, `schemaVersion`, `createdAt`, `updatedAt`.

### `petro_requests` (ADR-021)
- **المعرف:** `requestId`
- **الحقول:** `date`, `amount`, `status`, `attemptNumber`, `previousRequestId`, `fuelReportSummary`, `accountStatementSummary`, `enteredBy`, `schemaVersion`, `createdAt`, `updatedAt`.

### `settings` (ADR-040, ADR-044)
- **المعرف:** `settingId` (مثال: `"system_registry"`, `"rules_params"`)
- **الحقول:** `version`, `updatedBy`, `data`, `schemaVersion`, `updatedAt`.

### `audit_logs` (ADR-018, ADR-056)
- **المعرف:** `logId`
- **الحقول:** `timestamp`, `userId`, `enteredBy`, `onBehalfOf`, `action`, `collection`, `documentId`, `before`, `after`, `schemaVersion`.

### `period_snapshots` (ADR-036, ADR-038)
- **المعرف:** `periodId` (مثال: `"2026-10"`)
- **الحقول:** `closedAt`, `closedBy`, `version`, `frozen`, `reason`, `data`, `schemaVersion`.

### `daily_snapshots` (ADR-004, D-059, T5.6)
- **المعرف:** `snapshotId` (مثال: `"2026-11-06"`)
- **الوصف:** لقطة مجمعة مسبقة الاحتساب لكامل الأسطول (قراءة واحدة 1 Read للشاشات بدلاً من 130 قراءة، وتُستبدل يومياً لحماية حصص Spark المجانية).
- **الحقول:**
  - `snapshotId`: `string`
  - `date`: `string` (YYYY-MM-DD)
  - `fleetTotals`: `{ totalVehicles, onlineCount, offlineCount, idleCount, totalTrips, tractorTrips, truckTrips, privateTrips, totalStops, maintenanceStops, activeIssuesCount }`
  - `vehicles`: قائمة مختصرة لكل عربية `{ vehicleId, name, type, plateNumber, status, tripsCount, stopsCount, firstMovement, lastMovement, lastLocationName, driverId, driverName, matchingStatus, hasIssue, issueType, dataSource, updatedAt }`
  - `recentIssues`: قائمة مختصرة بالمشاكل الحالية
  - `checksum`: بصمة FNV-1a للتحقق من التغيير وتخطي الكتابة عند عدم التغير
  - `rulesVersion`: `string`
  - `dataSource`: `'traccar' | 'excel'`
  - `schemaVersion`: `number` (1)
  - `createdAt`, `updatedAt`: `string` (ISO)