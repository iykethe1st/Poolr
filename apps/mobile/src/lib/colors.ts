import { useColorScheme } from 'react-native';

const light = {
  primary: '#155e3e',
  primaryLight: '#1a7a50',
  primaryForeground: '#ffffff',

  background: '#f0f9f4',
  card: '#ffffff',
  border: '#d1e8da',

  text: '#0a1f14',
  textMuted: '#5a7566',

  // semantic surfaces
  primaryBg: '#f0fdf4',
  primaryBorder: '#a7f3d0',
  primaryText: '#065f46',
  primaryTextMid: '#047857',

  successBg: '#dcfce7',
  successText: '#166534',

  dangerBg: '#fee2e2',
  dangerText: '#b91c1c',
  dangerBorder: '#fca5a5',

  warningBg: '#fef3c7',
  warningText: '#854d0e',

  infoBg: '#dbeafe',
  infoText: '#1e40af',

  mutedBg: '#f1f5f9',
  mutedText: '#475569',

  completedBg: '#e0e7ff',
  completedText: '#3730a3',

  inputBg: '#fafafa',

  // status-invariant
  destructive: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
};

const dark: typeof light = {
  primary: '#22c55e',
  primaryLight: '#4ade80',
  primaryForeground: '#ffffff',

  background: '#0a1a10',
  card: '#0f2318',
  border: '#1e3328',

  text: '#e8f5ed',
  textMuted: '#8aad98',

  primaryBg: '#052e16',
  primaryBorder: '#166534',
  primaryText: '#6ee7b7',
  primaryTextMid: '#4ade80',

  successBg: '#14532d',
  successText: '#4ade80',

  dangerBg: '#7f1d1d',
  dangerText: '#f87171',
  dangerBorder: '#dc2626',

  warningBg: '#78350f',
  warningText: '#fbbf24',

  infoBg: '#1e3a5f',
  infoText: '#93c5fd',

  mutedBg: '#1e293b',
  mutedText: '#94a3b8',

  completedBg: '#1e1b4b',
  completedText: '#a5b4fc',

  inputBg: '#0d1f14',

  destructive: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
};

export type Colors = typeof light;

export function useColors(): Colors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

// Keep the static export for the rare cases that need it outside a component
export const lightColors = light;
export const darkColors = dark;
