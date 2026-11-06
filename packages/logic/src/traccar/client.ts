/**
 * Badawi Fleet Platform - Traccar Ingestion Client (Read-Only)
 * Ref: ADR-023 (Traccar Read-Only 12-Month Ingestion Window / مستخدم قراءة فقط)
 * Ref: ADR-005 (Actions Worker), ADR-049 (Refresh Rate Write Guard)
 */

import type { RawGpsPoint } from '../analysis/types.js';
import type {
  TraccarAuthConfig,
  TraccarDevice,
  TraccarPosition,
  FetchPositionsOptions,
  BatchFetchOptions,
  TraccarConnectionStatus,
  TraccarDeviceCacheEntry
} from './types.js';

export class TraccarClient {
  private config: TraccarAuthConfig;
  private baseUrl: string;
  private sessionCookie: string | null = null;
  private devicesCache: TraccarDeviceCacheEntry | null = null;
  private devicesCacheTtlMs: number = 30 * 60 * 1000; // 30 minutes
  private positionsCache: Map<string, { points: RawGpsPoint[]; cachedAt: number }> = new Map();
  private positionsCacheTtlMs: number = 10 * 60 * 1000; // 10 minutes

  constructor(config: TraccarAuthConfig) {
    this.config = { ...config };
    this.baseUrl = config.url.trim().replace(/\/+$/, '');
  }

  /**
   * Builds authentication headers according to provided credentials.
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };

    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
      return headers;
    }

    if (this.config.token) {
      const tok = this.config.token.trim();
      headers['Authorization'] = tok.startsWith('Bearer ') ? tok : `Bearer ${tok}`;
      return headers;
    }

    if (this.config.username && this.config.password) {
      const basicStr = `${this.config.username}:${this.config.password}`;
      const encoded = typeof btoa === 'function'
        ? btoa(basicStr)
        : ((globalThis as unknown as { Buffer?: { from: (s: string) => { toString: (e: string) => string } } }).Buffer?.from(basicStr).toString('base64') ?? '');
      headers['Authorization'] = `Basic ${encoded}`;
      return headers;
    }

    return headers;
  }

  /**
   * Helper to perform read-only GET requests with timeout and optional retry.
   */
  private async safeGet<T>(endpoint: string, retries = 2): Promise<T> {
    const timeoutMs = this.config.timeoutMs || 20000;
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        const res = await fetch(url, {
          method: 'GET',
          headers: this.getAuthHeaders(),
          signal: controller?.signal
        });

        if (timer) clearTimeout(timer);

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Traccar API error [${res.status}]: ${errBody.slice(0, 150)}`);
        }

        return (await res.json()) as T;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retries) {
          // Exponential backoff: 300ms, 600ms...
          await new Promise((r) => setTimeout(r, (attempt + 1) * 300));
        }
      }
    }

    throw lastError || new Error(`Failed to GET ${endpoint}`);
  }

  /**
   * Tests connectivity, auth credentials, and retrieves server info.
   */
  public async testConnection(): Promise<TraccarConnectionStatus> {
    const start = Date.now();
    try {
      // 1. Probe server status
      const serverInfo = await this.safeGet<Record<string, unknown>>('/api/server', 0);
      const latencyMs = Date.now() - start;

      // 2. Probe device listing to verify authenticated read access
      const devices = await this.getDevices(true);

      let authMethod = 'None';
      if (this.config.token) authMethod = 'Bearer Token';
      else if (this.config.username) authMethod = 'Basic Auth';

      return {
        ok: true,
        status: 200,
        serverVersion: String(serverInfo.version || 'Traccar'),
        latencyMs,
        authMethodUsed: authMethod,
        deviceCount: devices.length
      };
    } catch (err: unknown) {
      return {
        ok: false,
        status: 500,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  /**
   * Fetches the complete list of registered devices with in-memory caching.
   */
  public async getDevices(forceRefresh = false): Promise<TraccarDevice[]> {
    const now = Date.now();
    if (!forceRefresh && this.devicesCache && now - this.devicesCache.cachedAt < this.devicesCacheTtlMs) {
      return this.devicesCache.devices;
    }

    const raw = await this.safeGet<TraccarDevice[]>('/api/devices');
    const devices = Array.isArray(raw) ? raw : [];

    this.devicesCache = {
      devices,
      cachedAt: now
    };

    return devices;
  }

  /**
   * Fetches historical raw GPS positions for a single device within a date window.
   */
  public async getPositions(options: FetchPositionsOptions): Promise<RawGpsPoint[]> {
    const { deviceId, vehicleId, from, to, useCache = true } = options;

    const fromIso = from instanceof Date ? from.toISOString() : new Date(from).toISOString();
    const toIso = to instanceof Date ? to.toISOString() : new Date(to).toISOString();

    const cacheKey = `${deviceId}:${fromIso}:${toIso}`;
    const now = Date.now();

    if (useCache && this.positionsCache.has(cacheKey)) {
      const entry = this.positionsCache.get(cacheKey)!;
      if (now - entry.cachedAt < this.positionsCacheTtlMs) {
        return entry.points;
      }
    }

    const endpoint = `/api/positions?deviceId=${deviceId}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`;
    const rawList = await this.safeGet<TraccarPosition[]>(endpoint);

    const vehicleTag = vehicleId || String(deviceId);
    const points: RawGpsPoint[] = Array.isArray(rawList)
      ? rawList.map((pos) => this.convertPositionToRawGps(pos, vehicleTag))
      : [];

    if (useCache) {
      this.positionsCache.set(cacheKey, {
        points,
        cachedAt: now
      });
    }

    return points;
  }

  /**
   * Fetches positions for multiple vehicles in throttled batches to avoid overloading Traccar (ADR-023).
   */
  public async getPositionsBatch(
    options: BatchFetchOptions
  ): Promise<Map<string, RawGpsPoint[]>> {
    const {
      devices,
      from,
      to,
      batchSize = 5, // Process 5 vehicles concurrently
      delayBetweenBatchesMs = 300, // 300ms pause between batches
      onProgress
    } = options;

    const resultMap = new Map<string, RawGpsPoint[]>();
    const total = devices.length;
    let completed = 0;

    for (let i = 0; i < total; i += batchSize) {
      const chunk = devices.slice(i, i + batchSize);

      const chunkPromises = chunk.map(async (dev) => {
        try {
          const points = await this.getPositions({
            deviceId: dev.deviceId,
            vehicleId: dev.vehicleId,
            from,
            to
          });
          resultMap.set(dev.vehicleId, points);
        } catch {
          // If a vehicle fails, return empty array to not abort other vehicles
          resultMap.set(dev.vehicleId, []);
        } finally {
          completed++;
          if (onProgress) {
            onProgress(completed, total, dev.vehicleId);
          }
        }
      });

      await Promise.all(chunkPromises);

      // Throttling delay between batches
      if (i + batchSize < total && delayBetweenBatchesMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatchesMs));
      }
    }

    return resultMap;
  }

  /**
   * Converts a Traccar API position record into platform-standard RawGpsPoint.
   */
  public convertPositionToRawGps(pos: TraccarPosition, vehicleId: string): RawGpsPoint {
    const rawSpeed = typeof pos.speed === 'number' ? pos.speed : 0;
    // By default, Traccar API returns speed in knots (1 knot = 1.852 km/h)
    const speedKmH = this.config.speedUnit === 'kmh' ? rawSpeed : rawSpeed * 1.852;

    const attributes = pos.attributes || {};
    const ignition = typeof attributes.ignition === 'boolean'
      ? attributes.ignition
      : typeof attributes.motion === 'boolean'
      ? attributes.motion
      : speedKmH > 3;

    return {
      id: pos.id,
      vehicleId,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: Math.round(speedKmH * 10) / 10,
      ignition,
      timestamp: pos.fixTime || pos.deviceTime || pos.serverTime,
      valid: pos.valid,
      course: pos.course,
      altitude: pos.altitude,
      attributes
    };
  }

  /**
   * Clears internal caches.
   */
  public clearCache(): void {
    this.devicesCache = null;
    this.positionsCache.clear();
  }
}
