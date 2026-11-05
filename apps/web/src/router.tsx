import { useState, useEffect } from 'preact/hooks';
import type { ComponentType } from 'preact';

export interface RouteConfig {
  path: string;
  component: () => Promise<{ default: ComponentType }>;
}

export function useRouter(routes: RouteConfig[]) {
  const getHash = () => window.location.hash.replace(/^#/, '') || '/';
  const [currentPath, setCurrentPath] = useState<string>(getHash);
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(getHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const activeRoute = routes.find(r => r.path === currentPath) || routes[0];

    activeRoute.component().then(module => {
      if (isMounted) {
        setComponent(() => module.default);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentPath]);

  return { currentPath, Component, loading };
}