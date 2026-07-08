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
  bg: '#F4F6F9',
  bgWarm: '#EAEEF3',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F5F8',
  ink: '#101623',
  inkSoft: '#3A4453',
  muted: '#697586',
  faint: '#9AA4B2',
  line: '#E6E9EF',
  lineStrong: '#D3D8E0',
  brand: '#16A34A',
  brandDark: '#12833C',
  brandTint: '#E4F7EC',
  brandTintSoft: '#F1FBF5',
  onBrand: '#FFFFFF',
  accent: '#B45309',
  accentTint: '#FBEFDD',
  info: '#3D4B5C',
  infoTint: '#EDF0F4',
  danger: '#DC2626',
  dangerTint: '#FDECEC',
  dangerBorder: '#F6B4AE',
  high: '#EA580C',
  highTint: '#FDEEE2',
  warn: '#B45911',
  warnTint: '#FBF2E2',
  low: '#16A34A',
  lowTint: '#E4F7EC',
  white: '#FFFFFF',
  overlay: 'rgba(16, 22, 35, 0.5)',
};

const darkPalette: Palette = {
  bg: '#0C1116',
  bgWarm: '#131A21',
  surface: '#161D25',
  surfaceMuted: '#1E262F',
  ink: '#EEF2F6',
  inkSoft: '#C0C9D3',
  muted: '#8A94A0',
  faint: '#69737E',
  line: '#242E38',
  lineStrong: '#36414D',
  brand: '#22B463',
  brandDark: '#178C4A',
  brandTint: '#12331F',
  brandTintSoft: '#0E2818',
  onBrand: '#FFFFFF',
  accent: '#D8944A',
  accentTint: '#31261A',
  info: '#8A97A6',
  infoTint: '#1B222B',
  danger: '#F26157',
  dangerTint: '#37191A',
  dangerBorder: '#5C2A2A',
  high: '#F1893F',
  highTint: '#33221A',
  warn: '#DDB24A',
  warnTint: '#2E2814',
  low: '#22B463',
  lowTint: '#12331F',
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

  const shadowColor = isDark ? '#000000' : '#101828';
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
