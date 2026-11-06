import { useState, useEffect } from 'preact/hooks';
import type { ComponentType } from 'preact';

export interface RouteConfig {
  path: string;
  component: () => Promise<{ default: ComponentType }>;
}

const componentCache = new Map<string, ComponentType>();

export function useRouter(routes: RouteConfig[]) {
  const getHash = () => window.location.hash.replace(/^#/, '') || '/';
  const [currentPath, setCurrentPath] = useState<string>(getHash);

  const initialRoute = routes.find(r => r.path === getHash()) || routes[0];
  const cachedInitial = initialRoute ? componentCache.get(initialRoute.path) || null : null;

  const [Component, setComponent] = useState<ComponentType | null>(() => cachedInitial);
  const [loading, setLoading] = useState<boolean>(!cachedInitial);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(getHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const activeRoute = routes.find(r => r.path === currentPath) || routes[0];

    if (!activeRoute) {
      setLoading(false);
      return;
    }

    if (componentCache.has(activeRoute.path)) {
      setComponent(() => componentCache.get(activeRoute.path)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    activeRoute.component().then(module => {
      if (isMounted) {
        componentCache.set(activeRoute.path, module.default);
        setComponent(() => module.default);
        setLoading(false);
      }
    }).catch(err => {
      console.error('Failed to load route:', err);
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentPath]);

  return { currentPath, Component, loading };
}