import { Platform } from 'react-native';

export type AppColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  card: string;
  primary: string;
  primarySoft: string;
  secondary: string;
  secondarySoft: string;
  accent: string;
  accentSoft: string;
  text: string;
  textMuted: string;
  border: string;
  white: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
  backdrop: string;
  overlayMuted: string;
  subtleLine: string;
};

export const lightColors: AppColors = {
  background: '#F4F7F3',
  surface: '#FFFFFF',
  surfaceMuted: '#E8EFE9',
  card: '#FAFBF8',
  primary: '#0E6B57',
  primarySoft: '#DDF1EA',
  secondary: '#D95F43',
  secondarySoft: '#FBE1D8',
  accent: '#A97F2F',
  accentSoft: '#F4E8C7',
  text: '#17231F',
  textMuted: '#66736C',
  border: '#DCE5DE',
  white: '#FFFFFF',
  success: '#2D7E69',
  warning: '#B6822D',
  danger: '#C75A57',
  overlay: '#16362F',
  backdrop: 'rgba(12, 30, 26, 0.62)',
  overlayMuted: 'rgba(255,255,255,0.12)',
  subtleLine: 'rgba(14, 107, 87, 0.08)',
} as const;

export const darkColors: AppColors = {
  background: '#111714',
  surface: '#18221D',
  surfaceMuted: '#223129',
  card: '#1D2923',
  primary: '#8CD8BC',
  primarySoft: '#263E35',
  secondary: '#FF8D6D',
  secondarySoft: '#4A2C25',
  accent: '#E0BF67',
  accentSoft: '#3F3521',
  text: '#F5FAF6',
  textMuted: '#B6C5BB',
  border: '#304238',
  white: '#FFFFFF',
  success: '#6CC7A7',
  warning: '#E4C06D',
  danger: '#F18A86',
  overlay: '#0D1511',
  backdrop: 'rgba(4, 9, 7, 0.82)',
  overlayMuted: 'rgba(255,255,255,0.08)',
  subtleLine: 'rgba(255,255,255,0.05)',
} as const;

export type ThemeMode = 'light' | 'dark';

export const colors = lightColors;

export const spacing = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 34,
} as const;

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

export const typography = {
  eyebrow: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '800' as const,
  },
  section: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800' as const,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400' as const,
  },
  bodyStrong: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
};

export const shadows = {
  card: {
    shadowColor: '#0A2028',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  soft: {
    shadowColor: '#0A2028',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === 'ios' ? 0.07 : 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
};
