// Design tokens for Shield Our Elders.
//
// Two full palettes (light + dark) plus accessibility-aware scaling for
// typography, icons, and tap targets. Everything the UI renders pulls from a
// resolved Theme object so light/dark and accessibility settings apply
// consistently across every screen.

export type ThemeMode = 'light' | 'dark';

export interface Palette {
  // Surfaces
  bg: string;
  bgWarm: string;
  surface: string;
  surfaceMuted: string;
  // Text
  ink: string;
  inkSoft: string;
  muted: string;
  faint: string;
  // Hairlines
  line: string;
  lineStrong: string;
  // Brand
  brand: string;
  brandDark: string;
  brandTint: string;
  brandTintSoft: string;
  onBrand: string;
  // Secondary accent
  accent: string;
  accentTint: string;
  // Informational
  info: string;
  infoTint: string;
  // Risk levels
  danger: string;
  dangerTint: string;
  dangerBorder: string;
  high: string;
  highTint: string;
  warn: string;
  warnTint: string;
  low: string;
  lowTint: string;
  // Misc
  white: string;
  overlay: string;
}

// Clean, modern, minimal — cool light-gray surfaces with a bright single
// green accent (adapted from the Mobile Apps Prototyping Kit style).
const lightPalette: Palette = {
  bg: '#F5F7FA',
  bgWarm: '#EDF1F6',
  surface: '#FFFFFF',
  surfaceMuted: '#EFF3F8',
  ink: '#0F1A2A',
  inkSoft: '#44506A',
  muted: '#6C7A90',
  faint: '#9AA7B8',
  line: '#E8ECF3',
  lineStrong: '#D7DFEA',
  brand: '#0F9E6A',
  brandDark: '#0B7E54',
  brandTint: '#E3F6EE',
  brandTintSoft: '#F1FBF6',
  onBrand: '#FFFFFF',
  accent: '#C2410C',
  accentTint: '#FCEEE2',
  info: '#3D4B5C',
  infoTint: '#EDF1F6',
  danger: '#E5484D',
  dangerTint: '#FDECEC',
  dangerBorder: '#F6BEBE',
  high: '#EA580C',
  highTint: '#FDEEE2',
  warn: '#B45911',
  warnTint: '#FBF2E2',
  low: '#0F9E6A',
  lowTint: '#E3F6EE',
  white: '#FFFFFF',
  overlay: 'rgba(12, 20, 34, 0.55)',
};

const darkPalette: Palette = {
  bg: '#0B1017',
  bgWarm: '#111926',
  surface: '#151D2A',
  surfaceMuted: '#1D2735',
  ink: '#EEF3F9',
  inkSoft: '#BAC5D4',
  muted: '#7F8C9D',
  faint: '#5E6B7D',
  line: '#232E3E',
  lineStrong: '#334050',
  brand: '#24C489',
  brandDark: '#159A6A',
  brandTint: '#122E24',
  brandTintSoft: '#0D2620',
  onBrand: '#FFFFFF',
  accent: '#E0995A',
  accentTint: '#332618',
  info: '#8A97A6',
  infoTint: '#1B2331',
  danger: '#F0575C',
  dangerTint: '#37191B',
  dangerBorder: '#5E2A2C',
  high: '#F1893F',
  highTint: '#33221A',
  warn: '#DDB24A',
  warnTint: '#2E2814',
  low: '#24C489',
  lowTint: '#122E24',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.66)',
};

// High-contrast reinforcement applied on top of a base palette.
function applyHighContrast(p: Palette, mode: ThemeMode): Palette {
  if (mode === 'dark') {
    return {
      ...p,
      bg: '#000000',
      surface: '#0C1114',
      surfaceMuted: '#141B20',
      ink: '#FFFFFF',
      inkSoft: '#E4EAEE',
      muted: '#B4BEC6',
      line: '#4A5760',
      lineStrong: '#697680',
      brand: '#3BE38A',
      onBrand: '#04210F',
    };
  }
  return {
    ...p,
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F2F2F2',
    ink: '#000000',
    inkSoft: '#1A2129',
    muted: '#3F4854',
    line: '#9AA1AB',
    lineStrong: '#6C7681',
    brand: '#0B7A34',
    danger: '#8E1B12',
  };
}

export const baseFont = {
  display: 32,
  h1: 27,
  h2: 23,
  h3: 20,
  body: 18,
  bodySm: 16,
  label: 14,
  tiny: 12.5,
};

export const weight = {
  regular: '500' as const,
  medium: '600' as const,
  semibold: '700' as const,
  bold: '800' as const,
};

export const baseSpace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
};

export type FontKey = keyof typeof baseFont;

export interface Theme {
  mode: ThemeMode;
  colors: Palette;
  space: typeof baseSpace;
  radius: typeof radius;
  weight: typeof weight;
  reducedMotion: boolean;
  // scale helpers
  font: (key: FontKey) => number;
  lineHeight: (key: FontKey) => number;
  icon: (size: number) => number;
  tap: (size: number) => number;
  shadow: (level: 'soft' | 'card' | 'raised') => object;
}

export interface ThemeInputs {
  mode: ThemeMode;
  highContrast: boolean;
  textScale: number; // 1.0, 1.15, 1.3
  iconScale: number; // 1.0, 1.15, 1.3
  tapScale: number; // 1.0, 1.15, 1.3
  reducedMotion: boolean;
}

export function resolvePalette(mode: ThemeMode, highContrast: boolean): Palette {
  const base = mode === 'dark' ? darkPalette : lightPalette;
  return highContrast ? applyHighContrast(base, mode) : base;
}

export function buildTheme(inputs: ThemeInputs): Theme {
  const colors = resolvePalette(inputs.mode, inputs.highContrast);
  const isDark = inputs.mode === 'dark';

  const shadowColor = isDark ? '#000000' : '#0B1B3A';
  const shadowMap = {
    soft: {
      shadowColor,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.45 : 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
    card: {
      shadowColor,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.55 : 0.11,
      shadowRadius: 24,
      elevation: 5,
    },
    raised: {
      shadowColor,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: isDark ? 0.65 : 0.18,
      shadowRadius: 36,
      elevation: 12,
    },
  };

  return {
    mode: inputs.mode,
    colors,
    space: baseSpace,
    radius,
    weight,
    reducedMotion: inputs.reducedMotion,
    font: (key) => Math.round(baseFont[key] * inputs.textScale),
    lineHeight: (key) => Math.round(baseFont[key] * inputs.textScale * 1.42),
    icon: (size) => Math.round(size * inputs.iconScale),
    tap: (size) => Math.round(size * inputs.tapScale),
    shadow: (level) => shadowMap[level],
  };
}
