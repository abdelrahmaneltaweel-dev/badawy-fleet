/**
 * Badawi Fleet Platform - Web Data Repository Service
 * Ref: ADR-004 (Firebase Spark), ADR-009 (Repository Interface / تبديل المخزن بملف واحد)
 * Provides centralized data repository access with single-file provider switching.
 */

import {
  type IDataRepository,
  type RepositoryConfig,
  type RepositoryProviderType,
  createRepository
} from '@badawi/logic';
import { firebaseService } from './firebase';
import { FirestoreWebRepository } from './firestoreWebRepo';

const REPO_PROVIDER_STORAGE_KEY = 'badawi_repo_provider_v1';

// Initial repository configuration (Default: local/memory, or firestore if configured)
const initialConfig: RepositoryConfig = (() => {
  try {
    const raw = localStorage.getItem(REPO_PROVIDER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }
  if (firebaseService.isConfigured()) {
    const fbCfg = firebaseService.getConfig();
    return {
      provider: 'firestore' as RepositoryProviderType,
      projectId: fbCfg?.projectId,
      apiKey: fbCfg?.apiKey
    };
  }
  return {
    provider: 'local' as RepositoryProviderType
  };
})();

function createWebRepositoryInstance(config: RepositoryConfig): IDataRepository {
  if (config.provider === 'firestore' && firebaseService.isConfigured()) {
    return new FirestoreWebRepository();
  }
  return createRepository(config);
}

// Active repository instance initialized via factory
let currentRepo: IDataRepository = createWebRepositoryInstance(initialConfig);

type RepoListener = (provider: RepositoryProviderType) => void;
const listeners = new Set<RepoListener>();

function notify() {
  const provider = (currentRepo as any).provider || currentRepo.name || 'local';
  listeners.forEach((fn) => fn(provider as any));
}

export const repositoryService = {
  /**
   * Retrieves the current active repository.
   */
  getRepository(): IDataRepository {
    return currentRepo;
  },

  /**
   * Returns current active provider name.
   */
  getActiveProvider(): string {
    return currentRepo.name;
  },

  /**
   * Whether currently connected to real Firestore.
   */
  isFirestore(): boolean {
    return currentRepo instanceof FirestoreWebRepository || currentRepo.name.includes('Firestore');
  },

  /**
   * Swaps repository provider dynamically in a single call (ADR-009).
   */
  setProvider(config: RepositoryConfig): IDataRepository {
    currentRepo = createWebRepositoryInstance(config);
    try {
      localStorage.setItem(REPO_PROVIDER_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore
    }
    notify();
    return currentRepo;
  },

  subscribe(listener: RepoListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

/**
 * Proxy appRepository so callers always execute against the active repository
 */
export const appRepository: IDataRepository = new Proxy({} as IDataRepository, {
  get(_, prop) {
    const target = repositoryService.getRepository();
    const val = (target as any)[prop];
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
  }
});
