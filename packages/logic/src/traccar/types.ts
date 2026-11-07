/**
 * Badawi Fleet Platform - Traccar Ingestion Client Types
 * Ref: ADR-023 (Traccar Read-Only 12-Month Ingestion Window)
 * Ref: ADR-005, ADR-049
 */

export type SpeedUnit = 'knots' | 'kmh';

export interface TraccarAuthConfig {
  url: string;
  token?: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
  speedUnit?: SpeedUnit; // Traccar default is knots (1 knot = 1.852 km/h)
  customHeaders?: Record<string, string>;
}

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  disabled: boolean;
  lastUpdate?: string;
  positionId?: number;
  category?: string;
  phone?: string;
  model?: string;
  contact?: string;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number; // knots by default in Traccar API
  course: number;
  address?: string;
  accuracy?: number;
  network?: Record<string, unknown>;
  attributes?: {
    ignition?: boolean;
    motion?: boolean;
    batteryLevel?: number;
    distance?: number;
    totalDistance?: number;
    hours?: number;
    [key: string]: unknown;
  };
}

export interface FetchPositionsOptions {
  deviceId: number;
  vehicleId?: string; // Canonical fleet vehicle identifier (e.g. "116")
  from: string | Date;
  to: string | Date;
  useCache?: boolean;
}

export interface BatchFetchOptions {
  devices: Array<{ deviceId: number; vehicleId: string }>;
  from: string | Date;
  to: string | Date;
  batchSize?: number; // Concurrency limit (Default: 5)
  delayBetweenBatchesMs?: number; // Throttle sleep between batches (Default: 300ms)
  onProgress?: (completed: number, total: number, currentDevice: string) => void;
}

export interface TraccarConnectionStatus {
  ok: boolean;
  status: number;
  serverVersion?: string;
  latencyMs: number;
  authMethodUsed?: string;
  deviceCount?: number;
  error?: string;
}

export interface TraccarDeviceCacheEntry {
  devices: TraccarDevice[];
  cachedAt: number;
}
