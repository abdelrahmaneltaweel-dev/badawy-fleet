/**
 * Badawi Fleet Platform — Pure GPS Analysis Types
 * 
 * المرجع: docs/adr/ADR-019, ADR-023, ADR-048, ADR-059, ADR-060
 * خالية تماماً من أي اعتماديات شبكية وتعمل في Node والمتصفح 100%.
 */

export interface RawGpsPoint {
  id?: number | string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  ignition?: boolean;
  timestamp: string | Date; // ISO string or Date
  valid?: boolean | number;
  course?: number;
  altitude?: number;
  attributes?: Record<string, unknown>;
}

export interface CleanGpsPoint {
  latitude: number;
  longitude: number;
  speed: number; // km/h
  ignition: boolean;
  timestamp: Date;
  isoTime: string;
  distanceKmFromPrev: number;
  timeDiffSeconds: number;
  course?: number;
}

export type GeofenceType = 
  | 'garage'      // جراج الشركة
  | 'crusher'     // كسارة / محجر تحميل
  | 'mixer'       // محطة خلاطة خرسانة
  | 'dump_site'   // موقع تفريغ / ردم
  | 'project'     // موقع مشروع أو تشغيل
  | 'custom';     // موقع مخصص

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface Geofence {
  id: string;
  name: string;
  type: GeofenceType;
  center: GeoCoordinate;
  radiusMeters: number; // النطاق الدائري بالمتر
  polygon?: GeoCoordinate[]; // مضلع اختياري للمواقع غير الدائرية
  description?: string;
}

export interface GpsStop {
  id: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  centerLat: number;
  centerLng: number;
  geofenceId?: string;
  geofenceName?: string;
  geofenceType?: GeofenceType;
  isMaintenance: boolean; // وقوف 20+ دقيقة بالجراج
  isSiteVisit: boolean;   // وقوف 10+ دقائق بموقع عمل
  maxSpeedDuringStop: number;
  pointCount: number;
}

export interface HaulCycle {
  id: string;
  vehicleId: string;
  haulNumber: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  loadingStop: GpsStop;
  unloadingStop: GpsStop;
  travelDistanceKm: number;
  status: 'completed' | 'in_progress' | 'cancelled';
}

export interface VehicleTrip {
  id: string;
  vehicleId: string;
  tripNumber: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  startLocation: {
    lat: number;
    lng: number;
    name?: string;
  };
  endLocation: {
    lat: number;
    lng: number;
    name?: string;
  };
  distanceKm: number;
  movingMinutes: number;
  stopMinutes: number;
  maxSpeedKmH: number;
  avgSpeedKmH: number;
  intermediateStops: GpsStop[];
}

export type GpsLiveStatus = 
  | 'moving'         // حركة (سرعة > 3 كم/س وموتور شغال)
  | 'idle'           // انتظار (موتور شغال والسرعة <= 3 كم/س)
  | 'parked'         // ركنة / متوقفة (موتور مطفأ)
  | 'offline'        // انقطاع الإشارة أكثر من المهلة
  | 'frozen_signal'  // إشارة متجمدة (إحداثيات ثابتة مع وقت متغير)
  | 'no_data';       // لا توجد بيانات

export interface VehicleGpsStatus {
  vehicleId: string;
  lastPingTime?: string;
  status: GpsLiveStatus;
  statusLabelAr: string;
  lastLocation?: GeoCoordinate;
  currentSpeedKmH: number;
  isIgnitionOn: boolean;
  offlineMinutes: number;
  hasActiveIssue: boolean;
  issueType?: 'offline' | 'frozen_signal';
  issueDetails?: string;
}

export interface AnalysisConfig {
  operationalDayStartHour: number; // الافتراضي 6 صباحاً
  maxSpeedKmH: number; // أقصى سرعة معقولة (140 كم/س) لمنع الشذوذ
  maxTeleportSpeedKmH: number; // سرعة القفز المستحيلة (180 كم/س) لحذف قفزات الإشارة
  stopSpeedThreshold: number; // السرعة التي تعتبر توقفاً (3 كم/س)
  minStopDurationMinutes: number; // أقل مدة لتسجيل وقفة (5 دقائق)
  garageMaintenanceDurationMinutes: number; // وقوف 20 دقيقة بالجراج = صيانة
  siteVisitDurationMinutes: number; // وقوف 10 دقائق بالمشوار = زيارة
  siteVisitRadiusMeters: number; // نطاق 250 متر لزيارة المشوار
  offlineThresholdMinutes: number; // مهلة الانقطاع لاعتبار الجهاز Offline (60 دقيقة)
  frozenSignalThresholdMinutes: number; // مهلة تجمد الإشارة (30 دقيقة)
  mixerPassStopMinutes?: number; // وقفة الخلاطة الأقل من 20 دقيقة = مرور على الطريق مش تفريغ/تحميل (7.5)
  freezeFix?: boolean; // تصحيح السرعة الوهمية للعربيات الصعبة مثل 124 (7.6)
  rulesVersion: string;
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  operationalDayStartHour: 6,
  maxSpeedKmH: 140,
  maxTeleportSpeedKmH: 180,
  stopSpeedThreshold: 3,
  minStopDurationMinutes: 5,
  garageMaintenanceDurationMinutes: 20,
  siteVisitDurationMinutes: 10,
  siteVisitRadiusMeters: 250,
  offlineThresholdMinutes: 60,
  frozenSignalThresholdMinutes: 30,
  mixerPassStopMinutes: 20,
  freezeFix: false,
  rulesVersion: '1.0.0'
};

export interface VehicleDailyAnalysisResult {
  vehicleId: string;
  vehicleType: string;
  operationalDate: string; // YYYY-MM-DD
  rawPointsCount: number;
  cleanPointsCount: number;
  totalDistanceKm: number;
  totalMovingMinutes: number;
  totalStopMinutes: number;
  maxSpeedKmH: number;
  avgMovingSpeedKmH: number;
  stops: GpsStop[];
  maintenanceCount: number;
  hauls: HaulCycle[];
  trips: VehicleTrip[];
  gpsStatus: VehicleGpsStatus;
  metadata: {
    processedAt: string;
    rulesVersion: string;
  };
}
