/**
 * Badawi Fleet Platform - Firebase Firestore Web SDK Repository
 * Implements IDataRepository using the official Firebase Web SDK (v10+)
 * Ref: ADR-004, ADR-009
 */

import type { IDataRepository, QueryOptions, BatchOperation, CollectionName } from '@badawi/logic';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  limit as fsLimit
} from 'firebase/firestore';
import { firebaseService } from './firebase';

export class FirestoreWebRepository implements IDataRepository {
  public readonly name = 'FirestoreWebRepository';

  private getDb() {
    const db = firebaseService.getDb();
    if (!db) {
      throw new Error('قاعدة بيانات Firestore غير متصلة؛ يرجى التأكد من إعدادات Firebase');
    }
    return db;
  }

  async get<T>(colName: CollectionName, id: string): Promise<T | null> {
    try {
      const db = this.getDb();
      const docRef = doc(db, colName, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return snap.data() as T;
    } catch (err: unknown) {
      console.warn(`[FirestoreWebRepository] get(${colName}/${id}) error:`, err);
      return null;
    }
  }

  async list<T>(colName: CollectionName, options?: QueryOptions): Promise<T[]> {
    try {
      const db = this.getDb();
      const colRef = collection(db, colName);
      let q = query(colRef);
      if (options?.limit) {
        q = query(colRef, fsLimit(options.limit));
      }
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as T);
    } catch (err: unknown) {
      console.warn(`[FirestoreWebRepository] list(${colName}) error:`, err);
      return [];
    }
  }

  async create<T extends { schemaVersion?: number }>(
    colName: CollectionName,
    id: string,
    data: T
  ): Promise<T> {
    const db = this.getDb();
    const docRef = doc(db, colName, id);
    const payload = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    await setDoc(docRef, payload);
    return payload as T;
  }

  async update<T>(colName: CollectionName, id: string, data: Partial<T>): Promise<T> {
    const db = this.getDb();
    const docRef = doc(db, colName, id);
    const payload = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, payload as any);
    const updated = await this.get<T>(colName, id);
    return (updated || payload) as T;
  }

  async delete(colName: CollectionName, id: string): Promise<boolean> {
    try {
      const db = this.getDb();
      const docRef = doc(db, colName, id);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn(`[FirestoreWebRepository] delete(${colName}/${id}) error:`, err);
      return false;
    }
  }

  async batchWrite<T>(operations: BatchOperation<T>[]): Promise<void> {
    const db = this.getDb();
    const batch = writeBatch(db);

    for (const op of operations) {
      const docRef = doc(db, op.collection, op.id);
      if (op.type === 'create' && op.data) {
        batch.set(docRef, {
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...op.data
        });
      } else if (op.type === 'update' && op.data) {
        batch.update(docRef, {
          ...op.data,
          updatedAt: new Date().toISOString()
        } as any);
      } else if (op.type === 'delete') {
        batch.delete(docRef);
      }
    }

    await batch.commit();
  }
}
