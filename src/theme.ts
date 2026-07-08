// Design tokens for Shield Our Elders.
// A warm, high-contrast, senior-friendly system: paper-toned surfaces, a calm
// pine-teal brand, a warm amber secondary accent, and clear risk colors.

export const colors = {
  // Surfaces
  bg: '#F3F1EA', // warm paper background
  bgWarm: '#ECE9E0',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F5EF',

  // Text
  ink: '#1B2430',
  inkSoft: '#3E4854',
  muted: '#6A7484',
  faint: '#98A0AC',

  // Hairlines
  line: '#E7E2D7',
  lineStrong: '#DAD3C5',

  // Brand (calm pine teal)
  brand: '#0B6E69',
  brandDark: '#075650',
  brandTint: '#E1F0EC',
  brandTintSoft: '#EEF6F4',

  // Secondary accent (warm amber, used for "learn"/highlights)
  accent: '#A9691F',
  accentTint: '#F7EDDC',

  // Informational (deep sky, used for labels/eyebrows)
  info: '#245B8C',
  infoTint: '#E7F0F8',

  // Risk colors (kept in sync with scamAnalyzer.getLevelColor)
  danger: '#B42318',
  dangerTint: '#FBEBE9',
  dangerBorder: '#F1B0A9',
  high: '#C2410C',
  highTint: '#FAEDE4',
  warn: '#B7791F',
  warnTint: '#FAF2E1',
  low: '#0B6E69',
  lowTint: '#E9F3F0',

  white: '#FFFFFF',
};

export const radius = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const font = {
  display: 30,
  h1: 26,
  h2: 22,
  h3: 19,
  body: 18,
  bodySm: 16,
  label: 14,
  tiny: 12,
};

export const weight = {
  regular: '500' as const,
  medium: '600' as const,
  semibold: '700' as const,
  bold: '800' as const,
};

export const shadow = {
  soft: {
    shadowColor: '#3A3324',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  card: {
    shadowColor: '#3A3324',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  raised: {
    shadowColor: '#1B2430',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 6,
  },
};
