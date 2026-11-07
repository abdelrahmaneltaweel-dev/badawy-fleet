/**
 * Badawi Fleet Platform - Web Traccar Ingestion Service
 * Connects to Traccar API, tests connectivity, pulls real devices and GPS coordinates,
 * runs logic analysis, and saves real summaries to Firestore/Repository.
 * Ref: ADR-005, ADR-023, ADR-049
 */

import {
  TraccarClient,
  type TraccarConnectionStatus,
  type TraccarDevice,
  analyzeVehicleDailyData,
  buildFleetDailySnapshot,
  getOperationalDateString
} from '@badawi/logic';
import { appRepository } from './repository';
import { entitiesService } from './entities';
import { showToast } from '../components/Toast';

export interface TraccarWebConfig {
  url: string;
  token?: string;
  username?: string;
  password?: string;
  useProxy?: boolean;
}

const TRACCAR_CONFIG_STORAGE_KEY = 'badawi_traccar_config_v1';

function getInitialTraccarConfig(): TraccarWebConfig {
  try {
    const raw = localStorage.getItem(TRACCAR_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.useProxy = true; // Always active in browser to avoid CORS and Mixed-Content
      return parsed;
    }
  } catch {
    // Ignore
  }

  const envUrl = (import.meta as any).env?.VITE_TRACCAR_URL;
  const envToken = (import.meta as any).env?.VITE_TRACCAR_TOKEN;
  const envUser = (import.meta as any).env?.VITE_TRACCAR_USER;
  const envPass = (import.meta as any).env?.VITE_TRACCAR_PASS;

  return {
    url: envUrl || 'http://196.221.144.183:8080',
    token: envToken || '',
    username: envUser || 'it',
    password: envPass || '',
    useProxy: true // Default to true to prevent CORS and Mixed-Content blocks
  };
}

let activeConfig: TraccarWebConfig = getInitialTraccarConfig();

function createClient(cfg: TraccarWebConfig = activeConfig): TraccarClient {
  const isBrowser = typeof window !== 'undefined';
  // In browser environments, always use internal proxy for external URLs to prevent CORS / Mixed-Content blocks
  const isLocalProxy = cfg.url.startsWith('/api/') || cfg.url.startsWith('./api/');
  const shouldUseProxy = isBrowser ? !isLocalProxy : (cfg.useProxy !== false);

  const clientUrl = shouldUseProxy ? '/api/traccar-proxy' : cfg.url;
  const customHeaders: Record<string, string> = {};

  if (shouldUseProxy) {
    customHeaders['x-traccar-target'] = cfg.url;
  }

  return new TraccarClient({
    url: clientUrl,
    token: cfg.token,
    username: cfg.username,
    password: cfg.password,
    speedUnit: 'knots',
    timeoutMs: 25000,
    customHeaders
  });
}

export interface SyncProgressUpdate {
  phase: 'connecting' | 'devices' | 'positions' | 'analyzing' | 'persisting' | 'done' | 'error';
  message: string;
  current: number;
  total: number;
  vehicleId?: string;
}

type SyncListener = (status: SyncProgressUpdate) => void;
const syncListeners = new Set<SyncListener>();

function notifyProgress(p: SyncProgressUpdate) {
  syncListeners.forEach((fn) => fn(p));
}

export const traccarService = {
  getConfig(): TraccarWebConfig {
    return { ...activeConfig };
  },

  saveConfig(cfg: TraccarWebConfig) {
    activeConfig = { ...cfg };
    try {
      localStorage.setItem(TRACCAR_CONFIG_STORAGE_KEY, JSON.stringify(activeConfig));
    } catch {
      // Ignore
    }
  },

  async testConnection(customConfig?: TraccarWebConfig): Promise<TraccarConnectionStatus> {
    const cfg = customConfig || activeConfig;
    const url = cfg.url?.trim() || '';

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/'))) {
      return {
        ok: false,
        status: 400,
        latencyMs: 0,
        error: 'يرجى إدخال رابط صحيح لسيرفر Traccar يبدأ بـ http:// أو https://'
      };
    }

    const client = createClient(cfg);
    try {
      return await client.testConnection();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        status: 502,
        latencyMs: 0,
        error: msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch')
          ? 'تعذر الوصول إلى سيرفر Traccar؛ تأكد من اتصال السيرفر بالإنترنت وصحة الرابط المنفذ'
          : msg
      };
    }
  },

  async fetchDevices(): Promise<TraccarDevice[]> {
    const client = createClient();
    return await client.getDevices(true);
  },

  subscribeSync(listener: SyncListener): () => void {
    syncListeners.add(listener);
    return () => syncListeners.delete(listener);
  },

  /**
   * Performs full live fleet GPS pull and ingestion:
   * 1. Fetches devices from Traccar
   * 2. Fetches positions for operational window (06:00 to 06:00 next day)
   * 3. Analyzes stops and haul cycles
   * 4. Produces DailySnapshot and saves to Firestore/appRepository
   */
  async runLiveFleetSync(targetDate = getOperationalDateString(new Date())): Promise<{
    success: boolean;
    vehiclesProcessed: number;
    totalHauls: number;
    error?: string;
  }> {
    const cfg = activeConfig;
    const url = cfg.url?.trim() || '';

    if (!url || url.includes('localhost:8082') || url.includes('127.0.0.1:8082')) {
      const hint = 'يرجى إدخال رابط سيرفر Traccar الفعلي وبيانات الاعتماد في شاشة الإعدادات أولاً';
      notifyProgress({
        phase: 'error',
        message: hint,
        current: 0,
        total: 100
      });
      showToast(hint);
      return {
        success: false,
        vehiclesProcessed: 0,
        totalHauls: 0,
        error: hint
      };
    }

    notifyProgress({
      phase: 'connecting',
      message: 'الاتصال بسيرفر Traccar والتحقق من الصلاحيات...',
      current: 0,
      total: 100
    });

    const client = createClient();

    try {
      // 1. Fetch devices
      notifyProgress({
        phase: 'devices',
        message: 'سحب قائمة أجهزة GPS المسجلة في Traccar...',
        current: 10,
        total: 100
      });

      const devices = await client.getDevices(true);
      if (!devices || devices.length === 0) {
        throw new Error('لم يتم العثور على أجهزة مسجلة في Traccar أو بيانات الاعتماد غير صحيحة');
      }

      // Map devices to registered vehicles
      const registeredVehicles = entitiesService.getVehicles();
      const sites = entitiesService.getSites();

      // Convert sites to analysis geofences
      const geofences = sites.map((s) => ({
        id: s.siteId,
        name: s.name,
        type: s.type as any,
        center: { lat: s.latitude, lng: s.longitude },
        radiusMeters: s.radiusMeters
      }));

      // Operational window: 06:00 of targetDate to 05:59:59 of next day (ADR-041)
      const fromDate = new Date(`${targetDate}T06:00:00Z`);
      const toDate = new Date(fromDate.getTime() + 24 * 3600 * 1000 - 1000);

      notifyProgress({
        phase: 'positions',
        message: `سحب إحداثيات GPS لـ ${devices.length} جهاز ليوم [${targetDate}]...`,
        current: 20,
        total: devices.length
      });

      // Prepare device batch
      const batchList = devices.map((d) => {
        // Match with vehicle if possible, otherwise use device name or uniqueId
        const matched = registeredVehicles.find(
          (v) => String(v.gpsDeviceId) === String(d.id) || String(v.vehicleId) === String(d.name)
        );
        return {
          deviceId: d.id,
          vehicleId: matched?.vehicleId || String(d.name || d.id)
        };
      });

      const positionsMap = await client.getPositionsBatch({
        devices: batchList,
        from: fromDate,
        to: toDate,
        batchSize: 4,
        delayBetweenBatchesMs: 250,
        onProgress: (done, total, vId) => {
          notifyProgress({
            phase: 'positions',
            message: `سحب إحداثيات المركبة ${vId} (${done} من ${total})...`,
            current: done,
            total,
            vehicleId: vId
          });
        }
      });

      // 3. Run Analysis Pipeline
      notifyProgress({
        phase: 'analyzing',
        message: 'تحليل الوقفات، النقلات، وتطبيق الفلاتر الهندسية...',
        current: 80,
        total: 100
      });

      const summaries = [];
      let totalHaulsCount = 0;

      for (const [vId, points] of positionsMap.entries()) {
        const matchedVehicle = registeredVehicles.find((v) => v.vehicleId === vId) || {
          vehicleId: vId,
          type: 'tractor' as const
        };

        const analysis = analyzeVehicleDailyData(
          {
            id: matchedVehicle.vehicleId,
            type: matchedVehicle.type || 'tractor'
          },
          points,
          geofences,
          targetDate
        );

        totalHaulsCount += analysis.hauls.length;

        const summaryDoc = {
          schemaVersion: 1,
          date: targetDate,
          vehicleId: vId,
          vehicleType: matchedVehicle.type || 'tractor',
          tripsCount: analysis.trips.length,
          trips: analysis.trips,
          stops: analysis.stops,
          hauls: analysis.hauls,
          rawPointsCount: points.length,
          totalDistanceKm: analysis.totalDistanceKm,
          totalOperatingHours: Math.round(((analysis.totalMovingMinutes + analysis.totalStopMinutes) / 60) * 10) / 10,
          fuelEstimateLiters: Math.round(analysis.totalDistanceKm * 0.45 * 10) / 10,
          updatedAt: new Date().toISOString()
        };

        summaries.push(summaryDoc);

        // Save individual summary to repository
        try {
          await appRepository.create('daily_summaries', `${targetDate}_${vId}`, summaryDoc as any);
        } catch {
          // Ignore individual write failure
        }
      }

      // 4. Build and save Daily Snapshot (1-read fleet view)
      notifyProgress({
        phase: 'persisting',
        message: 'إنشاء اللقطة اليومية الموحدة وحفظها في قاعدة البيانات...',
        current: 95,
        total: 100
      });

      const snapshot = buildFleetDailySnapshot({
        operationalDate: targetDate,
        summaries: summaries as any
      });
      await appRepository.create('daily_snapshots', targetDate, snapshot as any);

      notifyProgress({
        phase: 'done',
        message: `اكتملت المزامنة بنجاح! تم تحليل ${summaries.length} مركبة واستخراج ${totalHaulsCount} نقلة.`,
        current: 100,
        total: 100
      });

      showToast(`تم سحب وتحديث بيانات ${summaries.length} مركبة من Traccar بنجاح!`);

      return {
        success: true,
        vehiclesProcessed: summaries.length,
        totalHauls: totalHaulsCount
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      notifyProgress({
        phase: 'error',
        message: `خطأ في المزامنة: ${errorMsg}`,
        current: 0,
        total: 100
      });
      showToast(`تعذرت المزامنة مع Traccar: ${errorMsg}`);
      return {
        success: false,
        vehiclesProcessed: 0,
        totalHauls: 0,
        error: errorMsg
      };
    }
  }
};
