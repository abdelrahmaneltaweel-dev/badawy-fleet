/**
 * Badawi Fleet Platform - Theme Helper
 * Re-exports from appearanceService for backward compatibility (ADR-024)
 */

import { appearanceService } from './services/appearance';

export type ThemeMode = 'light' | 'dark' | 'auto';

export function getStoredTheme(): ThemeMode {
  return appearanceService.getPreferences().themeMode;
}

export function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  appearanceService.setThemeMode(mode);
}

export function initTheme(): () => void {
  return appearanceService.init();
}