/**
 * Badawi Fleet Platform - Entities & Import Types
 * Ref: ADR-016, ADR-047, ADR-052
 */

import type { VehicleType, SiteType } from '../schema/types.js';

export interface VehicleCandidate {
  vehicleId: string;
  name: string;
  plateNumber: string;
  type: VehicleType;
  gpsDeviceId: string | null;
  siteId: string | null;
  valid: boolean;
  errors: string[];
}

export interface BulkImportParseResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  candidates: VehicleCandidate[];
  summaryError?: string;
}

export interface AssignmentRecord {
  assignmentId: string;
  vehicleId: string;
  driverId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // null = active
}

export interface DriverRecord {
  driverId: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  active: boolean;
}

export interface SiteRecord {
  siteId: string;
  name: string;
  type: SiteType;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
}