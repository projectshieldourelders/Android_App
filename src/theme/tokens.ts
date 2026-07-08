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

const lightPalette: Palette = {
  bg: '#F3F1EA',
  bgWarm: '#ECE9E0',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F3ED',
  ink: '#1B2430',
  inkSoft: '#3E4854',
  muted: '#6A7484',
  faint: '#98A0AC',
  line: '#E4DFD4',
  lineStrong: '#D3CCBD',
  brand: '#0B6E69',
  brandDark: '#075650',
  brandTint: '#E1F0EC',
  brandTintSoft: '#EEF6F4',
  onBrand: '#FFFFFF',
  accent: '#A9691F',
  accentTint: '#F7EDDC',
  info: '#245B8C',
  infoTint: '#E7F0F8',
  danger: '#B42318',
  dangerTint: '#FBEBE9',
  dangerBorder: '#F1B0A9',
  high: '#C2410C',
  highTint: '#FAEDE4',
  warn: '#9A6410',
  warnTint: '#FAF2E1',
  low: '#0B6E69',
  lowTint: '#E9F3F0',
  white: '#FFFFFF',
  overlay: 'rgba(20, 26, 33, 0.45)',
};

const darkPalette: Palette = {
  bg: '#0E1316',
  bgWarm: '#141B1F',
  surface: '#182026',
  surfaceMuted: '#1F282F',
  ink: '#F0F4F6',
  inkSoft: '#C3CCD3',
  muted: '#8A96A0',
  faint: '#68727B',
  line: '#2A343C',
  lineStrong: '#3C4852',
  brand: '#1CA294',
  brandDark: '#15837A',
  brandTint: '#123531',
  brandTintSoft: '#0F2A27',
  onBrand: '#FFFFFF',
  accent: '#D6944A',
  accentTint: '#312619',
  info: '#5CA2DA',
  infoTint: '#152A3A',
  danger: '#F0685B',
  dangerTint: '#361B19',
  dangerBorder: '#5C2A26',
  high: '#E88A50',
  highTint: '#31221A',
  warn: '#DBB24A',
  warnTint: '#2D2715',
  low: '#1CA294',
  lowTint: '#123531',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.62)',
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
      brand: '#3FD3C2',
      onBrand: '#00110F',
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
    brand: '#0A544F',
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

  const shadowColor = isDark ? '#000000' : '#3A3324';
  const shadowMap = {
    soft: {
      shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.05,
      shadowRadius: 8,
      elevation: 1,
    },
    card: {
      shadowColor,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.5 : 0.07,
      shadowRadius: 16,
      elevation: 2,
    },
    raised: {
      shadowColor,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.6 : 0.16,
      shadowRadius: 22,
      elevation: 6,
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
