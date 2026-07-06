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
  background: '#F7F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEEBF7',
  card: '#FBFAFD',
  primary: '#5B2BCB',
  primarySoft: '#EEE8FC',
  secondary: '#E65436',
  secondarySoft: '#FCE6DF',
  accent: '#18856B',
  accentSoft: '#DDF3EC',
  text: '#211B2E',
  textMuted: '#6E6878',
  border: '#E2DEEA',
  white: '#FFFFFF',
  success: '#18856B',
  warning: '#B77818',
  danger: '#C75A57',
  overlay: '#241347',
  backdrop: 'rgba(27, 19, 42, 0.66)',
  overlayMuted: 'rgba(255,255,255,0.12)',
  subtleLine: 'rgba(91, 43, 203, 0.08)',
} as const;

export const darkColors: AppColors = {
  background: '#15121C',
  surface: '#201A2A',
  surfaceMuted: '#2A2336',
  card: '#261F31',
  primary: '#B9A0F5',
  primarySoft: '#382B57',
  secondary: '#FF8D70',
  secondarySoft: '#4C2B27',
  accent: '#70D0B2',
  accentSoft: '#213F37',
  text: '#FAF8FD',
  textMuted: '#C4BDCE',
  border: '#3C3349',
  white: '#FFFFFF',
  success: '#70D0B2',
  warning: '#E4C06D',
  danger: '#F18A86',
  overlay: '#110D18',
  backdrop: 'rgba(8, 6, 12, 0.84)',
  overlayMuted: 'rgba(255,255,255,0.08)',
  subtleLine: 'rgba(255,255,255,0.05)',
} as const;

export type ThemeMode = 'light' | 'dark';

export const colors = lightColors;

export const spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
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
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800' as const,
  },
  section: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800' as const,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
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
    fontSize: 11,
    lineHeight: 17,
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
