/**
 * Badawi Fleet Platform - Repository Pattern Interface
 * Ref: ADR-003, ADR-004, ADR-009 (Data layer isolation & single-file store swap)
 */

import type { CollectionName } from '../schema/types.js';

export type FilterOperator = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'array-contains';

export interface QueryFilter {
  field: string;
  op: FilterOperator;
  value: unknown;
}

export interface QuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryOptions {
  filters?: QueryFilter[];
  sort?: QuerySort[];
  limit?: number;
  offset?: number;
}

export interface BatchOperation<T = Record<string, unknown>> {
  type: 'create' | 'update' | 'delete';
  collection: CollectionName;
  id: string;
  data?: T;
}

/**
 * Universal Repository Interface (ADR-009)
 * Decouples logic and UI layers from the concrete physical storage.
 */
export interface IDataRepository {
  readonly name: string;

  get<T>(collection: CollectionName, id: string): Promise<T | null>;

  list<T>(collection: CollectionName, options?: QueryOptions): Promise<T[]>;

  create<T extends { schemaVersion?: number }>(
    collection: CollectionName,
    id: string,
    data: T
  ): Promise<T>;

  update<T>(
    collection: CollectionName,
    id: string,
    data: Partial<T>
  ): Promise<T>;

  delete(collection: CollectionName, id: string): Promise<boolean>;

  batchWrite?<T>(operations: BatchOperation<T>[]): Promise<void>;
}

export type RepositoryProviderType = 'memory' | 'local' | 'firestore' | 'sheets';

export interface RepositoryConfig {
  provider: RepositoryProviderType;
  projectId?: string;
  apiKey?: string;
  authToken?: string;
  sheetsAppUrl?: string;
  sheetsSpreadsheetId?: string;
}
