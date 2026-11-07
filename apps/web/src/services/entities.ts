/**
 * Badawi Fleet Platform - Entities Management Service
 * Manages Vehicles, Drivers, Sites, and Assignments with dates (ADR-016, ADR-047, ADR-052)
 */

import type {
  VehicleDocument,
  DriverRecord,
  SiteRecord,
  AssignmentRecord,
  VehicleCandidate
} from '@badawi/logic';
import { auditService } from './audit';
import { appRepository } from './repository';

const VEHICLES_STORAGE_KEY = 'badawi_entities_vehicles_v1';
const DRIVERS_STORAGE_KEY = 'badawi_entities_drivers_v1';
const SITES_STORAGE_KEY = 'badawi_entities_sites_v1';
const ASSIGNMENTS_STORAGE_KEY = 'badawi_entities_assignments_v1';

// Seed Initial Sites
const SEED_SITES: SiteRecord[] = [
  { siteId: 'crusher-2', name: 'الكسارة 2 (موقع التحميل)', type: 'crusher', latitude: 31.025, longitude: 29.851, radiusMeters: 300, active: true },
  { siteId: 'mixer-main', name: 'الخلاطة الرئيسية', type: 'mixer', latitude: 31.042, longitude: 29.873, radiusMeters: 250, active: true },
  { siteId: 'discharge-coastal', name: 'موقع التفريغ (الساحلي الدولي)', type: 'discharge', latitude: 31.112, longitude: 29.954, radiusMeters: 400, active: true },
  { siteId: 'garage-main', name: 'جراج الأسطول المركزي', type: 'garage', latitude: 31.011, longitude: 29.832, radiusMeters: 200, active: true }
];

// Seed Initial Drivers
const SEED_DRIVERS: DriverRecord[] = [
  { driverId: 'd-116', name: 'محمد إبراهيم علي', phone: '01012345671', whatsapp: '01012345671', email: 'driver116@badawi.com', active: true },
  { driverId: 'd-118', name: 'محمود سعد الدين', phone: '01012345672', whatsapp: '01012345672', email: 'driver118@badawi.com', active: true },
  { driverId: 'd-121', name: 'أحمد فاروق حسن', phone: '01012345673', whatsapp: '01012345673', email: 'driver121@badawi.com', active: true },
  { driverId: 'd-124', name: 'إسلام عبد الحميد', phone: '01012345674', whatsapp: '01012345674', email: 'driver124@badawi.com', active: true },
  { driverId: 'd-127', name: 'رمضان فتحي شلبي', phone: '01012345675', whatsapp: '01012345675', email: 'driver127@badawi.com', active: true }
];

// Seed Verified Starter Fleet (ADR-016)
const SEED_VEHICLES: VehicleDocument[] = [
  { schemaVersion: 1, vehicleId: '116', name: 'عربية 116', plateNumber: 'أ ب ج 4821', type: 'tractor', gpsDeviceId: '101', siteId: 'crusher-2', status: 'online', active: true, createdAt: '2026-10-01T06:00:00Z', updatedAt: '2026-10-01T06:00:00Z' },
  { schemaVersion: 1, vehicleId: '118', name: 'عربية 118', plateNumber: 'د هـ و 1307', type: 'tractor', gpsDeviceId: '102', siteId: 'mixer-main', status: 'idle', active: true, createdAt: '2026-10-01T06:00:00Z', updatedAt: '2026-10-01T06:00:00Z' },
  { schemaVersion: 1, vehicleId: '121', name: 'عربية 121', plateNumber: 'ك ل م 2290', type: 'tractor', gpsDeviceId: '103', siteId: 'crusher-2', status: 'online', active: true, createdAt: '2026-10-01T06:00:00Z', updatedAt: '2026-10-01T06:00:00Z' },
  { schemaVersion: 1, vehicleId: '124', name: 'عربية 124', plateNumber: 'ز ح ط 9054', type: 'truck', gpsDeviceId: '104', siteId: 'garage-main', status: 'offline', active: true, createdAt: '2026-10-01T06:00:00Z', updatedAt: '2026-10-01T06:00:00Z' },
  { schemaVersion: 1, vehicleId: '127', name: 'عربية 127', plateNumber: 'ن س ع 7716', type: 'tractor', gpsDeviceId: '105', siteId: 'crusher-2', status: 'online', active: true, createdAt: '2026-10-01T06:00:00Z', updatedAt: '2026-10-01T06:00:00Z' },
  { schemaVersion: 1, vehicleId: '130', name: 'عربية 130', plateNumber: 'ف ق ر 5541', type: 'private', gpsDeviceId: '106', siteId: 'garage-main', status: 'online', active: true, createdAt: '2026-10-01T06:00:00Z', updatedAt: '2026-10-01T06:00:00Z' }
];

// Seed Initial Active Assignments
const SEED_ASSIGNMENTS: AssignmentRecord[] = [
  { assignmentId: 'as-1', vehicleId: '116', driverId: 'd-116', startDate: '2026-10-01', endDate: null },
  { assignmentId: 'as-2', vehicleId: '118', driverId: 'd-118', startDate: '2026-10-01', endDate: null },
  { assignmentId: 'as-3', vehicleId: '121', driverId: 'd-121', startDate: '2026-10-01', endDate: null },
  { assignmentId: 'as-4', vehicleId: '124', driverId: 'd-124', startDate: '2026-10-01', endDate: null },
  { assignmentId: 'as-5', vehicleId: '127', driverId: 'd-127', startDate: '2026-10-01', endDate: null }
];

type EntityChangeListener = () => void;
const listeners = new Set<EntityChangeListener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return fallback;
}

function save<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

export const entitiesService = {
  // --- VEHICLES ---
  getVehicles(): VehicleDocument[] {
    return load<VehicleDocument[]>(VEHICLES_STORAGE_KEY, SEED_VEHICLES);
  },

  getVehicle(id: string): VehicleDocument | undefined {
    return this.getVehicles().find((v) => v.vehicleId === id);
  },

  saveVehicle(vehicle: Partial<VehicleDocument> & { vehicleId: string }): VehicleDocument {
    const list = this.getVehicles();
    const idx = list.findIndex((v) => v.vehicleId === vehicle.vehicleId);
    const now = new Date().toISOString();
    const beforeData = idx >= 0 ? { ...list[idx] } : null;

    let savedVehicle: VehicleDocument;
    if (idx >= 0) {
      savedVehicle = {
        ...list[idx],
        ...vehicle,
        updatedAt: now
      };
      list[idx] = savedVehicle;
    } else {
      savedVehicle = {
        schemaVersion: 1,
        vehicleId: vehicle.vehicleId,
        name: vehicle.name || `عربية ${vehicle.vehicleId}`,
        plateNumber: vehicle.plateNumber || '',
        type: vehicle.type || 'tractor',
        gpsDeviceId: vehicle.gpsDeviceId || null,
        siteId: vehicle.siteId || null,
        status: vehicle.status || 'idle',
        active: vehicle.active ?? true,
        createdAt: now,
        updatedAt: now
      };
      list.push(savedVehicle);
    }

    save(VEHICLES_STORAGE_KEY, list);
    notify();

    // Persist to real Firestore / active repository
    appRepository.create('vehicles', savedVehicle.vehicleId, savedVehicle).catch((err) => {
      console.warn('[EntitiesService] Failed to persist vehicle to repository:', err);
    });

    // ADR-018: Record audit trail with before/after and onBehalfOf if active
    auditService.recordAction({
      action: idx >= 0 ? 'update' : 'create',
      collection: 'vehicles',
      documentId: savedVehicle.vehicleId,
      before: beforeData as Record<string, unknown> | null,
      after: savedVehicle as unknown as Record<string, unknown>
    });

    return savedVehicle;
  },

  deleteVehicle(vehicleId: string): boolean {
    const list = this.getVehicles();
    const target = list.find((v) => v.vehicleId === vehicleId);
    if (!target) return false;

    const filtered = list.filter((v) => v.vehicleId !== vehicleId);
    save(VEHICLES_STORAGE_KEY, filtered);
    notify();

    auditService.recordAction({
      action: 'delete',
      collection: 'vehicles',
      documentId: vehicleId,
      before: target as unknown as Record<string, unknown>,
      after: null
    });

    return true;
  },

  importBulkCandidates(candidates: VehicleCandidate[]): number {
    const list = this.getVehicles();
    const now = new Date().toISOString();
    let addedCount = 0;

    for (const c of candidates) {
      if (!c.valid) continue;
      const idx = list.findIndex((v) => v.vehicleId === c.vehicleId);
      const doc: VehicleDocument = {
        schemaVersion: 1,
        vehicleId: c.vehicleId,
        name: c.name || `عربية ${c.vehicleId}`,
        plateNumber: c.plateNumber,
        type: c.type,
        gpsDeviceId: c.gpsDeviceId,
        siteId: c.siteId,
        status: 'idle',
        active: true,
        createdAt: now,
        updatedAt: now
      };

      if (idx >= 0) {
        list[idx] = { ...list[idx], ...doc, updatedAt: now };
      } else {
        list.push(doc);
        addedCount++;
      }
    }

    save(VEHICLES_STORAGE_KEY, list);
    notify();

    auditService.recordAction({
      action: 'create',
      collection: 'vehicles',
      documentId: `bulk-import-${addedCount}`,
      title: `استيراد جماعي لـ ${addedCount} عربية من جدول Excel`,
      before: null,
      after: { totalImported: addedCount }
    });

    return addedCount;
  },

  // --- DRIVERS ---
  getDrivers(): DriverRecord[] {
    return load<DriverRecord[]>(DRIVERS_STORAGE_KEY, SEED_DRIVERS);
  },

  saveDriver(driver: Partial<DriverRecord> & { driverId: string; name: string; phone: string }): DriverRecord {
    const list = this.getDrivers();
    const idx = list.findIndex((d) => d.driverId === driver.driverId);

    let savedDriver: DriverRecord;
    if (idx >= 0) {
      savedDriver = { ...list[idx], ...driver };
      list[idx] = savedDriver;
    } else {
      savedDriver = {
        driverId: driver.driverId,
        name: driver.name,
        phone: driver.phone,
        whatsapp: driver.whatsapp || driver.phone,
        email: driver.email || null,
        active: driver.active ?? true
      };
      list.push(savedDriver);
    }

    save(DRIVERS_STORAGE_KEY, list);
    notify();
    return savedDriver;
  },

  // --- SITES ---
  getSites(): SiteRecord[] {
    return load<SiteRecord[]>(SITES_STORAGE_KEY, SEED_SITES);
  },

  saveSite(site: SiteRecord): SiteRecord {
    const list = this.getSites();
    const idx = list.findIndex((s) => s.siteId === site.siteId);

    if (idx >= 0) {
      list[idx] = site;
    } else {
      list.push(site);
    }

    save(SITES_STORAGE_KEY, list);
    notify();
    return site;
  },

  // --- ASSIGNMENTS (ADR-016) ---
  getAssignments(): AssignmentRecord[] {
    return load<AssignmentRecord[]>(ASSIGNMENTS_STORAGE_KEY, SEED_ASSIGNMENTS);
  },

  getActiveAssignment(vehicleId: string): AssignmentRecord | undefined {
    return this.getAssignments().find((a) => a.vehicleId === vehicleId && a.endDate === null);
  },

  assignDriver(vehicleId: string, driverId: string, startDate = new Date().toISOString().slice(0, 10)) {
    const list = this.getAssignments();

    // Close any previous active assignment for this vehicle
    const active = list.find((a) => a.vehicleId === vehicleId && a.endDate === null);
    if (active) {
      active.endDate = startDate;
    }

    // Add new assignment
    const newAssignment: AssignmentRecord = {
      assignmentId: 'as-' + Date.now().toString(36),
      vehicleId,
      driverId,
      startDate,
      endDate: null
    };

    list.unshift(newAssignment);
    save(ASSIGNMENTS_STORAGE_KEY, list);
    notify();

    // ADR-016 & ADR-018: Log assignment change
    auditService.recordAction({
      action: 'update',
      collection: 'assignments',
      documentId: newAssignment.assignmentId,
      title: `تغيير إسناد السائق للعربية ${vehicleId}`,
      before: active ? { vehicleId, driverId: active.driverId, startDate: active.startDate } : null,
      after: { vehicleId, driverId, startDate }
    });
    // Persist to repository
    appRepository.create('assignments', newAssignment.assignmentId, newAssignment as any).catch(() => {});
  },

  async syncFromRepository(): Promise<boolean> {
    try {
      const remoteVehicles = await appRepository.list<VehicleDocument>('vehicles');
      if (remoteVehicles && remoteVehicles.length > 0) {
        save(VEHICLES_STORAGE_KEY, remoteVehicles);
        notify();
        return true;
      }
    } catch (e) {
      console.warn('[EntitiesService] syncFromRepository error:', e);
    }
    return false;
  },

  subscribe(listener: EntityChangeListener): () => void {
    listeners.add(listener);
    listener();
    return () => listeners.delete(listener);
  }
};