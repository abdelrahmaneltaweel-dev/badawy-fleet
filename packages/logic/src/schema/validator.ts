import type { CollectionName } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateDocument(
  collection: CollectionName,
  data: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Document data must be an object'] };
  }

  // Base Document validation
  if (typeof data['schemaVersion'] !== 'number') {
    errors.push('Missing or invalid schemaVersion (must be number)');
  }

  // Specific Collection validations
  switch (collection) {
    case 'vehicles':
      if (!data['vehicleId'] || typeof data['vehicleId'] !== 'string') {
        errors.push('Missing or invalid vehicleId');
      }
      if (!['tractor', 'truck', 'private'].includes(data['type'] as string)) {
        errors.push('Vehicle type must be tractor, truck, or private');
      }
      break;

    case 'drivers':
      if (!data['driverId'] || typeof data['driverId'] !== 'string') {
        errors.push('Missing or invalid driverId');
      }
      if (!data['name'] || typeof data['name'] !== 'string') {
        errors.push('Missing or invalid driver name');
      }
      break;

    case 'assignments':
      if (!data['vehicleId'] || !data['driverId'] || !data['startDate']) {
        errors.push('Assignment requires vehicleId, driverId, and startDate');
      }
      break;

    case 'sites':
      if (!data['siteId'] || typeof data['latitude'] !== 'number' || typeof data['longitude'] !== 'number') {
        errors.push('Site requires siteId, latitude, and longitude');
      }
      break;

    case 'inquiries':
      if (!data['inquiryId'] || !data['vehicleId'] || !data['question']) {
        errors.push('Inquiry requires inquiryId, vehicleId, and question');
      }
      break;

    case 'issues':
      if (!data['issueId'] || !data['vehicleId'] || !data['type']) {
        errors.push('Issue requires issueId, vehicleId, and type');
      }
      break;

    case 'statements':
      if (!data['statementId'] || !data['date'] || !data['vehicleId']) {
        errors.push('Statement requires statementId, date, and vehicleId');
      }
      break;

    case 'daily_summaries':
      if (!data['summaryId'] || !data['date'] || !data['vehicleId']) {
        errors.push('Daily summary requires summaryId, date, and vehicleId');
      }
      break;

    case 'petro_requests':
      if (!data['requestId'] || typeof data['amount'] !== 'number') {
        errors.push('Petro request requires requestId and numeric amount');
      }
      break;

    case 'settings':
      if (!data['settingId'] || typeof data['data'] !== 'object') {
        errors.push('Settings requires settingId and data object');
      }
      break;

    case 'audit_logs':
      if (!data['logId'] || !data['action'] || !data['collection']) {
        errors.push('Audit log requires logId, action, and collection');
      }
      break;

    case 'period_snapshots':
      if (!data['periodId'] || typeof data['frozen'] !== 'boolean') {
        errors.push('Period snapshot requires periodId and frozen flag');
      }
      break;

    case 'daily_snapshots':
      if (!data['snapshotId'] || !data['date'] || !data['fleetTotals'] || !Array.isArray(data['vehicles'])) {
        errors.push('Daily snapshot requires snapshotId, date, fleetTotals, and vehicles array');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}