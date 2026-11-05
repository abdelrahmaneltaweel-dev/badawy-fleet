import { CURRENT_SCHEMA_VERSION, type CollectionName } from './types.js';

export interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Migration registry per collection.
 */
const MIGRATION_REGISTRY: Record<string, MigrationStep[]> = {
  // Version 1 is the baseline schema. Future versions (v2, v3) register migration steps here.
};

export function migrateDocument(
  collection: CollectionName,
  rawDoc: Record<string, unknown>
): { doc: Record<string, unknown>; migrated: boolean } {
  let doc = { ...rawDoc };
  let currentVersion = typeof doc['schemaVersion'] === 'number' ? doc['schemaVersion'] : 0;
  let migrated = false;

  // Baseline normalization for legacy documents without schemaVersion
  if (currentVersion === 0) {
    doc['schemaVersion'] = 1;
    doc['createdAt'] = doc['createdAt'] || new Date().toISOString();
    doc['updatedAt'] = doc['updatedAt'] || new Date().toISOString();
    currentVersion = 1;
    migrated = true;
  }

  // Sequential migration execution if target version exceeds current
  const steps = MIGRATION_REGISTRY[collection] || [];
  for (const step of steps) {
    if (currentVersion === step.fromVersion && currentVersion < CURRENT_SCHEMA_VERSION) {
      doc = step.migrate(doc);
      doc['schemaVersion'] = step.toVersion;
      currentVersion = step.toVersion;
      migrated = true;
    }
  }

  return { doc, migrated };
}