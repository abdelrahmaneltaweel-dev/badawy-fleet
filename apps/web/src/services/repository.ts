/**
 * Badawi Fleet Platform - Web Data Repository Service
 * Ref: ADR-004 (Firebase Spark), ADR-009 (Repository Interface / تبديل المخزن بملف واحد)
 * Provides centralized data repository access with single-file provider switching.
 */

import {
  type IDataRepository,
  type RepositoryConfig,
  type RepositoryProviderType,
  createRepository,
  switchRepository
} from '@badawi/logic';

const REPO_PROVIDER_STORAGE_KEY = 'badawi_repo_provider_v1';

// Initial repository configuration (Default: local/memory with localStorage persistence)
const initialConfig: RepositoryConfig = (() => {
  try {
    const raw = localStorage.getItem(REPO_PROVIDER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }
  return {
    provider: 'local' as RepositoryProviderType
  };
})();

// Active repository instance initialized via factory
let currentRepo: IDataRepository = createRepository(initialConfig);

type RepoListener = (provider: RepositoryProviderType) => void;
const listeners = new Set<RepoListener>();

function notify() {
  const provider = (currentRepo as any).provider || 'local';
  listeners.forEach((fn) => fn(provider));
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
   * Swaps repository provider dynamically in a single call (ADR-009).
   */
  setProvider(config: RepositoryConfig): IDataRepository {
    currentRepo = switchRepository(config);
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

export const appRepository = repositoryService.getRepository();
