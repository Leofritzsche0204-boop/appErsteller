// Farben und Abstände an einer Stelle, damit die App einheitlich aussieht.

export const colors = {
  background: '#0B0F14',
  surface: '#151B23',
  surfaceRaised: '#1C2430',
  border: '#2A3442',
  text: '#F5F7FA',
  textMuted: '#9AA4B2',
  accent: '#22C55E',
  accentText: '#04130A',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  md: 12,
  lg: 18,
} as const;
