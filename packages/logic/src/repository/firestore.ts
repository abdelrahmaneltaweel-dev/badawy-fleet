/**
 * Badawi Fleet Platform - Firestore REST Repository
 * Ref: ADR-004 (Firebase Spark), ADR-009 (Repository Interface)
 * Implements IDataRepository using standard fetch and Firestore REST API (no bloated SDKs required).
 */

import type { CollectionName } from '../schema/types.js';
import type { IDataRepository, QueryOptions, BatchOperation } from './types.js';

export interface FirestoreRestConfig {
  projectId: string;
  apiKey?: string;
  authToken?: string;
  databaseId?: string;
}

export class FirestoreRestRepository implements IDataRepository {
  public readonly name = 'FirestoreRestRepository';
  private projectId: string;
  private apiKey?: string;
  private authToken?: string;
  private databaseId: string;
  private baseUrl: string;

  constructor(config: FirestoreRestConfig) {
    this.projectId = config.projectId;
    this.apiKey = config.apiKey;
    this.authToken = config.authToken;
    this.databaseId = config.databaseId || '(default)';
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  private getUrl(path: string): string {
    const url = new URL(`${this.baseUrl}/${path}`);
    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }
    return url.toString();
  }

  async get<T>(collection: CollectionName, id: string): Promise<T | null> {
    try {
      const res = await fetch(this.getUrl(`${collection}/${id}`), {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Firestore GET failed [${res.status}]: ${await res.text()}`);
      }

      const doc = await res.json();
      return this.fromFirestoreDocument(doc) as T;
    } catch (err: unknown) {
      if ((err as Error)?.message?.includes('404')) return null;
      throw err;
    }
  }

  async list<T>(collection: CollectionName, options?: QueryOptions): Promise<T[]> {
    try {
      // Build structured query if filters or sort are present
      if ((options?.filters && options.filters.length > 0) || (options?.sort && options.sort.length > 0) || options?.limit) {
        return await this.runStructuredQuery<T>(collection, options);
      }

      const res = await fetch(this.getUrl(collection), {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!res.ok) {
        throw new Error(`Firestore LIST failed [${res.status}]: ${await res.text()}`);
      }

      const body = await res.json();
      const documents = body.documents || [];
      return documents.map((doc: unknown) => this.fromFirestoreDocument(doc)) as T[];
    } catch {
      return [];
    }
  }

  async create<T extends { schemaVersion?: number }>(
    collection: CollectionName,
    id: string,
    data: T
  ): Promise<T> {
    const url = new URL(this.getUrl(collection));
    url.searchParams.set('documentId', id);

    const doc = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        fields: this.toFirestoreFields(doc as unknown as Record<string, unknown>)
      })
    });

    if (!res.ok) {
      throw new Error(`Firestore CREATE failed [${res.status}]: ${await res.text()}`);
    }

    const created = await res.json();
    return this.fromFirestoreDocument(created) as T;
  }

  async update<T>(
    collection: CollectionName,
    id: string,
    data: Partial<T>
  ): Promise<T> {
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    const fields = this.toFirestoreFields(updateData as unknown as Record<string, unknown>);
    const fieldMask = Object.keys(updateData)
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join('&');

    const rawUrl = this.getUrl(`${collection}/${id}`);
    const sep = rawUrl.includes('?') ? '&' : '?';
    const finalUrl = fieldMask ? `${rawUrl}${sep}${fieldMask}` : rawUrl;

    const res = await fetch(finalUrl, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ fields })
    });

    if (!res.ok) {
      throw new Error(`Firestore UPDATE failed [${res.status}]: ${await res.text()}`);
    }

    const updated = await res.json();
    return this.fromFirestoreDocument(updated) as T;
  }

  async delete(collection: CollectionName, id: string): Promise<boolean> {
    const res = await fetch(this.getUrl(`${collection}/${id}`), {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    return res.ok || res.status === 404;
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

  private async runStructuredQuery<T>(collection: CollectionName, options: QueryOptions): Promise<T[]> {
    const parent = `projects/${this.projectId}/databases/${this.databaseId}/documents`;
    const queryUrl = `https://firestore.googleapis.com/v1/${parent}:runQuery${this.apiKey ? `?key=${this.apiKey}` : ''}`;

    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: collection }]
    };

    if (options.limit) {
      structuredQuery['limit'] = options.limit;
    }

    if (options.offset) {
      structuredQuery['offset'] = options.offset;
    }

    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ structuredQuery })
    });

    if (!res.ok) {
      throw new Error(`Firestore query failed [${res.status}]: ${await res.text()}`);
    }

    const results = await res.json();
    const items: T[] = [];
    for (const row of results) {
      if (row.document) {
        items.push(this.fromFirestoreDocument(row.document) as T);
      }
    }
    return items;
  }

  // --- Serialization & Deserialization Helpers ---
  public toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      fields[key] = this.toFirestoreValue(val);
    }
    return fields;
  }

  public toFirestoreValue(val: unknown): Record<string, unknown> {
    if (val === null || val === undefined) {
      return { nullValue: null };
    }
    if (typeof val === 'string') {
      return { stringValue: val };
    }
    if (typeof val === 'boolean') {
      return { booleanValue: val };
    }
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        return { integerValue: String(val) };
      }
      return { doubleValue: val };
    }
    if (Array.isArray(val)) {
      return {
        arrayValue: {
          values: val.map((v) => this.toFirestoreValue(v))
        }
      };
    }
    if (typeof val === 'object') {
      return {
        mapValue: {
          fields: this.toFirestoreFields(val as Record<string, unknown>)
        }
      };
    }
    return { stringValue: String(val) };
  }

  public fromFirestoreDocument(doc: any): Record<string, unknown> {
    if (!doc || !doc.fields) return {};
    const res: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(doc.fields)) {
      res[key] = this.fromFirestoreValue(val as Record<string, unknown>);
    }
    return res;
  }

  public fromFirestoreValue(val: Record<string, any>): unknown {
    if (!val) return null;
    if ('stringValue' in val) return val.stringValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return parseFloat(val.doubleValue);
    if ('nullValue' in val) return null;
    if ('timestampValue' in val) return val.timestampValue;
    if ('arrayValue' in val) {
      const arr = val.arrayValue?.values || [];
      return arr.map((item: any) => this.fromFirestoreValue(item));
    }
    if ('mapValue' in val) {
      const fields = val.mapValue?.fields || {};
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        obj[k] = this.fromFirestoreValue(v as Record<string, any>);
      }
      return obj;
    }
    return null;
  }
}
