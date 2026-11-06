/**
 * Badawi Fleet Platform - Curated Fonts & Appearance Settings
 * Ref: ADR-026, ADR-045, ADR-058
 */

export type CuratedFontId = 'ibm_plex' | 'tajawal' | 'cairo' | 'noto_sans';

export interface CuratedFontInfo {
  id: CuratedFontId;
  name: string;
  arabicName: string;
  cssFamily: string;
  license: 'OFL';
  isDefault: boolean;
}

export const CURATED_FONTS: CuratedFontInfo[] = [
  {
    id: 'ibm_plex',
    name: 'IBM Plex Sans Arabic',
    arabicName: 'آي بي إم بلكس (الافتراضي الرسمي للمنصة)',
    cssFamily: '"IBM Plex Sans Arabic", "Tajawal", "Segoe UI", Tahoma, system-ui, sans-serif',
    license: 'OFL',
    isDefault: true
  },
  {
    id: 'tajawal',
    name: 'Tajawal',
    arabicName: 'تجوّل (هادئ ومعاصر)',
    cssFamily: '"Tajawal", "IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif',
    license: 'OFL',
    isDefault: false
  },
  {
    id: 'cairo',
    name: 'Cairo',
    arabicName: 'كايرو (عصري وواضح)',
    cssFamily: '"Cairo", "Tajawal", "Segoe UI", Tahoma, system-ui, sans-serif',
    license: 'OFL',
    isDefault: false
  },
  {
    id: 'noto_sans',
    name: 'Noto Sans Arabic',
    arabicName: 'نوتو سانس (عالي المقروئية على الموبايل)',
    cssFamily: '"Noto Sans Arabic", "IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif',
    license: 'OFL',
    isDefault: false
  }
];

export const FONT_SIZE_BOUNDS = {
  min: 13,
  max: 18,
  default: 15
};

export interface UserPersonalPreferences {
  themeMode: 'auto' | 'light' | 'dark';
  fontFamily: CuratedFontId;
  baseFontSizePx: number;
  motionReduced: boolean;
}

export const DEFAULT_PERSONAL_PREFERENCES: UserPersonalPreferences = {
  themeMode: 'auto',
  fontFamily: 'ibm_plex',
  baseFontSizePx: FONT_SIZE_BOUNDS.default,
  motionReduced: false
};

export function getCuratedFont(id: string): CuratedFontInfo {
  return CURATED_FONTS.find((f) => f.id === id) || CURATED_FONTS[0];
}

export function validateFontSize(size: number): boolean {
  return typeof size === 'number' && !isNaN(size) && size >= FONT_SIZE_BOUNDS.min && size <= FONT_SIZE_BOUNDS.max;
}