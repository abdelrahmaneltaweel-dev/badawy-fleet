/**
 * Badawi Fleet Platform - Google Sheets Backup Repository
 * Ref: ADR-003 (Sheets backup only), ADR-009 (Repository Interface), ADR-006 (Apps Script bridge)
 * Implements IDataRepository for secondary backup storage and emergency data recovery.
 */

import type { CollectionName } from '../schema/types.js';
import type { IDataRepository, QueryOptions, BatchOperation } from './types.js';
import { InMemoryRepository } from './memory.js';

export interface SheetsBackupConfig {
  scriptAppUrl?: string;
  spreadsheetId?: string;
  secretToken?: string;
}

export class GoogleSheetsBackupRepository implements IDataRepository {
  public readonly name = 'GoogleSheetsBackupRepository';
  private inMemoryFallback: InMemoryRepository;
  private scriptAppUrl?: string;
  private spreadsheetId?: string;

  constructor(config?: SheetsBackupConfig) {
    this.scriptAppUrl = config?.scriptAppUrl;
    this.spreadsheetId = config?.spreadsheetId;
    this.inMemoryFallback = new InMemoryRepository();
  }

  async get<T>(collection: CollectionName, id: string): Promise<T | null> {
    if (this.scriptAppUrl) {
      try {
        const url = new URL(this.scriptAppUrl);
        url.searchParams.set('action', 'get');
        url.searchParams.set('sheet', collection);
        url.searchParams.set('id', id);
        if (this.spreadsheetId) url.searchParams.set('spreadsheetId', this.spreadsheetId);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          if (data && data.item) return data.item as T;
        }
      } catch {
        // Fallback to local memory cache on network error
      }
    }
    return this.inMemoryFallback.get<T>(collection, id);
  }

  async list<T>(collection: CollectionName, options?: QueryOptions): Promise<T[]> {
    if (this.scriptAppUrl) {
      try {
        const url = new URL(this.scriptAppUrl);
        url.searchParams.set('action', 'list');
        url.searchParams.set('sheet', collection);
        if (this.spreadsheetId) url.searchParams.set('spreadsheetId', this.spreadsheetId);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) return data.items as T[];
        }
      } catch {
        // Fallback to local memory cache
      }
    }
    return this.inMemoryFallback.list<T>(collection, options);
  }

  async create<T extends { schemaVersion?: number }>(
    collection: CollectionName,
    id: string,
    data: T
  ): Promise<T> {
    const created = await this.inMemoryFallback.create<T>(collection, id, data);

    if (this.scriptAppUrl) {
      try {
        await fetch(this.scriptAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'appendRow',
            sheet: collection,
            id,
            spreadsheetId: this.spreadsheetId,
            data: created
          })
        });
      } catch {
        // Log & proceed with local cached copy
      }
    }

    return created;
  }

  async update<T>(
    collection: CollectionName,
    id: string,
    data: Partial<T>
  ): Promise<T> {
    const updated = await this.inMemoryFallback.update<T>(collection, id, data);

    if (this.scriptAppUrl) {
      try {
        await fetch(this.scriptAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateRow',
            sheet: collection,
            id,
            spreadsheetId: this.spreadsheetId,
            data: updated
          })
        });
      } catch {
        // Proceed with local cached copy
      }
    }

    return updated;
  }

  async delete(collection: CollectionName, id: string): Promise<boolean> {
    const deleted = await this.inMemoryFallback.delete(collection, id);

    if (this.scriptAppUrl) {
      try {
        await fetch(this.scriptAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'deleteRow',
            sheet: collection,
            id,
            spreadsheetId: this.spreadsheetId
          })
        });
      } catch {
        // Proceed with local
      }
    }

    return deleted;
  }

  async batchWrite<T>(operations: BatchOperation<T>[]): Promise<void> {
    await this.inMemoryFallback.batchWrite(operations);
  }
}
