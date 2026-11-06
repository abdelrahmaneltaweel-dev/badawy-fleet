/**
 * Badawi Fleet Platform - In-Memory Repository
 * High-performance, zero-network repository for unit tests and local execution.
 */

import type { CollectionName } from '../schema/types.js';
import { validateDocument } from '../schema/validator.js';
import type {
  IDataRepository,
  QueryOptions,
  QueryFilter,
  BatchOperation
} from './types.js';

export class InMemoryRepository implements IDataRepository {
  public readonly name = 'InMemoryRepository';
  private stores = new Map<CollectionName, Map<string, Record<string, unknown>>>();

  constructor(initialData?: Partial<Record<CollectionName, Record<string, unknown>[]>>) {
    if (initialData) {
      for (const [col, docs] of Object.entries(initialData)) {
        const map = new Map<string, Record<string, unknown>>();
        for (const doc of docs) {
          const id = (doc['vehicleId'] || doc['driverId'] || doc['assignmentId'] ||
            doc['siteId'] || doc['inquiryId'] || doc['issueId'] || doc['statementId'] ||
            doc['summaryId'] || doc['requestId'] || doc['settingId'] || doc['logId'] ||
            doc['periodId'] || doc['id']) as string;
          if (id) {
            map.set(String(id), { ...doc });
          }
        }
        this.stores.set(col as CollectionName, map);
      }
    }
  }

  private getStore(collection: CollectionName): Map<string, Record<string, unknown>> {
    let store = this.stores.get(collection);
    if (!store) {
      store = new Map();
      this.stores.set(collection, store);
    }
    return store;
  }

  async get<T>(collection: CollectionName, id: string): Promise<T | null> {
    const store = this.getStore(collection);
    const item = store.get(id);
    if (!item) return null;
    return JSON.parse(JSON.stringify(item)) as T;
  }

  async list<T>(collection: CollectionName, options?: QueryOptions): Promise<T[]> {
    const store = this.getStore(collection);
    let items = Array.from(store.values());

    // Apply Filters
    if (options?.filters && options.filters.length > 0) {
      items = items.filter((item) => {
        return options.filters!.every((filter) => this.matchesFilter(item, filter));
      });
    }

    // Apply Sorting
    if (options?.sort && options.sort.length > 0) {
      items.sort((a, b) => {
        for (const s of options.sort!) {
          const valA = a[s.field];
          const valB = b[s.field];
          if (valA === valB) continue;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;

          const cmp = valA < valB ? -1 : 1;
          return s.direction === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
    }

    // Apply Offset & Limit
    if (options?.offset) {
      items = items.slice(options.offset);
    }
    if (options?.limit && options.limit > 0) {
      items = items.slice(0, options.limit);
    }

    return JSON.parse(JSON.stringify(items)) as T[];
  }

  async create<T extends { schemaVersion?: number }>(
    collection: CollectionName,
    id: string,
    data: T
  ): Promise<T> {
    const store = this.getStore(collection);
    if (store.has(id)) {
      throw new Error(`Document with ID "${id}" already exists in collection "${collection}"`);
    }

    const doc = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    } as unknown as Record<string, unknown>;

    // Validate with schema validator
    const val = validateDocument(collection, doc);
    if (!val.valid) {
      throw new Error(`Schema validation failed: ${val.errors.join(', ')}`);
    }

    store.set(id, JSON.parse(JSON.stringify(doc)));
    return doc as unknown as T;
  }

  async update<T>(
    collection: CollectionName,
    id: string,
    data: Partial<T>
  ): Promise<T> {
    const store = this.getStore(collection);
    const existing = store.get(id);
    if (!existing) {
      throw new Error(`Document with ID "${id}" not found in collection "${collection}"`);
    }

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString()
    };

    store.set(id, JSON.parse(JSON.stringify(updated)));
    return updated as unknown as T;
  }

  async delete(collection: CollectionName, id: string): Promise<boolean> {
    const store = this.getStore(collection);
    return store.delete(id);
  }

  async batchWrite<T>(operations: BatchOperation<T>[]): Promise<void> {
    for (const op of operations) {
      if (op.type === 'create' && op.data) {
        await this.create(op.collection, op.id, op.data as { schemaVersion?: number });
      } else if (op.type === 'update' && op.data) {
        await this.update(op.collection, op.id, op.data);
      } else if (op.type === 'delete') {
        await this.delete(op.collection, op.id);
      }
    }
  }

  private matchesFilter(item: Record<string, unknown>, filter: QueryFilter): boolean {
    const val = item[filter.field];
    const target = filter.value;

    switch (filter.op) {
      case '==':
        return val === target;
      case '!=':
        return val !== target;
      case '>':
        return typeof val === 'number' && typeof target === 'number' && val > target;
      case '>=':
        return typeof val === 'number' && typeof target === 'number' && val >= target;
      case '<':
        return typeof val === 'number' && typeof target === 'number' && val < target;
      case '<=':
        return typeof val === 'number' && typeof target === 'number' && val <= target;
      case 'in':
        return Array.isArray(target) && target.includes(val);
      case 'array-contains':
        return Array.isArray(val) && val.includes(target);
      default:
        return false;
    }
  }

  clear() {
    this.stores.clear();
  }
}
