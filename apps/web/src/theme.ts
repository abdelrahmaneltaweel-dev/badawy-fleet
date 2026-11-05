export type ThemeMode = 'light' | 'dark' | 'auto';

const THEME_STORAGE_KEY = 'badawi-theme';

export function getStoredTheme(): ThemeMode {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'auto') {
      return val;
    }
  } catch {
    // LocalStorage unavailable
  }
  return 'auto';
}

export function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode, animate = true) {
  const root = document.documentElement;
  const resolved = getResolvedTheme(mode);

  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-transition');
    window.setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 400);
  }

  root.setAttribute('data-theme', resolved);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function initTheme(): () => void {
  const mode = getStoredTheme();
  applyTheme(mode, false);

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    if (getStoredTheme() === 'auto') {
      applyTheme('auto', true);
    }
  };

  mediaQuery.addEventListener('change', listener);
  return () => mediaQuery.removeEventListener('change', listener);
}