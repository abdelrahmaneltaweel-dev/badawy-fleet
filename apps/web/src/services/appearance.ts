/**
 * Badawi Fleet Platform - Appearance & User Preferences Service
 * Handles live CSS variables, fonts, sizes, and theme modes with anti-flicker (ADR-024, ADR-040, ADR-058)
 */

import {
  type CuratedFontId,
  type UserPersonalPreferences,
  CURATED_FONTS,
  FONT_SIZE_BOUNDS,
  DEFAULT_PERSONAL_PREFERENCES,
  getCuratedFont,
  validateFontSize
} from '@badawi/logic';

const APPEARANCE_STORAGE_KEY = 'badawi_user_appearance_pref_v1';

export type AppearanceListener = (prefs: UserPersonalPreferences) => void;
const listeners = new Set<AppearanceListener>();

function loadStoredPreferences(): UserPersonalPreferences {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        themeMode: parsed.themeMode || 'auto',
        fontFamily: parsed.fontFamily || 'ibm_plex',
        baseFontSizePx: validateFontSize(parsed.baseFontSizePx) ? parsed.baseFontSizePx : FONT_SIZE_BOUNDS.default,
        motionReduced: Boolean(parsed.motionReduced)
      };
    }
  } catch {
    // Ignore storage errors
  }
  return { ...DEFAULT_PERSONAL_PREFERENCES };
}

let currentPreferences: UserPersonalPreferences = loadStoredPreferences();

function notify() {
  listeners.forEach((fn) => fn(currentPreferences));
}

function resolveTheme(mode: 'auto' | 'light' | 'dark'): 'light' | 'dark' {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export const appearanceService = {
  getPreferences(): UserPersonalPreferences {
    return { ...currentPreferences };
  },

  getCuratedFonts() {
    return CURATED_FONTS;
  },

  getResolvedTheme(): 'light' | 'dark' {
    return resolveTheme(currentPreferences.themeMode);
  },

  setThemeMode(mode: 'auto' | 'light' | 'dark') {
    currentPreferences.themeMode = mode;
    this.saveAndApply(true);
  },

  toggleThemeMode() {
    const nextMode = currentPreferences.themeMode === 'light' ? 'dark' : currentPreferences.themeMode === 'dark' ? 'auto' : 'light';
    this.setThemeMode(nextMode);
  },

  setFontFamily(fontId: CuratedFontId) {
    currentPreferences.fontFamily = fontId;
    this.saveAndApply(false);
  },

  setBaseFontSize(sizePx: number) {
    if (!validateFontSize(sizePx)) return;
    currentPreferences.baseFontSizePx = sizePx;
    this.saveAndApply(false);
  },

  setMotionReduced(reduced: boolean) {
    currentPreferences.motionReduced = reduced;
    this.saveAndApply(false);
  },

  resetToDefaults() {
    currentPreferences = { ...DEFAULT_PERSONAL_PREFERENCES };
    this.saveAndApply(true);
  },

  saveAndApply(animateTheme = false) {
    const root = document.documentElement;

    // Apply Theme
    const resolvedTheme = resolveTheme(currentPreferences.themeMode);
    if (animateTheme && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !currentPreferences.motionReduced) {
      root.classList.add('theme-transition');
      window.setTimeout(() => root.classList.remove('theme-transition'), 400);
    }
    root.setAttribute('data-theme', resolvedTheme);

    // Apply Font Family
    const fontInfo = getCuratedFont(currentPreferences.fontFamily);
    root.setAttribute('data-font', fontInfo.id);
    root.style.setProperty('--font-family', fontInfo.cssFamily);

    // Apply Font Size
    root.style.setProperty('--font-size-base', `${currentPreferences.baseFontSizePx}px`);

    // Apply Motion Preference
    if (currentPreferences.motionReduced) {
      root.setAttribute('data-motion', 'reduced');
    } else {
      root.removeAttribute('data-motion');
    }

    // Persist to storage
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(currentPreferences));
      localStorage.setItem('badawi-theme', currentPreferences.themeMode);
    } catch {
      // Ignore
    }

    notify();
  },

  init(): () => void {
    if (typeof window === 'undefined') return () => {};

    // Apply on startup
    this.saveAndApply(false);

    // Listen to OS theme changes if on auto mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const osListener = () => {
      if (currentPreferences.themeMode === 'auto') {
        this.saveAndApply(true);
      }
    };
    mediaQuery.addEventListener('change', osListener);

    return () => mediaQuery.removeEventListener('change', osListener);
  },

  subscribe(listener: AppearanceListener): () => void {
    listeners.add(listener);
    listener(currentPreferences);
    return () => listeners.delete(listener);
  }
};