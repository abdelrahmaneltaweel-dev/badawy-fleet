/**
 * Badawi Fleet Platform - Repository Factory
 * Ref: ADR-009 (تبديل المخزن بملف واحد / Single-file store swap)
 */

import type { IDataRepository, RepositoryConfig } from './types.js';
import { InMemoryRepository } from './memory.js';
import { FirestoreRestRepository } from './firestore.js';
import { GoogleSheetsBackupRepository } from './sheets.js';

let activeRepositoryInstance: IDataRepository | null = null;
let currentConfig: RepositoryConfig = {
  provider: 'memory'
};

/**
 * Creates an IDataRepository instance based on config.
 */
export function createRepository(config: RepositoryConfig): IDataRepository {
  switch (config.provider) {
    case 'firestore':
      if (!config.projectId) {
        throw new Error('Firestore repository requires projectId in config');
      }
      return new FirestoreRestRepository({
        projectId: config.projectId,
        apiKey: config.apiKey,
        authToken: config.authToken
      });

    case 'sheets':
      return new GoogleSheetsBackupRepository({
        scriptAppUrl: config.sheetsAppUrl,
        spreadsheetId: config.sheetsSpreadsheetId
      });

    case 'memory':
    case 'local':
    default:
      return new InMemoryRepository();
  }
}

/**
 * Gets or initializes the singleton active data repository.
 */
export function getActiveRepository(): IDataRepository {
  if (!activeRepositoryInstance) {
    activeRepositoryInstance = createRepository(currentConfig);
  }
  return activeRepositoryInstance;
}

/**
 * Swaps the global repository provider dynamically with a single call (ADR-009).
 */
export function switchRepository(config: RepositoryConfig): IDataRepository {
  currentConfig = { ...config };
  activeRepositoryInstance = createRepository(currentConfig);
  return activeRepositoryInstance;
}

/**
 * Inspects current active repository configuration.
 */
export function getCurrentRepositoryConfig(): RepositoryConfig {
  return { ...currentConfig };
}
