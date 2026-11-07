/**
 * Badawi Fleet Platform - Firestore Schema Definitions
 * Version: 1.0.0
 * ADR References: ADR-008, ADR-015, ADR-016, ADR-017, ADR-019, ADR-021, ADR-022, ADR-036, ADR-040, ADR-060
 */

export const CURRENT_SCHEMA_VERSION = 1;

export type CollectionName =
  | 'vehicles'
  | 'drivers'
  | 'assignments'
  | 'sites'
  | 'inquiries'
  | 'issues'
  | 'statements'
  | 'daily_summaries'
  | 'petro_requests'
  | 'settings'
  | 'audit_logs'
  | 'period_snapshots'
  | 'daily_snapshots';

export type VehicleType = 'tractor' | 'truck' | 'private';
export type VehicleStatus = 'online' | 'offline' | 'idle';
export type SiteType = 'crusher' | 'mixer' | 'discharge' | 'garage' | 'other';
export type InquiryTargetRole = 'driver' | 'mixer_manager' | 'garage_security';
export type InquiryStatus = 'pending' | 'answered' | 'closed';
export type IssueType = 'offline' | 'frozen_signal' | 'no_power' | 'other';
export type IssueStatus = 'open' | 'contacted' | 'resolved';
export type StatementSource = 'mixer' | 'garage' | 'driver';
export type PetroRequestStatus = 'pending' | 'approved' | 'rejected';
export type AuditAction = 'create' | 'update' | 'delete' | 'close_period' | 'open_period' | 'override';

export interface BaseDocument {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 1. Vehicle (عربية) - ADR-016
 */
export interface VehicleDocument extends BaseDocument {
  vehicleId: string; // e.g. "116"
  name: string; // e.g. "عربية 116"
  plateNumber: string; // e.g. "أ ب ج 4821"
  type: VehicleType;
  gpsDeviceId: string | null;
  siteId: string | null;
  status: VehicleStatus;
  active: boolean;
}

/**
 * 2. Driver (سائق) - ADR-016
 */
export interface DriverDocument extends BaseDocument {
  driverId: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  active: boolean;
}

/**
 * 3. Assignment (إسناد بتواريخ) - ADR-016
 */
export interface AssignmentDocument extends BaseDocument {
  assignmentId: string;
  vehicleId: string;
  driverId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // null = currently active
}

/**
 * 4. Site (موقع)
 */
export interface SiteDocument extends BaseDocument {
  siteId: string;
  name: string;
  type: SiteType;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
}

/**
 * 5. Inquiry (استفسار موحد) - ADR-017, ADR-018
 */
export interface InquiryDocument extends BaseDocument {
  inquiryId: string;
  vehicleId: string;
  targetRole: InquiryTargetRole;
  targetUserId: string | null;
  timestamp: string; // ISO
  locationUrl: string | null;
  question: string;
  responseCode: string | null;
  responseNote: string | null;
  status: InquiryStatus;
  enteredBy: string;
  onBehalfOf: string | null;
}

/**
 * 6. Issue (مشكلة GPS) - ADR-019
 */
export interface IssueDocument extends BaseDocument {
  issueId: string;
  vehicleId: string;
  type: IssueType;
  detectedAt: string; // ISO
  status: IssueStatus;
  resolvedAt: string | null;
  notes: string | null;
}

/**
 * 7. Statement (بيان الخلاطة/الجراج/السائق) - ADR-018, ADR-060
 */
export interface StatementDocument extends BaseDocument {
  statementId: string;
  source: StatementSource;
  date: string; // YYYY-MM-DD
  vehicleId: string;
  tripsCount: number;
  details: Record<string, unknown>;
  enteredBy: string;
  onBehalfOf: string | null;
  approved: boolean;
}

/**
 * 8. Daily Summary (ملخص اليوم المحسوب) - ADR-005, ADR-023
 */
export interface TripRecord {
  start: string;
  end: string;
  origin: string;
  destination: string;
  durationMinutes: number;
}

export interface StopRecord {
  location: string;
  start: string;
  end: string;
  durationMinutes: number;
}

export type DataSourceType = 'traccar' | 'excel';

export interface DailySummaryDocument extends BaseDocument {
  summaryId: string; // e.g. "2026-10-28_116"
  date: string; // YYYY-MM-DD
  vehicleId: string;
  driverId: string | null;
  vehicleType: VehicleType;
  tripsCount: number;
  trips: TripRecord[];
  stopsCount: number;
  stops: StopRecord[];
  firstMovement: string | null;
  lastMovement: string | null;
  matchingStatus: 'matched' | 'mismatched' | 'pending';
  rulesVersion: string;
  dataSource?: DataSourceType; // ADR-048: 'traccar' (default) or 'excel'
}

/**
 * 9. Petro Request (طلب العهدة) - ADR-021, ADR-056
 */
export interface PetroRequestDocument extends BaseDocument {
  requestId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  status: PetroRequestStatus;
  attemptNumber: number;
  previousRequestId: string | null;
  fuelReportSummary: Record<string, unknown>;
  accountStatementSummary: Record<string, unknown>;
  enteredBy: string;
}

/**
 * 10. Settings (سجل الإعدادات) - ADR-040, ADR-044
 */
export interface SettingsDocument extends BaseDocument {
  settingId: string; // e.g. "system_registry", "appearance"
  version: number;
  updatedBy: string;
  data: Record<string, unknown>;
}

/**
 * 11. Audit Log (سجل المراجعة) - ADR-018, ADR-056
 */
export interface AuditLogDocument extends BaseDocument {
  logId: string;
  timestamp: string; // ISO
  userId: string;
  enteredBy: string;
  onBehalfOf: string | null;
  action: AuditAction;
  collection: CollectionName;
  documentId: string;
  before: unknown;
  after: unknown;
}

/**
 * 12. Period Snapshot (لقطة الفترة المعتمدة والمقفولة) - ADR-036, ADR-038
 */
export interface PeriodSnapshotDocument extends BaseDocument {
  periodId: string; // e.g. "2026-10"
  closedAt: string; // ISO
  closedBy: string;
  version: number;
  frozen: boolean;
  reason: string | null;
  data: Record<string, unknown>;
}

/**
 * 13. Daily Snapshot (لقطة اليوم المجمعة للأسطول - قراءة واحدة لشاشات الداشبورد والأسطول) - ADR-004, D-059
 */
export interface FleetTotals {
  totalVehicles: number;
  onlineCount: number;
  offlineCount: number;
  idleCount: number;
  totalTrips: number;
  tractorTrips: number; // النقلات
  truckTrips: number;   // مشاوير النقل
  privateTrips: number; // مشاوير الملاكي
  totalStops: number;
  maintenanceStops: number;
  activeIssuesCount: number;
}

export interface VehicleSnapshotItem {
  vehicleId: string;
  name: string;
  type: VehicleType;
  plateNumber: string;
  status: VehicleStatus;
  tripsCount: number;
  stopsCount: number;
  firstMovement: string | null;
  lastMovement: string | null;
  lastLocationName?: string;
  driverId: string | null;
  driverName?: string;
  matchingStatus: 'matched' | 'mismatched' | 'pending';
  hasIssue: boolean;
  issueType?: IssueType;
  dataSource?: DataSourceType;
  updatedAt: string;
}

export interface IssueSnapshotItem {
  issueId: string;
  vehicleId: string;
  type: IssueType;
  detectedAt: string;
  status: IssueStatus;
  notes: string | null;
}

export interface DailySnapshotDocument extends BaseDocument {
  snapshotId: string; // e.g. "2026-11-06" or "current"
  date: string;       // YYYY-MM-DD
  fleetTotals: FleetTotals;
  vehicles: VehicleSnapshotItem[];
  recentIssues: IssueSnapshotItem[];
  checksum: string;
  rulesVersion: string;
  dataSource: DataSourceType;
}