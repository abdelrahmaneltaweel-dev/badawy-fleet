/**
 * Badawi Fleet Platform - Vehicle Assignments & Driver History Helper (ADR-016)
 * Handles historical assignment timeline, active driver lookup, and duration calculations.
 */

import type { AssignmentRecord, DriverRecord } from './types.js';

export interface VehicleAssignmentHistoryItem {
  assignmentId: string;
  vehicleId: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverWhatsapp: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // null = active
  isActive: boolean;
  durationDays: number;
  formattedDuration: string;
  formattedPeriod: string;
}

/**
 * Calculates duration in whole days between two YYYY-MM-DD dates inclusive.
 */
export function calculateDaysBetween(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  if (isNaN(diffTime) || diffTime < 0) return 1;
  const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

/**
 * Formats day count into calm Arabic text
 */
export function formatAssignmentDurationArabic(days: number): string {
  if (days <= 0) return 'يوم واحد';
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان';
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يوماً`;
}

/**
 * Resolves full assignment history for a specific vehicle with driver data and durations.
 * Returns sorted chronologically descending (newest first).
 */
export function resolveVehicleAssignmentHistory(
  vehicleId: string,
  assignments: AssignmentRecord[],
  drivers: DriverRecord[],
  referenceDateStr?: string
): VehicleAssignmentHistoryItem[] {
  const todayStr = referenceDateStr || new Date().toISOString().slice(0, 10);
  const driverMap = new Map<string, DriverRecord>();
  for (const d of drivers) {
    driverMap.set(d.driverId, d);
  }

  const vehicleAssignments = assignments.filter((a) => a.vehicleId === vehicleId);

  // Sort descending by startDate
  vehicleAssignments.sort((a, b) => {
    return b.startDate.localeCompare(a.startDate);
  });

  return vehicleAssignments.map((a) => {
    const drv = driverMap.get(a.driverId);
    const isActive = a.endDate === null;
    const endForCalc = a.endDate || todayStr;
    const durationDays = calculateDaysBetween(a.startDate, endForCalc);
    const formattedDuration = formatAssignmentDurationArabic(durationDays);

    let formattedPeriod: string;
    if (isActive) {
      formattedPeriod = `من ${a.startDate} حتى الآن (${formattedDuration})`;
    } else {
      formattedPeriod = `من ${a.startDate} إلى ${a.endDate} (${formattedDuration})`;
    }

    return {
      assignmentId: a.assignmentId,
      vehicleId: a.vehicleId,
      driverId: a.driverId,
      driverName: drv?.name || `سائق #${a.driverId}`,
      driverPhone: drv?.phone || '',
      driverWhatsapp: drv?.whatsapp || drv?.phone || null,
      startDate: a.startDate,
      endDate: a.endDate,
      isActive,
      durationDays,
      formattedDuration,
      formattedPeriod
    };
  });
}

/**
 * Resolves the currently active assignment and driver for a vehicle
 */
export function getActiveDriverForVehicle(
  vehicleId: string,
  assignments: AssignmentRecord[],
  drivers: DriverRecord[]
): { assignment: AssignmentRecord; driver: DriverRecord } | null {
  const activeAssignment = assignments.find((a) => a.vehicleId === vehicleId && a.endDate === null);
  if (!activeAssignment) return null;

  const driver = drivers.find((d) => d.driverId === activeAssignment.driverId);
  if (!driver) {
    return {
      assignment: activeAssignment,
      driver: {
        driverId: activeAssignment.driverId,
        name: `سائق #${activeAssignment.driverId}`,
        phone: '',
        whatsapp: null,
        email: null,
        active: true
      }
    };
  }

  return {
    assignment: activeAssignment,
    driver
  };
}
